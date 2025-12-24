import { EventEmitter } from 'events';
const DISCOVERY_INTERVAL = 30000;
const PEER_TIMEOUT = 120000;
const MAX_PEERS_CACHE = 1000;
export class PeerDiscoveryService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.discoveredPeers = new Map();
        this.peerScores = new Map();
        this.discoveryTimer = null;
        this.cleanupTimer = null;
        this.running = false;
        this.localPeerId = '';
        this.config = {
            enableMdns: config.enableMdns ?? true,
            enableDht: config.enableDht ?? true,
            enableBootstrap: config.enableBootstrap ?? true,
            enablePubsub: config.enablePubsub ?? true,
            bootstrapPeers: config.bootstrapPeers || [],
            discoveryInterval: config.discoveryInterval || DISCOVERY_INTERVAL,
            peerTimeout: config.peerTimeout || PEER_TIMEOUT,
            maxPeers: config.maxPeers || MAX_PEERS_CACHE
        };
    }
    start(localPeerId) {
        if (this.running)
            return;
        this.localPeerId = localPeerId;
        this.running = true;
        this.discoveryTimer = setInterval(() => {
            this.runDiscoveryCycle();
        }, this.config.discoveryInterval);
        this.cleanupTimer = setInterval(() => {
            this.cleanupStalePeers();
        }, this.config.peerTimeout / 2);
        this.runDiscoveryCycle();
        this.emit('started');
    }
    stop() {
        if (!this.running)
            return;
        this.running = false;
        if (this.discoveryTimer) {
            clearInterval(this.discoveryTimer);
            this.discoveryTimer = null;
        }
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.emit('stopped');
    }
    runDiscoveryCycle() {
        this.emit('discovery:cycle:start');
        if (this.config.enableBootstrap) {
            this.processBootstrapPeers();
        }
        this.emit('discovery:cycle:complete', {
            peersDiscovered: this.discoveredPeers.size
        });
    }
    processBootstrapPeers() {
        for (const peerAddress of this.config.bootstrapPeers) {
            const peerId = this.extractPeerIdFromAddress(peerAddress);
            if (peerId && peerId !== this.localPeerId) {
                this.addOrUpdatePeer({
                    id: peerId,
                    addresses: [peerAddress],
                    capabilities: ['relay', 'dht'],
                    version: 'unknown',
                    discoveryMethod: 'bootstrap'
                });
            }
        }
    }
    addOrUpdatePeer(peerData) {
        if (peerData.id === this.localPeerId)
            return;
        const existing = this.discoveredPeers.get(peerData.id);
        const now = new Date();
        if (existing) {
            const updatedAddresses = this.mergeAddresses(existing.addresses, peerData.addresses);
            const updatedCapabilities = this.mergeCapabilities(existing.capabilities, peerData.capabilities || []);
            existing.addresses = updatedAddresses;
            existing.capabilities = updatedCapabilities;
            existing.lastSeen = now;
            existing.version = peerData.version || existing.version;
            existing.metadata = { ...existing.metadata, ...peerData.metadata };
            this.discoveredPeers.set(peerData.id, existing);
            this.emit('peer:updated', existing);
        }
        else {
            if (this.discoveredPeers.size >= this.config.maxPeers) {
                this.evictLowestScorePeer();
            }
            const newPeer = {
                id: peerData.id,
                addresses: peerData.addresses,
                capabilities: peerData.capabilities || [],
                version: peerData.version || 'unknown',
                discoveredAt: now,
                lastSeen: now,
                discoveryMethod: peerData.discoveryMethod,
                score: this.calculateInitialScore(peerData.discoveryMethod),
                metadata: peerData.metadata || {}
            };
            this.discoveredPeers.set(peerData.id, newPeer);
            this.initializePeerScore(peerData.id);
            this.emit('peer:discovered', newPeer);
        }
    }
    removePeer(peerId) {
        const peer = this.discoveredPeers.get(peerId);
        if (peer) {
            this.discoveredPeers.delete(peerId);
            this.peerScores.delete(peerId);
            this.emit('peer:removed', peer);
        }
    }
    updatePeerScore(peerId, factors) {
        const existingFactors = this.peerScores.get(peerId) || {
            latency: 0.5,
            uptime: 0.5,
            messageSuccess: 0.5,
            relayCapability: 0.5
        };
        const updatedFactors = {
            latency: factors.latency ?? existingFactors.latency,
            uptime: factors.uptime ?? existingFactors.uptime,
            messageSuccess: factors.messageSuccess ?? existingFactors.messageSuccess,
            relayCapability: factors.relayCapability ?? existingFactors.relayCapability
        };
        this.peerScores.set(peerId, updatedFactors);
        const peer = this.discoveredPeers.get(peerId);
        if (peer) {
            peer.score = this.calculateScore(updatedFactors);
            this.discoveredPeers.set(peerId, peer);
        }
    }
    recordLatency(peerId, latencyMs) {
        const normalizedLatency = Math.max(0, 1 - (latencyMs / 5000));
        this.updatePeerScore(peerId, { latency: normalizedLatency });
    }
    recordMessageSuccess(peerId, success) {
        const existingFactors = this.peerScores.get(peerId);
        if (existingFactors) {
            const currentSuccess = existingFactors.messageSuccess;
            const newSuccess = success
                ? Math.min(1, currentSuccess + 0.05)
                : Math.max(0, currentSuccess - 0.1);
            this.updatePeerScore(peerId, { messageSuccess: newSuccess });
        }
    }
    recordUptime(peerId, connected) {
        const existingFactors = this.peerScores.get(peerId);
        if (existingFactors) {
            const currentUptime = existingFactors.uptime;
            const newUptime = connected
                ? Math.min(1, currentUptime + 0.01)
                : Math.max(0, currentUptime - 0.05);
            this.updatePeerScore(peerId, { uptime: newUptime });
        }
    }
    getPeer(peerId) {
        return this.discoveredPeers.get(peerId);
    }
    getAllPeers() {
        return Array.from(this.discoveredPeers.values());
    }
    getPeersByCapability(capability) {
        return this.getAllPeers().filter(peer => peer.capabilities.includes(capability));
    }
    getPeersByScore(minScore = 0) {
        return this.getAllPeers()
            .filter(peer => peer.score >= minScore)
            .sort((a, b) => b.score - a.score);
    }
    getTopPeers(count = 10) {
        return this.getPeersByScore().slice(0, count);
    }
    getRelayPeers() {
        return this.getPeersByCapability('relay');
    }
    getPeersForRouting(targetPeerId) {
        const directPeer = this.discoveredPeers.get(targetPeerId);
        if (directPeer && directPeer.score > 0.5) {
            return [directPeer];
        }
        return this.getRelayPeers()
            .filter(peer => peer.score > 0.3)
            .slice(0, 5);
    }
    getPeerAddresses(peerId) {
        const peer = this.discoveredPeers.get(peerId);
        return peer?.addresses || [];
    }
    getPeerCount() {
        return this.discoveredPeers.size;
    }
    getActivePeerCount() {
        const now = Date.now();
        const activeThreshold = this.config.peerTimeout;
        return Array.from(this.discoveredPeers.values()).filter(peer => now - peer.lastSeen.getTime() < activeThreshold).length;
    }
    cleanupStalePeers() {
        const now = Date.now();
        const staleThreshold = this.config.peerTimeout;
        const peersToRemove = [];
        for (const [peerId, peer] of this.discoveredPeers.entries()) {
            if (now - peer.lastSeen.getTime() > staleThreshold) {
                peersToRemove.push(peerId);
            }
        }
        for (const peerId of peersToRemove) {
            this.removePeer(peerId);
        }
        if (peersToRemove.length > 0) {
            this.emit('peers:cleaned', { count: peersToRemove.length });
        }
    }
    evictLowestScorePeer() {
        let lowestScore = Infinity;
        let lowestPeerId = null;
        for (const [peerId, peer] of this.discoveredPeers.entries()) {
            if (peer.discoveryMethod !== 'bootstrap' && peer.score < lowestScore) {
                lowestScore = peer.score;
                lowestPeerId = peerId;
            }
        }
        if (lowestPeerId) {
            this.removePeer(lowestPeerId);
        }
    }
    calculateInitialScore(discoveryMethod) {
        switch (discoveryMethod) {
            case 'bootstrap':
                return 0.8;
            case 'dht':
                return 0.6;
            case 'mdns':
                return 0.7;
            case 'pubsub':
                return 0.5;
            case 'manual':
                return 0.9;
            default:
                return 0.5;
        }
    }
    calculateScore(factors) {
        const weights = {
            latency: 0.3,
            uptime: 0.25,
            messageSuccess: 0.35,
            relayCapability: 0.1
        };
        return (factors.latency * weights.latency +
            factors.uptime * weights.uptime +
            factors.messageSuccess * weights.messageSuccess +
            factors.relayCapability * weights.relayCapability);
    }
    initializePeerScore(peerId) {
        this.peerScores.set(peerId, {
            latency: 0.5,
            uptime: 0.5,
            messageSuccess: 0.5,
            relayCapability: 0.5
        });
    }
    mergeAddresses(existing, incoming) {
        const addressSet = new Set([...existing, ...incoming]);
        return Array.from(addressSet).slice(0, 10);
    }
    mergeCapabilities(existing, incoming) {
        const capabilitySet = new Set([...existing, ...incoming]);
        return Array.from(capabilitySet);
    }
    extractPeerIdFromAddress(address) {
        const peerIdMatch = address.match(/\/p2p\/([a-zA-Z0-9]+)$/);
        return peerIdMatch ? peerIdMatch[1] : null;
    }
    exportPeerList() {
        const peers = this.getAllPeers().map(peer => ({
            id: peer.id,
            addresses: peer.addresses,
            capabilities: peer.capabilities,
            score: peer.score
        }));
        return JSON.stringify(peers, null, 2);
    }
    importPeerList(json) {
        try {
            const peers = JSON.parse(json);
            let imported = 0;
            for (const peer of peers) {
                if (peer.id && peer.addresses && Array.isArray(peer.addresses)) {
                    this.addOrUpdatePeer({
                        id: peer.id,
                        addresses: peer.addresses,
                        capabilities: peer.capabilities || [],
                        discoveryMethod: 'manual'
                    });
                    imported++;
                }
            }
            return imported;
        }
        catch {
            return 0;
        }
    }
}
//# sourceMappingURL=peer-discovery.js.map