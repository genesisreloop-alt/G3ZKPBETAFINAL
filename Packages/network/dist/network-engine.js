import { createLibp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { mplex } from '@libp2p/mplex';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { bootstrap } from '@libp2p/bootstrap';
import { mdns } from '@libp2p/mdns';
import { kadDHT } from '@libp2p/kad-dht';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { identify } from '@libp2p/identify';
import { ping } from '@libp2p/ping';
import { fetch } from '@libp2p/fetch';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { multiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';
import { EventEmitter } from 'events';
const G3ZKP_PROTOCOL = '/g3zkp/messenger/1.0.0';
const G3ZKP_DISCOVERY_TOPIC = 'g3zkp-discovery';
const G3ZKP_MESSAGE_TOPIC = 'g3zkp-messages';
export class G3ZKPNetworkEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        this.node = null;
        this.peers = new Map();
        this.subscriptions = new Set();
        this.messageHandlers = new Map();
        this.startTime = 0;
        this.initialized = false;
        this.shutdownRequested = false;
        this.config = {
            listenAddresses: config.listenAddresses || [
                '/ip4/0.0.0.0/tcp/0',
                '/ip4/0.0.0.0/tcp/0/ws',
                '/ip6/::/tcp/0',
                '/ip6/::/tcp/0/ws'
            ],
            bootstrapNodes: config.bootstrapNodes || [],
            enableRelay: config.enableRelay ?? true,
            enableNatTraversal: config.enableNatTraversal ?? true,
            maxConnections: config.maxConnections || 100,
            connectionTimeout: config.connectionTimeout || 30000,
            enableMdns: config.enableMdns ?? true,
            enableDht: config.enableDht ?? true,
            dataPath: config.dataPath || './data/network'
        };
        this.stats = {
            peersConnected: 0,
            peersDiscovered: 0,
            messagesSent: 0,
            messagesReceived: 0,
            bytesTransferred: 0,
            uptime: 0,
            lastActivity: new Date()
        };
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        const peerDiscovery = [];
        const services = {};
        if (this.config.enableMdns) {
            peerDiscovery.push(mdns({
                interval: 20000
            }));
        }
        if (this.config.bootstrapNodes.length > 0) {
            peerDiscovery.push(bootstrap({
                list: this.config.bootstrapNodes,
                timeout: 3000
            }));
        }
        services.identify = identify();
        services.ping = ping({
            protocolPrefix: 'g3zkp'
        });
        if (this.config.enableDht) {
            services.dht = kadDHT({
                clientMode: false,
                validators: {},
                selectors: {}
            });
        }
        services.pubsub = gossipsub({
            emitSelf: false,
            fallbackToFloodsub: true,
            msgIdFn: (msg) => {
                const data = msg.data;
                const hash = this.hashMessage(data);
                return fromString(hash);
            },
            msgIdToStrFn: (msgId) => {
                return toString(msgId, 'hex');
            }
        });
        services.fetch = fetch();
        const transports = [
            tcp(),
            webSockets({
                filter: (addrs) => addrs.filter(a => a.toString().includes('/ws'))
            })
        ];
        if (this.config.enableRelay) {
            transports.push(circuitRelayTransport({
                discoverRelays: 2
            }));
        }
        try {
            transports.push(webRTC());
        }
        catch (e) {
            // WebRTC not available in this environment
        }
        const connectionEncryption = [noise()];
        const streamMuxers = [yamux(), mplex()];
        this.node = await createLibp2p({
            addresses: {
                listen: this.config.listenAddresses
            },
            transports,
            connectionEncryption,
            streamMuxers,
            peerDiscovery,
            services,
            connectionManager: {
                maxConnections: this.config.maxConnections,
                minConnections: 5,
                autoDialConcurrency: 25,
                maxParallelDials: 100,
                dialTimeout: this.config.connectionTimeout
            }
        });
        this.setupEventHandlers();
        await this.registerProtocol();
        await this.node.start();
        this.startTime = Date.now();
        this.initialized = true;
        await this.subscribeToDiscovery();
        this.emit('ready', {
            peerId: this.node.peerId.toString(),
            addresses: this.node.getMultiaddrs().map(ma => ma.toString())
        });
    }
    setupEventHandlers() {
        if (!this.node)
            return;
        this.node.addEventListener('peer:discovery', (evt) => {
            const peer = evt.detail;
            this.handlePeerDiscovery(peer.id);
        });
        this.node.addEventListener('peer:connect', (evt) => {
            const peerId = evt.detail;
            this.handlePeerConnect(peerId);
        });
        this.node.addEventListener('peer:disconnect', (evt) => {
            const peerId = evt.detail;
            this.handlePeerDisconnect(peerId);
        });
        this.node.addEventListener('connection:open', (evt) => {
            const connection = evt.detail;
            this.handleConnectionOpen(connection);
        });
        this.node.addEventListener('connection:close', (evt) => {
            const connection = evt.detail;
            this.handleConnectionClose(connection);
        });
        const pubsub = this.node.services.pubsub;
        if (pubsub) {
            pubsub.addEventListener('message', (evt) => {
                this.handlePubsubMessage(evt.detail);
            });
        }
    }
    async registerProtocol() {
        if (!this.node)
            return;
        await this.node.handle(G3ZKP_PROTOCOL, async ({ stream, connection }) => {
            const peerId = connection.remotePeer.toString();
            try {
                await pipe(stream.source, async function* (source) {
                    for await (const chunk of source) {
                        yield chunk;
                    }
                }, async (source) => {
                    const chunks = [];
                    for await (const chunk of source) {
                        chunks.push(chunk.subarray());
                    }
                    const data = this.concatUint8Arrays(chunks);
                    this.handleIncomingMessage(data, peerId);
                    this.stats.messagesReceived++;
                    this.stats.bytesTransferred += data.length;
                    this.stats.lastActivity = new Date();
                });
            }
            catch (error) {
                this.emit('error', { peerId, error });
            }
            finally {
                await stream.close();
            }
        });
    }
    async subscribeToDiscovery() {
        await this.subscribe(G3ZKP_DISCOVERY_TOPIC);
        await this.subscribe(G3ZKP_MESSAGE_TOPIC);
        setInterval(async () => {
            if (this.initialized && !this.shutdownRequested) {
                await this.announcePresence();
            }
        }, 30000);
        await this.announcePresence();
    }
    async announcePresence() {
        if (!this.node)
            return;
        const announcement = {
            type: 'presence',
            peerId: this.node.peerId.toString(),
            addresses: this.node.getMultiaddrs().map(ma => ma.toString()),
            timestamp: Date.now(),
            capabilities: ['messaging', 'zkp', 'relay'],
            version: '1.0.0'
        };
        const data = fromString(JSON.stringify(announcement));
        await this.publishMessage(G3ZKP_DISCOVERY_TOPIC, data);
    }
    handlePeerDiscovery(peerId) {
        const peerIdStr = peerId.toString();
        if (!this.peers.has(peerIdStr)) {
            this.peers.set(peerIdStr, {
                id: peerIdStr,
                addresses: [],
                protocols: [],
                latency: -1,
                lastSeen: new Date(),
                connectionStatus: 'disconnected',
                metadata: {}
            });
            this.stats.peersDiscovered++;
        }
        this.emit('peer:discovered', { peerId: peerIdStr });
        this.attemptConnection(peerIdStr);
    }
    async handlePeerConnect(peerId) {
        const peerIdStr = peerId.toString();
        const peerInfo = this.peers.get(peerIdStr) || {
            id: peerIdStr,
            addresses: [],
            protocols: [],
            latency: -1,
            lastSeen: new Date(),
            connectionStatus: 'connected',
            metadata: {}
        };
        peerInfo.connectionStatus = 'connected';
        peerInfo.lastSeen = new Date();
        if (this.node) {
            try {
                const latency = await this.measureLatency(peerIdStr);
                peerInfo.latency = latency;
            }
            catch {
                peerInfo.latency = -1;
            }
            try {
                const connections = this.node.getConnections(peerId);
                if (connections.length > 0) {
                    peerInfo.addresses = connections[0].remoteAddr ? [connections[0].remoteAddr.toString()] : [];
                }
            }
            catch {
                // Ignore address lookup errors
            }
        }
        this.peers.set(peerIdStr, peerInfo);
        this.stats.peersConnected++;
        this.emit('peer:connected', { peerId: peerIdStr, peerInfo });
    }
    handlePeerDisconnect(peerId) {
        const peerIdStr = peerId.toString();
        const peerInfo = this.peers.get(peerIdStr);
        if (peerInfo) {
            peerInfo.connectionStatus = 'disconnected';
            peerInfo.lastSeen = new Date();
            this.peers.set(peerIdStr, peerInfo);
        }
        this.stats.peersConnected = Math.max(0, this.stats.peersConnected - 1);
        this.emit('peer:disconnected', { peerId: peerIdStr });
    }
    handleConnectionOpen(connection) {
        const peerId = connection.remotePeer.toString();
        this.emit('connection:open', {
            peerId,
            remoteAddr: connection.remoteAddr.toString(),
            direction: connection.direction
        });
    }
    handleConnectionClose(connection) {
        const peerId = connection.remotePeer.toString();
        this.emit('connection:close', {
            peerId,
            remoteAddr: connection.remoteAddr.toString()
        });
    }
    handlePubsubMessage(message) {
        const topic = message.topic;
        const data = message.data;
        const from = message.from?.toString() || 'unknown';
        if (topic === G3ZKP_DISCOVERY_TOPIC) {
            this.handleDiscoveryMessage(data, from);
        }
        else if (topic === G3ZKP_MESSAGE_TOPIC) {
            this.handleBroadcastMessage(data, from);
        }
        else {
            const handler = this.messageHandlers.get(topic);
            if (handler) {
                handler(data, from);
            }
        }
        this.emit('pubsub:message', { topic, data, from });
    }
    handleDiscoveryMessage(data, from) {
        try {
            const message = JSON.parse(toString(data));
            if (message.type === 'presence' && message.peerId !== this.node?.peerId.toString()) {
                const peerInfo = this.peers.get(message.peerId) || {
                    id: message.peerId,
                    addresses: message.addresses || [],
                    protocols: [],
                    latency: -1,
                    lastSeen: new Date(),
                    connectionStatus: 'disconnected',
                    metadata: {
                        capabilities: message.capabilities,
                        version: message.version
                    }
                };
                peerInfo.addresses = message.addresses || [];
                peerInfo.lastSeen = new Date();
                peerInfo.metadata = {
                    capabilities: message.capabilities,
                    version: message.version
                };
                this.peers.set(message.peerId, peerInfo);
                this.attemptConnection(message.peerId);
            }
        }
        catch {
            // Invalid discovery message
        }
    }
    handleBroadcastMessage(data, from) {
        this.stats.messagesReceived++;
        this.stats.bytesTransferred += data.length;
        this.stats.lastActivity = new Date();
        this.emit('message:broadcast', { data, from });
    }
    handleIncomingMessage(data, peerId) {
        this.emit('message:received', { data, peerId });
    }
    async attemptConnection(peerIdStr) {
        if (!this.node || this.shutdownRequested)
            return;
        const peerInfo = this.peers.get(peerIdStr);
        if (!peerInfo || peerInfo.connectionStatus === 'connected')
            return;
        peerInfo.connectionStatus = 'connecting';
        this.peers.set(peerIdStr, peerInfo);
        try {
            const peerId = peerIdFromString(peerIdStr);
            if (peerInfo.addresses.length > 0) {
                for (const addr of peerInfo.addresses) {
                    try {
                        const ma = multiaddr(addr);
                        await this.node.dial(ma, { signal: AbortSignal.timeout(this.config.connectionTimeout) });
                        return;
                    }
                    catch {
                        continue;
                    }
                }
            }
            await this.node.dial(peerId, { signal: AbortSignal.timeout(this.config.connectionTimeout) });
        }
        catch {
            peerInfo.connectionStatus = 'disconnected';
            this.peers.set(peerIdStr, peerInfo);
        }
    }
    async measureLatency(peerIdStr) {
        if (!this.node)
            return -1;
        try {
            const peerId = peerIdFromString(peerIdStr);
            const pingService = this.node.services.ping;
            if (pingService) {
                const latency = await pingService.ping(peerId);
                return latency;
            }
        }
        catch {
            // Ping failed
        }
        return -1;
    }
    async sendMessage(peerId, data) {
        if (!this.node || !this.initialized) {
            return {
                messageId: this.generateMessageId(),
                recipientId: peerId,
                timestamp: new Date(),
                status: 'failed',
                method: 'direct',
                error: 'Network not initialized'
            };
        }
        const messageId = this.generateMessageId();
        try {
            const targetPeerId = peerIdFromString(peerId);
            const stream = await this.node.dialProtocol(targetPeerId, G3ZKP_PROTOCOL, {
                signal: AbortSignal.timeout(this.config.connectionTimeout)
            });
            await pipe([data], stream.sink);
            await stream.close();
            this.stats.messagesSent++;
            this.stats.bytesTransferred += data.length;
            this.stats.lastActivity = new Date();
            return {
                messageId,
                recipientId: peerId,
                timestamp: new Date(),
                status: 'sent',
                method: 'direct'
            };
        }
        catch (error) {
            return await this.sendViaRelay(peerId, data, messageId);
        }
    }
    async sendViaRelay(peerId, data, messageId) {
        if (!this.config.enableRelay) {
            return {
                messageId,
                recipientId: peerId,
                timestamp: new Date(),
                status: 'failed',
                method: 'relay',
                error: 'Relay disabled and direct connection failed'
            };
        }
        try {
            const wrappedMessage = {
                type: 'relay',
                targetPeer: peerId,
                data: toString(data, 'base64'),
                messageId,
                timestamp: Date.now()
            };
            await this.publishMessage(G3ZKP_MESSAGE_TOPIC, fromString(JSON.stringify(wrappedMessage)));
            this.stats.messagesSent++;
            this.stats.bytesTransferred += data.length;
            this.stats.lastActivity = new Date();
            return {
                messageId,
                recipientId: peerId,
                timestamp: new Date(),
                status: 'published',
                method: 'relay'
            };
        }
        catch (error) {
            return {
                messageId,
                recipientId: peerId,
                timestamp: new Date(),
                status: 'failed',
                method: 'relay',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async publishMessage(topic, data) {
        if (!this.node || !this.initialized) {
            return {
                messageId: this.generateMessageId(),
                recipientId: 'broadcast',
                timestamp: new Date(),
                status: 'failed',
                method: 'pubsub',
                error: 'Network not initialized'
            };
        }
        const messageId = this.generateMessageId();
        try {
            const pubsub = this.node.services.pubsub;
            await pubsub.publish(topic, data);
            this.stats.messagesSent++;
            this.stats.bytesTransferred += data.length;
            this.stats.lastActivity = new Date();
            return {
                messageId,
                recipientId: 'broadcast',
                timestamp: new Date(),
                status: 'published',
                method: 'pubsub'
            };
        }
        catch (error) {
            return {
                messageId,
                recipientId: 'broadcast',
                timestamp: new Date(),
                status: 'failed',
                method: 'pubsub',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async subscribe(topic) {
        if (!this.node || this.subscriptions.has(topic))
            return;
        const pubsub = this.node.services.pubsub;
        await pubsub.subscribe(topic);
        this.subscriptions.add(topic);
        this.emit('topic:subscribed', { topic });
    }
    async unsubscribe(topic) {
        if (!this.node || !this.subscriptions.has(topic))
            return;
        const pubsub = this.node.services.pubsub;
        await pubsub.unsubscribe(topic);
        this.subscriptions.delete(topic);
        this.emit('topic:unsubscribed', { topic });
    }
    onMessage(topic, handler) {
        this.messageHandlers.set(topic, handler);
    }
    offMessage(topic) {
        this.messageHandlers.delete(topic);
    }
    isConnected() {
        return this.initialized && this.node !== null && !this.shutdownRequested;
    }
    getConnectedPeers() {
        return Array.from(this.peers.entries())
            .filter(([_, info]) => info.connectionStatus === 'connected')
            .map(([id]) => id);
    }
    getAllPeers() {
        return Array.from(this.peers.values());
    }
    getPeerInfo(peerId) {
        return this.peers.get(peerId);
    }
    getPeerId() {
        return this.node?.peerId.toString() || null;
    }
    getMultiaddrs() {
        return this.node?.getMultiaddrs().map(ma => ma.toString()) || [];
    }
    getStats() {
        return {
            ...this.stats,
            uptime: this.startTime > 0 ? Date.now() - this.startTime : 0
        };
    }
    getSubscriptions() {
        return Array.from(this.subscriptions);
    }
    async connectToPeer(address) {
        if (!this.node)
            return false;
        try {
            const ma = multiaddr(address);
            await this.node.dial(ma, { signal: AbortSignal.timeout(this.config.connectionTimeout) });
            return true;
        }
        catch {
            return false;
        }
    }
    async disconnectFromPeer(peerId) {
        if (!this.node)
            return;
        try {
            const peer = peerIdFromString(peerId);
            await this.node.hangUp(peer);
        }
        catch {
            // Ignore disconnect errors
        }
    }
    async shutdown() {
        this.shutdownRequested = true;
        for (const topic of this.subscriptions) {
            await this.unsubscribe(topic);
        }
        if (this.node) {
            await this.node.stop();
            this.node = null;
        }
        this.peers.clear();
        this.messageHandlers.clear();
        this.initialized = false;
        this.emit('shutdown');
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    hashMessage(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data[i];
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }
    concatUint8Arrays(arrays) {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    }
}
//# sourceMappingURL=network-engine.js.map