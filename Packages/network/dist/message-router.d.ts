import { EventEmitter } from 'events';
export interface RouteEntry {
    targetPeer: string;
    nextHop: string;
    hopCount: number;
    latency: number;
    lastUsed: Date;
    successRate: number;
    createdAt: Date;
}
export interface RoutedMessage {
    id: string;
    source: string;
    destination: string;
    payload: Uint8Array;
    timestamp: number;
    ttl: number;
    hopCount: number;
    path: string[];
    signature?: Uint8Array;
}
export interface RoutingStats {
    messagesRouted: number;
    messagesDelivered: number;
    messagesFailed: number;
    averageHops: number;
    averageLatency: number;
    routeCacheHits: number;
    routeCacheMisses: number;
}
export interface RouterConfig {
    maxHops: number;
    messageTtl: number;
    routeCacheSize: number;
    routeCacheTtl: number;
    enableRelayRouting: boolean;
    preferDirectRoutes: boolean;
}
export declare class MessageRouter extends EventEmitter {
    private config;
    private routeCache;
    private pendingMessages;
    private processedMessages;
    private stats;
    private localPeerId;
    private connectedPeers;
    private peerLatencies;
    constructor(config?: Partial<RouterConfig>);
    initialize(localPeerId: string): void;
    updateConnectedPeers(peers: string[]): void;
    updatePeerLatency(peerId: string, latencyMs: number): void;
    routeMessage(destination: string, payload: Uint8Array): RoutedMessage | null;
    processIncomingMessage(message: RoutedMessage): {
        forward: boolean;
        nextHop?: string;
        deliver: boolean;
    };
    findRoute(destination: string): RouteEntry | null;
    private findRelayRoute;
    private learnRoute;
    addRoute(targetPeer: string, nextHop: string, hopCount: number, latency?: number): void;
    removeRoute(targetPeer: string): void;
    recordRouteSuccess(targetPeer: string): void;
    recordRouteFailure(targetPeer: string): void;
    getRoute(targetPeer: string): RouteEntry | undefined;
    getAllRoutes(): RouteEntry[];
    getRoutableDestinations(): string[];
    getStats(): RoutingStats;
    hasRoute(destination: string): boolean;
    private isRouteValid;
    private calculateRouteScore;
    private updateAverageHops;
    private pruneRouteCache;
    private cleanupExpiredEntries;
    private generateMessageId;
    serializeMessage(message: RoutedMessage): Uint8Array;
    deserializeMessage(data: Uint8Array): RoutedMessage | null;
}
//# sourceMappingURL=message-router.d.ts.map