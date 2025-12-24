/**
 * G3ZKP LibP2P Service
 * Frontend LibP2P integration for true P2P messaging
 * Migrates from Socket.IO to libp2p streams
 */

import { createLibp2p, Libp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { mplex } from '@libp2p/mplex';
import { webSockets } from '@libp2p/websockets';
import { all as wsAllFilter } from '@libp2p/websockets/filters';
import { webRTC } from '@libp2p/webrtc';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { bootstrap } from '@libp2p/bootstrap';
import { kadDHT } from '@libp2p/kad-dht';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { identify } from '@libp2p/identify';
import { ping } from '@libp2p/ping';
import { fetch } from '@libp2p/fetch';
import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { multiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';
import { EventEmitter } from 'events';
import type { PeerId } from '@libp2p/interface';
import type { Connection, Stream } from '@libp2p/interface';
import type { Message as PubSubMessage } from '@libp2p/interface';

const G3ZKP_PROTOCOL = '/g3zkp/messenger/1.0.0';
const G3ZKP_DISCOVERY_TOPIC = 'g3zkp-discovery';
const G3ZKP_MESSAGE_TOPIC = 'g3zkp-messages';

const GEO_BROADCAST_TOPICS = {
  HAZARD: '/g3zkp/geo/hazard/v1',
  TRAFFIC: '/g3zkp/geo/traffic/v1',
  REVIEW: '/g3zkp/business/review/v1'
} as const;

export type GeoReportTopicHandler = (data: any, from: string) => void;

export interface LibP2PConfig {
  bootstrapNodes?: string[];
  enableWebRTC?: boolean;
  enableDHT?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
}

export interface LibP2PPeerInfo {
  id: string;
  addresses: string[];
  protocols: string[];
  latency: number;
  lastSeen: Date;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  metadata: Record<string, any>;
}

export interface LibP2PMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  data: Uint8Array;
  timestamp: Date;
  type: 'direct' | 'broadcast' | 'discovery';
  topic?: string;
}

export type MessageHandler = (message: LibP2PMessage) => void;
export type PeerHandler = (peer: LibP2PPeerInfo) => void;
export type ConnectionHandler = (status: 'connected' | 'disconnected' | 'error', error?: string) => void;

class LibP2PService extends EventEmitter {
  private node: Libp2p | null = null;
  private config: LibP2PConfig;
  private peers: Map<string, LibP2PPeerInfo> = new Map();
  private messageHandlers: Set<MessageHandler> = new Set();
  private peerConnectHandlers: Set<PeerHandler> = new Set();
  private peerDisconnectHandlers: Set<PeerHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private subscriptions: Set<string> = new Set();
  private initialized: boolean = false;
  private localPeerId: string = '';
  private startTime: number = 0;
  private geoReportHandlers: Map<string, Set<GeoReportTopicHandler>> = new Map();

  constructor(config: LibP2PConfig = {}) {
    super();
    this.config = {
      bootstrapNodes: config.bootstrapNodes || [
        '/dnsaddr/bootstrap.libp2p.io',
        '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
        '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAcoCA25L5d6fT3j5c1YhYxB4dT5xY4wYxYxY',
        '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAcoCA25L5d6fT3j5c1YhYxB4dT5xY4wYxYxY'
      ],
      enableWebRTC: config.enableWebRTC ?? true,
      enableDHT: config.enableDHT ?? true,
      maxConnections: config.maxConnections || 50,
      connectionTimeout: config.connectionTimeout || 30000
    };
  }

  async initialize(): Promise<string> {
    if (this.initialized) {
      return this.localPeerId;
    }

    try {
      console.log('[LibP2P] Initializing LibP2P node...');

      const peerDiscovery: any[] = [];
      const services: Record<string, any> = {};

      // Bootstrap nodes for global discovery
      if (this.config.bootstrapNodes.length > 0) {
        peerDiscovery.push(bootstrap({
          list: this.config.bootstrapNodes,
          timeout: 3000
        }));
      }

      // Core services
      services.identify = identify();
      services.ping = ping({
        protocolPrefix: 'g3zkp'
      });

      // DHT for peer discovery and content routing
      if (this.config.enableDHT) {
        services.dht = kadDHT({
          clientMode: true,
          validators: {},
          selectors: {}
        });
      }

      // PubSub for group messaging
      services.pubsub = gossipsub({
        emitSelf: false,
        fallbackToFloodsub: true,
        msgIdFn: (msg: PubSubMessage) => {
          const data = msg.data;
          const hash = this.hashMessage(data);
          return fromString(hash);
        },
        msgIdToStrFn: (msgId: Uint8Array) => {
          return toString(msgId, 'hex');
        }
      });

      services.fetch = fetch();

      // Transport protocols (browser-compatible)
      const transports: any[] = [
        webSockets({
          filter: wsAllFilter
        }),
        circuitRelayTransport()
      ];

      // WebRTC for NAT traversal (browser-friendly)
      if (this.config.enableWebRTC) {
        try {
          transports.push(webRTC());
        } catch (e) {
          console.warn('[LibP2P] WebRTC not available:', e);
        }
      }

      // Security and multiplexing
      const connectionEncryption = [noise()];
      const streamMuxers = [yamux(), mplex()];

      // Create LibP2P node (browser mode - no listen addresses needed)
      this.node = await createLibp2p({
        transports,
        connectionEncryption,
        streamMuxers,
        peerDiscovery,
        services,
        connectionManager: {
          maxConnections: this.config.maxConnections,
          minConnections: 5,
          autoDialConcurrency: 25,
          maxParallelDials: 50,
          dialTimeout: this.config.connectionTimeout
        }
      });

      this.localPeerId = this.node.peerId.toString();
      this.setupEventHandlers();
      await this.registerProtocol();
      await this.node.start();
      this.startTime = Date.now();
      this.initialized = true;

      // Subscribe to discovery and messaging topics
      await this.subscribe(G3ZKP_DISCOVERY_TOPIC);
      await this.subscribe(G3ZKP_MESSAGE_TOPIC);

      // Subscribe to geo-broadcast topics
      await this.subscribe(GEO_BROADCAST_TOPICS.HAZARD);
      await this.subscribe(GEO_BROADCAST_TOPICS.TRAFFIC);
      await this.subscribe(GEO_BROADCAST_TOPICS.REVIEW);

      // Start periodic presence announcements
      this.startPresenceAnnouncements();

      console.log('[LibP2P] Node initialized:', this.localPeerId);
      console.log('[LibP2P] Multiaddrs:', this.node.getMultiaddrs().map(ma => ma.toString()));

      this.emit('initialized', {
        peerId: this.localPeerId,
        addresses: this.node.getMultiaddrs().map(ma => ma.toString())
      });

      return this.localPeerId;
    } catch (error) {
      console.error('[LibP2P] Initialization failed:', error);
      this.emit('error', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.node) return;

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

    // Handle pubsub messages
    const pubsub = this.node.services.pubsub as any;
    if (pubsub) {
      pubsub.addEventListener('message', (evt: any) => {
        this.handlePubsubMessage(evt.detail);
      });
    }
  }

  private async registerProtocol(): Promise<void> {
    if (!this.node) return;

    await this.node.handle(G3ZKP_PROTOCOL, async ({ stream, connection }) => {
      const peerId = connection.remotePeer.toString();
      
      try {
        await pipe(
          stream.source,
          async function* (source) {
            for await (const chunk of source) {
              yield chunk;
            }
          },
          async (source) => {
            const chunks: Uint8Array[] = [];
            for await (const chunk of source) {
              chunks.push(chunk.subarray());
            }
            const data = this.concatUint8Arrays(chunks);
            this.handleIncomingMessage(data, peerId);
          }
        );
      } catch (error) {
        console.error('[LibP2P] Protocol handler error:', error);
        this.emit('error', { peerId, error });
      } finally {
        await stream.close();
      }
    });
  }

  private startPresenceAnnouncements(): void {
    setInterval(async () => {
      if (this.initialized && this.node && !this.node.isStopped()) {
        await this.announcePresence();
      }
    }, 30000);
  }

  private async announcePresence(): Promise<void> {
    if (!this.node) return;

    const announcement = {
      type: 'presence',
      peerId: this.node.peerId.toString(),
      addresses: this.node.getMultiaddrs().map(ma => ma.toString()),
      timestamp: Date.now(),
      capabilities: ['messaging', 'zkp', 'relay'],
      version: '1.0.0',
      userAgent: navigator.userAgent
    };

    const data = fromString(JSON.stringify(announcement));
    await this.publishMessage(G3ZKP_DISCOVERY_TOPIC, data);
  }

  private handlePeerDiscovery(peerId: PeerId): void {
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
    }

    this.emit('peer:discovered', { peerId: peerIdStr });
    this.attemptConnection(peerIdStr);
  }

  private async handlePeerConnect(peerId: PeerId): Promise<void> {
    const peerIdStr = peerId.toString();
    
    const peerInfo = this.peers.get(peerIdStr) || {
      id: peerIdStr,
      addresses: [],
      protocols: [],
      latency: -1,
      lastSeen: new Date(),
      connectionStatus: 'connected' as const,
      metadata: {}
    };

    peerInfo.connectionStatus = 'connected';
    peerInfo.lastSeen = new Date();

    if (this.node) {
      try {
        const latency = await this.measureLatency(peerIdStr);
        peerInfo.latency = latency;
      } catch {
        peerInfo.latency = -1;
      }

      try {
        const connections = this.node.getConnections(peerId);
        if (connections.length > 0) {
          peerInfo.addresses = connections[0].remoteAddr ? [connections[0].remoteAddr.toString()] : [];
        }
      } catch {
        // Ignore address lookup errors
      }
    }

    this.peers.set(peerIdStr, peerInfo);
    this.peerConnectHandlers.forEach(handler => handler(peerInfo));
    this.emit('peer:connected', { peerId: peerIdStr, peerInfo });
  }

  private handlePeerDisconnect(peerId: PeerId): void {
    const peerIdStr = peerId.toString();
    
    const peerInfo = this.peers.get(peerIdStr);
    if (peerInfo) {
      peerInfo.connectionStatus = 'disconnected';
      peerInfo.lastSeen = new Date();
      this.peers.set(peerIdStr, peerInfo);
    }

    this.peerDisconnectHandlers.forEach(handler => handler(peerInfo));
    this.emit('peer:disconnected', { peerId: peerIdStr });
  }

  private handlePubsubMessage(message: any): void {
    const topic = message.topic;
    const data = message.data;
    const from = message.from?.toString() || 'unknown';

    if (topic === G3ZKP_DISCOVERY_TOPIC) {
      this.handleDiscoveryMessage(data, from);
    } else if (topic === G3ZKP_MESSAGE_TOPIC) {
      this.handleBroadcastMessage(data, from);
    } else if (this.isGeoTopic(topic)) {
      this.handleGeoReportMessage(topic, data, from);
    }

    this.emit('pubsub:message', { topic, data, from });
  }

  private isGeoTopic(topic: string): boolean {
    return topic === GEO_BROADCAST_TOPICS.HAZARD ||
           topic === GEO_BROADCAST_TOPICS.TRAFFIC ||
           topic === GEO_BROADCAST_TOPICS.REVIEW;
  }

  private handleGeoReportMessage(topic: string, data: Uint8Array, from: string): void {
    try {
      const reportData = JSON.parse(toString(data));
      
      const handlers = this.geoReportHandlers.get(topic);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(reportData, from);
          } catch (error) {
            console.error('[LibP2P] Geo report handler error:', error);
          }
        });
      }

      this.emit('geo:report', { topic, data: reportData, from });
      console.log(`[LibP2P] Received geo report on ${topic} from ${from}`);
    } catch (error) {
      console.error('[LibP2P] Failed to parse geo report:', error);
    }
  }

  private handleDiscoveryMessage(data: Uint8Array, from: string): void {
    try {
      const message = JSON.parse(toString(data));
      
      if (message.type === 'presence' && message.peerId !== this.localPeerId) {
        const peerInfo = this.peers.get(message.peerId) || {
          id: message.peerId,
          addresses: message.addresses || [],
          protocols: [],
          latency: -1,
          lastSeen: new Date(),
          connectionStatus: 'disconnected' as const,
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
    } catch {
      // Invalid discovery message
    }
  }

  private handleBroadcastMessage(data: Uint8Array, from: string): void {
    const libP2PMessage: LibP2PMessage = {
      id: this.generateMessageId(),
      from,
      to: 'broadcast',
      data,
      timestamp: new Date(),
      type: 'broadcast',
      topic: G3ZKP_MESSAGE_TOPIC
    };

    this.messageHandlers.forEach(handler => handler(libP2PMessage));
    this.emit('message:broadcast', libP2PMessage);
  }

  private handleIncomingMessage(data: Uint8Array, peerId: string): void {
    const libP2PMessage: LibP2PMessage = {
      id: this.generateMessageId(),
      from: peerId,
      to: this.localPeerId,
      data,
      timestamp: new Date(),
      type: 'direct'
    };

    this.messageHandlers.forEach(handler => handler(libP2PMessage));
    this.emit('message:received', libP2PMessage);
  }

  private async attemptConnection(peerIdStr: string): Promise<void> {
    if (!this.node || this.node.isStopped()) return;

    const peerInfo = this.peers.get(peerIdStr);
    if (!peerInfo || peerInfo.connectionStatus === 'connected') return;

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
          } catch {
            continue;
          }
        }
      }

      await this.node.dial(peerId, { signal: AbortSignal.timeout(this.config.connectionTimeout) });
    } catch {
      peerInfo.connectionStatus = 'disconnected';
      this.peers.set(peerIdStr, peerInfo);
    }
  }

  private async measureLatency(peerIdStr: string): Promise<number> {
    if (!this.node) return -1;

    try {
      const peerId = peerIdFromString(peerIdStr);
      const pingService = this.node.services.ping as any;
      if (pingService) {
        const latency = await pingService.ping(peerId);
        return latency;
      }
    } catch {
      // Ping failed
    }
    return -1;
  }

  async sendMessage(peerId: string, data: string | Uint8Array): Promise<boolean> {
    if (!this.node || !this.initialized) {
      console.warn('[LibP2P] Cannot send message: node not initialized');
      return false;
    }

    try {
      const messageData = typeof data === 'string' ? fromString(data) : data;
      const targetPeerId = peerIdFromString(peerId);
      
      const stream = await this.node.dialProtocol(targetPeerId, G3ZKP_PROTOCOL, {
        signal: AbortSignal.timeout(this.config.connectionTimeout)
      });

      await pipe(
        [messageData],
        stream.sink
      );

      await stream.close();

      console.log('[LibP2P] Message sent to:', peerId);
      return true;
    } catch (error) {
      console.error('[LibP2P] Failed to send direct message:', error);
      
      // Try broadcast as fallback
      try {
        const wrappedMessage = {
          type: 'direct',
          targetPeer: peerId,
          data: toString(typeof data === 'string' ? fromString(data) : data, 'base64'),
          timestamp: Date.now(),
          from: this.localPeerId
        };

        await this.publishMessage(G3ZKP_MESSAGE_TOPIC, fromString(JSON.stringify(wrappedMessage)));
        console.log('[LibP2P] Message sent via pubsub relay to:', peerId);
        return true;
      } catch (relayError) {
        console.error('[LibP2P] Failed to send via relay:', relayError);
        return false;
      }
    }
  }

  async publishMessage(topic: string, data: Uint8Array): Promise<boolean> {
    if (!this.node || !this.initialized) {
      console.warn('[LibP2P] Cannot publish message: node not initialized');
      return false;
    }

    try {
      const pubsub = this.node.services.pubsub as any;
      await pubsub.publish(topic, data);
      console.log('[LibP2P] Message published to topic:', topic);
      return true;
    } catch (error) {
      console.error('[LibP2P] Failed to publish message:', error);
      return false;
    }
  }

  async subscribe(topic: string): Promise<void> {
    if (!this.node || this.subscriptions.has(topic)) return;

    const pubsub = this.node.services.pubsub as any;
    await pubsub.subscribe(topic);
    this.subscriptions.add(topic);

    console.log('[LibP2P] Subscribed to topic:', topic);
    this.emit('topic:subscribed', { topic });
  }

  async unsubscribe(topic: string): Promise<void> {
    if (!this.node || !this.subscriptions.has(topic)) return;

    const pubsub = this.node.services.pubsub as any;
    await pubsub.unsubscribe(topic);
    this.subscriptions.delete(topic);

    console.log('[LibP2P] Unsubscribed from topic:', topic);
    this.emit('topic:unsubscribed', { topic });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onPeerConnect(handler: PeerHandler): () => void {
    this.peerConnectHandlers.add(handler);
    return () => this.peerConnectHandlers.delete(handler);
  }

  onPeerDisconnect(handler: PeerHandler): () => void {
    this.peerDisconnectHandlers.add(handler);
    return () => this.peerDisconnectHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onGeoReport(topic: string, handler: GeoReportTopicHandler): () => void {
    if (!this.geoReportHandlers.has(topic)) {
      this.geoReportHandlers.set(topic, new Set());
    }
    this.geoReportHandlers.get(topic)!.add(handler);
    return () => {
      const handlers = this.geoReportHandlers.get(topic);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  async broadcastGeoReport(report: any, type: 'HAZARD' | 'TRAFFIC' | 'REVIEW'): Promise<boolean> {
    let topic: string;
    switch (type) {
      case 'HAZARD':
        topic = GEO_BROADCAST_TOPICS.HAZARD;
        break;
      case 'TRAFFIC':
        topic = GEO_BROADCAST_TOPICS.TRAFFIC;
        break;
      case 'REVIEW':
        topic = GEO_BROADCAST_TOPICS.REVIEW;
        break;
      default:
        console.error('[LibP2P] Unknown geo report type:', type);
        return false;
    }

    const data = fromString(JSON.stringify(report));
    const success = await this.publishMessage(topic, data);
    
    if (success) {
      console.log(`[LibP2P] Broadcast ${type} geo report: ${report.id}`);
    }
    
    return success;
  }

  getGeoTopics(): typeof GEO_BROADCAST_TOPICS {
    return GEO_BROADCAST_TOPICS;
  }

  getLocalPeerId(): string {
    return this.localPeerId;
  }

  getConnectedPeers(): LibP2PPeerInfo[] {
    return Array.from(this.peers.values())
      .filter(peer => peer.connectionStatus === 'connected');
  }

  getAllPeers(): LibP2PPeerInfo[] {
    return Array.from(this.peers.values());
  }

  getPeerInfo(peerId: string): LibP2PPeerInfo | undefined {
    return this.peers.get(peerId);
  }

  getMultiaddrs(): string[] {
    return this.node?.getMultiaddrs().map(ma => ma.toString()) || [];
  }

  isInitialized(): boolean {
    return this.initialized && this.node !== null && !this.node.isStopped();
  }

  async connectToPeer(address: string): Promise<boolean> {
    if (!this.node) return false;

    try {
      const ma = multiaddr(address);
      await this.node.dial(ma, { signal: AbortSignal.timeout(this.config.connectionTimeout) });
      return true;
    } catch {
      return false;
    }
  }

  async disconnectFromPeer(peerId: string): Promise<void> {
    if (!this.node) return;

    try {
      const peer = peerIdFromString(peerId);
      await this.node.hangUp(peer);
    } catch {
      // Ignore disconnect errors
    }
  }

  async shutdown(): Promise<void> {
    if (this.node) {
      for (const topic of this.subscriptions) {
        await this.unsubscribe(topic);
      }

      await this.node.stop();
      this.node = null;
    }

    this.peers.clear();
    this.messageHandlers.clear();
    this.peerConnectHandlers.clear();
    this.peerDisconnectHandlers.clear();
    this.connectionHandlers.clear();
    this.subscriptions.clear();
    this.initialized = false;

    console.log('[LibP2P] Node shutdown complete');
    this.emit('shutdown');
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private hashMessage(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  private concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
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

export const libP2PService = new LibP2PService();
export default libP2PService;