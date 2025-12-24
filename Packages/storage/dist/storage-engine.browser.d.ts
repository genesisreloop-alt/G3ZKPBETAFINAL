import EventEmitter from 'eventemitter3';
export interface Message {
    id: string;
    conversationId: string;
    sender: Uint8Array;
    recipient: Uint8Array;
    content: Uint8Array;
    contentType: string;
    timestamp: Date;
    hash: string;
    status: string;
    metadata: {
        encryptionVersion: string;
        zkpProofId?: string;
        ephemeral: boolean;
        expiresAt?: Date;
    };
}
export interface Session {
    id: string;
    peerId: string;
    identityKey: Uint8Array;
    signedPreKey: Uint8Array;
    oneTimePreKey?: Uint8Array;
    createdAt: Date;
    lastActivity: Date;
}
export interface ZKProof {
    id: string;
    messageId: string;
    proof: any;
    publicSignals: string[];
    circuitId: string;
    createdAt: Date;
    verified: boolean;
}
export interface StorageConfig {
    dbPath: string;
    encryptionKey?: Uint8Array;
    messageRetentionDays?: number;
    maxMessageSize?: number;
    enableEphemeral?: boolean;
    cacheSize?: number;
    encryptAtRest?: boolean;
}
export interface StorageStats {
    totalMessages: number;
    totalSessions: number;
    totalProofs: number;
    databaseSize: number;
    encryptedChunks: number;
    cacheHitRate: number;
}
export interface ConversationInfo {
    id: string;
    peerId: string;
    lastMessage?: Message;
    unreadCount: number;
    messageCount: number;
    createdAt: Date;
    lastActivity: Date;
}
export declare class G3ZKPStorageEngine extends EventEmitter {
    private db;
    private encryption?;
    private config;
    private isInitialized;
    private messageCache;
    private sessionCache;
    private stats;
    constructor(config: StorageConfig);
    initialize(): Promise<void>;
    private loadStats;
    private saveStats;
    storeMessage(message: Message): Promise<void>;
    getMessage(messageId: string): Promise<Message | null>;
    getConversationMessages(conversationId: string, limit?: number, offset?: number): Promise<Message[]>;
    storeSession(session: Session): Promise<void>;
    getSession(sessionId: string): Promise<Session | null>;
    storeProof(proof: ZKProof): Promise<void>;
    getProof(proofId: string): Promise<ZKProof | null>;
    private updateConversationIndex;
    getConversations(): Promise<ConversationInfo[]>;
    deleteMessage(messageId: string): Promise<void>;
    getStats(): Promise<StorageStats>;
    cleanup(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=storage-engine.browser.d.ts.map