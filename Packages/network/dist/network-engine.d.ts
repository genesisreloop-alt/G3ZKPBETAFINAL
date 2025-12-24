import { EventEmitter } from 'events';
export interface NetworkConfig {
    listenAddresses: string[];
    bootstrapNodes: string[];
    enableRelay: boolean;
    enableNatTraversal: boolean;
    maxConnections: number;
    connectionTimeout: number;
    enableMdns: boolean;
    enableDht: boolean;
    dataPath: string;
}
export interface PeerInfo {
    id: string;
    addresses: string[];
    protocols: string[];
    latency: number;
    lastSeen: Date;
    connectionStatus: 'connected' | 'disconnected' | 'connecting';
    metadata: Record<string, any>;
}
export interface MessageReceipt {
    messageId: string;
    recipientId: string;
    timestamp: Date;
    status: 'sent' | 'delivered' | 'published' | 'failed';
    method: 'direct' | 'pubsub' | 'relay';
    error?: string;
}
export interface NetworkStats {
    peersConnected: number;
    peersDiscovered: number;
    messagesSent: number;
    messagesReceived: number;
    bytesTransferred: number;
    uptime: number;
    lastActivity: Date;
}
export declare class G3ZKPNetworkEngine extends EventEmitter {
    private node;
    private config;
    private peers;
    private subscriptions;
    private messageHandlers;
    private stats;
    private startTime;
    private initialized;
    private shutdownRequested;
    constructor(config?: Partial<NetworkConfig>);
    initialize(): Promise<void>;
    private setupEventHandlers;
    private registerProtocol;
    private subscribeToDiscovery;
    private announcePresence;
    private handlePeerDiscovery;
    private handlePeerConnect;
    private handlePeerDisconnect;
    private handleConnectionOpen;
    private handleConnectionClose;
    private handlePubsubMessage;
    private handleDiscoveryMessage;
    private handleBroadcastMessage;
    private handleIncomingMessage;
    private attemptConnection;
    private measureLatency;
    sendMessage(peerId: string, data: Uint8Array): Promise<MessageReceipt>;
    private sendViaRelay;
    publishMessage(topic: string, data: Uint8Array): Promise<MessageReceipt>;
    subscribe(topic: string): Promise<void>;
    unsubscribe(topic: string): Promise<void>;
    onMessage(topic: string, handler: (data: Uint8Array, peerId: string) => void): void;
    offMessage(topic: string): void;
    isConnected(): boolean;
    getConnectedPeers(): string[];
    getAllPeers(): PeerInfo[];
    getPeerInfo(peerId: string): PeerInfo | undefined;
    getPeerId(): string | null;
    getMultiaddrs(): string[];
    getStats(): NetworkStats;
    getSubscriptions(): string[];
    connectToPeer(address: string): Promise<boolean>;
    disconnectFromPeer(peerId: string): Promise<void>;
    shutdown(): Promise<void>;
    private generateMessageId;
    private hashMessage;
    private concatUint8Arrays;
}
//# sourceMappingURL=network-engine.d.ts.map