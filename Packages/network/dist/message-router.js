import { EventEmitter } from 'events';
import { fromString, toString } from 'uint8arrays';
const MAX_HOPS = 5;
const MESSAGE_TTL = 60000;
const ROUTE_CACHE_SIZE = 1000;
const ROUTE_CACHE_TTL = 300000;
export class MessageRouter extends EventEmitter {
    constructor(config = {}) {
        super();
        this.routeCache = new Map();
        this.pendingMessages = new Map();
        this.processedMessages = new Set();
        this.localPeerId = '';
        this.connectedPeers = new Set();
        this.peerLatencies = new Map();
        this.config = {
            maxHops: config.maxHops || MAX_HOPS,
            messageTtl: config.messageTtl || MESSAGE_TTL,
            routeCacheSize: config.routeCacheSize || ROUTE_CACHE_SIZE,
            routeCacheTtl: config.routeCacheTtl || ROUTE_CACHE_TTL,
            enableRelayRouting: config.enableRelayRouting ?? true,
            preferDirectRoutes: config.preferDirectRoutes ?? true
        };
        this.stats = {
            messagesRouted: 0,
            messagesDelivered: 0,
            messagesFailed: 0,
            averageHops: 0,
            averageLatency: 0,
            routeCacheHits: 0,
            routeCacheMisses: 0
        };
        setInterval(() => this.cleanupExpiredEntries(), 30000);
    }
    initialize(localPeerId) {
        this.localPeerId = localPeerId;
        this.emit('initialized', { localPeerId });
    }
    updateConnectedPeers(peers) {
        this.connectedPeers = new Set(peers);
        for (const peerId of peers) {
            if (!this.routeCache.has(peerId)) {
                this.routeCache.set(peerId, {
                    targetPeer: peerId,
                    nextHop: peerId,
                    hopCount: 1,
                    latency: this.peerLatencies.get(peerId) || 100,
                    lastUsed: new Date(),
                    successRate: 1.0,
                    createdAt: new Date()
                });
            }
        }
    }
    updatePeerLatency(peerId, latencyMs) {
        this.peerLatencies.set(peerId, latencyMs);
        const route = this.routeCache.get(peerId);
        if (route && route.hopCount === 1) {
            route.latency = latencyMs;
            this.routeCache.set(peerId, route);
        }
    }
    routeMessage(destination, payload) {
        if (destination === this.localPeerId) {
            return null;
        }
        const messageId = this.generateMessageId();
        const message = {
            id: messageId,
            source: this.localPeerId,
            destination,
            payload,
            timestamp: Date.now(),
            ttl: this.config.messageTtl,
            hopCount: 0,
            path: [this.localPeerId]
        };
        const route = this.findRoute(destination);
        if (!route) {
            this.stats.messagesFailed++;
            this.emit('route:notfound', { destination, messageId });
            return null;
        }
        message.path.push(route.nextHop);
        this.stats.messagesRouted++;
        this.stats.routeCacheHits++;
        route.lastUsed = new Date();
        this.routeCache.set(destination, route);
        this.emit('message:routed', {
            messageId,
            destination,
            nextHop: route.nextHop,
            hopCount: route.hopCount
        });
        return message;
    }
    processIncomingMessage(message) {
        if (this.processedMessages.has(message.id)) {
            return { forward: false, deliver: false };
        }
        this.processedMessages.add(message.id);
        if (Date.now() - message.timestamp > message.ttl) {
            this.emit('message:expired', { messageId: message.id });
            return { forward: false, deliver: false };
        }
        if (message.hopCount >= this.config.maxHops) {
            this.emit('message:maxhops', { messageId: message.id });
            return { forward: false, deliver: false };
        }
        if (message.destination === this.localPeerId) {
            this.stats.messagesDelivered++;
            this.updateAverageHops(message.hopCount);
            this.emit('message:delivered', { messageId: message.id, hopCount: message.hopCount });
            return { forward: false, deliver: true };
        }
        if (!this.config.enableRelayRouting) {
            return { forward: false, deliver: false };
        }
        const route = this.findRoute(message.destination);
        if (!route) {
            this.stats.messagesFailed++;
            return { forward: false, deliver: false };
        }
        message.hopCount++;
        message.path.push(this.localPeerId);
        this.learnRoute(message.source, message.path);
        return { forward: true, nextHop: route.nextHop, deliver: false };
    }
    findRoute(destination) {
        if (this.connectedPeers.has(destination)) {
            const existingRoute = this.routeCache.get(destination);
            if (existingRoute && existingRoute.hopCount === 1) {
                return existingRoute;
            }
            const directRoute = {
                targetPeer: destination,
                nextHop: destination,
                hopCount: 1,
                latency: this.peerLatencies.get(destination) || 100,
                lastUsed: new Date(),
                successRate: 1.0,
                createdAt: new Date()
            };
            this.routeCache.set(destination, directRoute);
            return directRoute;
        }
        const cachedRoute = this.routeCache.get(destination);
        if (cachedRoute && this.isRouteValid(cachedRoute)) {
            return cachedRoute;
        }
        const relayRoute = this.findRelayRoute(destination);
        if (relayRoute) {
            this.routeCache.set(destination, relayRoute);
            return relayRoute;
        }
        this.stats.routeCacheMisses++;
        return null;
    }
    findRelayRoute(destination) {
        let bestRoute = null;
        let bestScore = -1;
        for (const [peerId, route] of this.routeCache.entries()) {
            if (route.targetPeer === destination && this.connectedPeers.has(route.nextHop)) {
                const score = this.calculateRouteScore(route);
                if (score > bestScore) {
                    bestScore = score;
                    bestRoute = route;
                }
            }
        }
        if (bestRoute) {
            return bestRoute;
        }
        for (const connectedPeer of this.connectedPeers) {
            if (connectedPeer !== destination) {
                return {
                    targetPeer: destination,
                    nextHop: connectedPeer,
                    hopCount: 2,
                    latency: (this.peerLatencies.get(connectedPeer) || 100) * 2,
                    lastUsed: new Date(),
                    successRate: 0.5,
                    createdAt: new Date()
                };
            }
        }
        return null;
    }
    learnRoute(source, path) {
        if (path.length < 2)
            return;
        for (let i = 0; i < path.length - 1; i++) {
            const target = path[i];
            const nextHop = path[i + 1];
            const hopCount = path.length - i - 1;
            if (target === this.localPeerId)
                continue;
            const existingRoute = this.routeCache.get(target);
            if (!existingRoute || existingRoute.hopCount > hopCount) {
                this.routeCache.set(target, {
                    targetPeer: target,
                    nextHop: this.connectedPeers.has(nextHop) ? nextHop : path[path.length - 1],
                    hopCount,
                    latency: hopCount * 100,
                    lastUsed: new Date(),
                    successRate: 0.7,
                    createdAt: new Date()
                });
            }
        }
        this.pruneRouteCache();
    }
    addRoute(targetPeer, nextHop, hopCount, latency = 100) {
        const existingRoute = this.routeCache.get(targetPeer);
        if (!existingRoute ||
            existingRoute.hopCount > hopCount ||
            (existingRoute.hopCount === hopCount && existingRoute.latency > latency)) {
            this.routeCache.set(targetPeer, {
                targetPeer,
                nextHop,
                hopCount,
                latency,
                lastUsed: new Date(),
                successRate: 0.8,
                createdAt: new Date()
            });
        }
    }
    removeRoute(targetPeer) {
        this.routeCache.delete(targetPeer);
    }
    recordRouteSuccess(targetPeer) {
        const route = this.routeCache.get(targetPeer);
        if (route) {
            route.successRate = Math.min(1.0, route.successRate + 0.05);
            route.lastUsed = new Date();
            this.routeCache.set(targetPeer, route);
        }
    }
    recordRouteFailure(targetPeer) {
        const route = this.routeCache.get(targetPeer);
        if (route) {
            route.successRate = Math.max(0, route.successRate - 0.1);
            if (route.successRate < 0.2) {
                this.routeCache.delete(targetPeer);
            }
            else {
                this.routeCache.set(targetPeer, route);
            }
        }
    }
    getRoute(targetPeer) {
        return this.routeCache.get(targetPeer);
    }
    getAllRoutes() {
        return Array.from(this.routeCache.values());
    }
    getRoutableDestinations() {
        return Array.from(this.routeCache.keys());
    }
    getStats() {
        return { ...this.stats };
    }
    hasRoute(destination) {
        return this.connectedPeers.has(destination) ||
            (this.routeCache.has(destination) && this.isRouteValid(this.routeCache.get(destination)));
    }
    isRouteValid(route) {
        const age = Date.now() - route.createdAt.getTime();
        if (age > this.config.routeCacheTtl) {
            return false;
        }
        if (!this.connectedPeers.has(route.nextHop)) {
            return false;
        }
        if (route.successRate < 0.2) {
            return false;
        }
        return true;
    }
    calculateRouteScore(route) {
        const hopScore = 1 - (route.hopCount / this.config.maxHops);
        const latencyScore = 1 - Math.min(1, route.latency / 1000);
        const successScore = route.successRate;
        const freshnessScore = 1 - Math.min(1, (Date.now() - route.lastUsed.getTime()) / this.config.routeCacheTtl);
        return (hopScore * 0.3) + (latencyScore * 0.2) + (successScore * 0.4) + (freshnessScore * 0.1);
    }
    updateAverageHops(hops) {
        const totalMessages = this.stats.messagesDelivered;
        this.stats.averageHops = ((this.stats.averageHops * (totalMessages - 1)) + hops) / totalMessages;
    }
    pruneRouteCache() {
        if (this.routeCache.size <= this.config.routeCacheSize) {
            return;
        }
        const routes = Array.from(this.routeCache.entries())
            .map(([key, route]) => ({ key, route, score: this.calculateRouteScore(route) }))
            .sort((a, b) => a.score - b.score);
        const toRemove = routes.slice(0, routes.length - this.config.routeCacheSize);
        for (const { key } of toRemove) {
            this.routeCache.delete(key);
        }
    }
    cleanupExpiredEntries() {
        const now = Date.now();
        for (const [key, route] of this.routeCache.entries()) {
            if (now - route.createdAt.getTime() > this.config.routeCacheTtl) {
                this.routeCache.delete(key);
            }
        }
        const messageExpiry = now - this.config.messageTtl * 2;
        for (const messageId of this.processedMessages) {
            const timestamp = parseInt(messageId.split('_')[1] || '0');
            if (timestamp < messageExpiry) {
                this.processedMessages.delete(messageId);
            }
        }
        if (this.processedMessages.size > 10000) {
            const toKeep = Array.from(this.processedMessages).slice(-5000);
            this.processedMessages = new Set(toKeep);
        }
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    serializeMessage(message) {
        const json = JSON.stringify({
            id: message.id,
            source: message.source,
            destination: message.destination,
            payload: toString(message.payload, 'base64'),
            timestamp: message.timestamp,
            ttl: message.ttl,
            hopCount: message.hopCount,
            path: message.path
        });
        return fromString(json);
    }
    deserializeMessage(data) {
        try {
            const json = toString(data);
            const parsed = JSON.parse(json);
            return {
                id: parsed.id,
                source: parsed.source,
                destination: parsed.destination,
                payload: fromString(parsed.payload, 'base64'),
                timestamp: parsed.timestamp,
                ttl: parsed.ttl,
                hopCount: parsed.hopCount,
                path: parsed.path
            };
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=message-router.js.map