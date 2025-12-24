import { EventEmitter } from 'events';
export interface DiscoveredPeer {
    id: string;
    addresses: string[];
    capabilities: string[];
    version: string;
    discoveredAt: Date;
    lastSeen: Date;
    discoveryMethod: 'mdns' | 'dht' | 'bootstrap' | 'pubsub' | 'manual';
    score: number;
    metadata: Record<string, any>;
}
export interface DiscoveryConfig {
    enableMdns: boolean;
    enableDht: boolean;
    enableBootstrap: boolean;
    enablePubsub: boolean;
    bootstrapPeers: string[];
    discoveryInterval: number;
    peerTimeout: number;
    maxPeers: number;
}
export interface PeerScoreFactors {
    latency: number;
    uptime: number;
    messageSuccess: number;
    relayCapability: number;
}
export declare class PeerDiscoveryService extends EventEmitter {
    private config;
    private discoveredPeers;
    private peerScores;
    private discoveryTimer;
    private cleanupTimer;
    private running;
    private localPeerId;
    constructor(config?: Partial<DiscoveryConfig>);
    start(localPeerId: string): void;
    stop(): void;
    private runDiscoveryCycle;
    private processBootstrapPeers;
    addOrUpdatePeer(peerData: {
        id: string;
        addresses: string[];
        capabilities?: string[];
        version?: string;
        discoveryMethod: 'mdns' | 'dht' | 'bootstrap' | 'pubsub' | 'manual';
        metadata?: Record<string, any>;
    }): void;
    removePeer(peerId: string): void;
    updatePeerScore(peerId: string, factors: Partial<PeerScoreFactors>): void;
    recordLatency(peerId: string, latencyMs: number): void;
    recordMessageSuccess(peerId: string, success: boolean): void;
    recordUptime(peerId: string, connected: boolean): void;
    getPeer(peerId: string): DiscoveredPeer | undefined;
    getAllPeers(): DiscoveredPeer[];
    getPeersByCapability(capability: string): DiscoveredPeer[];
    getPeersByScore(minScore?: number): DiscoveredPeer[];
    getTopPeers(count?: number): DiscoveredPeer[];
    getRelayPeers(): DiscoveredPeer[];
    getPeersForRouting(targetPeerId: string): DiscoveredPeer[];
    getPeerAddresses(peerId: string): string[];
    getPeerCount(): number;
    getActivePeerCount(): number;
    private cleanupStalePeers;
    private evictLowestScorePeer;
    private calculateInitialScore;
    private calculateScore;
    private initializePeerScore;
    private mergeAddresses;
    private mergeCapabilities;
    private extractPeerIdFromAddress;
    exportPeerList(): string;
    importPeerList(json: string): number;
}
//# sourceMappingURL=peer-discovery.d.ts.map