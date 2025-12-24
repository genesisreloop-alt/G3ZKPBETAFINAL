import { EventEmitter } from 'events';
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
    ephemeralKey: Uint8Array;
    chainKey: Uint8Array;
    previousChainKey: Uint8Array;
    currentRatchetKey: {
        publicKey: Uint8Array;
        secretKey: Uint8Array;
    };
    messageNumber: number;
    previousChainLength: number;
    keyId: string;
    createdAt: Date;
    lastActivity: Date;
}
export interface ZKProof {
    id: string;
    circuitId: string;
    proof: Uint8Array;
    publicSignals: string[];
    metadata: {
        proofId: string;
        generationTime: number;
        circuitConstraints: number;
        timestamp: Date;
        proverId: string;
    };
    verificationKey?: Uint8Array;
}
export interface StorageStats {
    totalMessages: number;
    totalSessions: number;
    totalProofs: number;
    totalConversations: number;
    storageSize: number;
    encrypted: boolean;
    lastCompaction: Date | null;
    dbPath: string;
}
export interface StorageConfig {
    dataPath: string;
    encryptionKey?: Uint8Array;
    enableEncryption: boolean;
    cacheSize: number;
    maxOpenFiles: number;
    compressionEnabled: boolean;
    autoCompactInterval: number;
    messageRetentionDays: number;
    proofRetentionDays: number;
}
export interface ConversationInfo {
    id: string;
    participants: string[];
    lastMessageAt: Date;
    messageCount: number;
    unreadCount: number;
    metadata: Record<string, any>;
}
export declare class G3ZKPStorageEngine extends EventEmitter {
    private db;
    private config;
    private encryption;
    private stats;
    private initialized;
    private compactionTimer;
    private retentionTimer;
    private cache;
    private cacheMaxSize;
    constructor(config?: Partial<StorageConfig>);
    initialize(): Promise<void>;
    saveMessage(message: Message): Promise<void>;
    getMessage(id: string): Promise<Message | null>;
    getMessagesByConversation(conversationId: string, limit?: number, before?: Date): Promise<Message[]>;
    deleteMessage(id: string): Promise<boolean>;
    deleteMessagesBefore(timestamp: number): Promise<number>;
    saveSession(session: Session): Promise<void>;
    getSession(id: string): Promise<Session | null>;
    getSessionsByPeer(peerId: string): Promise<Session[]>;
    deleteSession(id: string): Promise<boolean>;
    saveProof(proof: ZKProof): Promise<void>;
    getProof(id: string): Promise<ZKProof | null>;
    getProofsByCircuit(circuitId: string, limit?: number): Promise<ZKProof[]>;
    getConversations(): Promise<ConversationInfo[]>;
    getConversation(id: string): Promise<ConversationInfo | null>;
    markMessageRead(messageId: string): Promise<void>;
    getStorageStats(): Promise<StorageStats>;
    isEncrypted(): boolean;
    exportData(): Promise<string>;
    importData(jsonData: string): Promise<{
        imported: number;
        errors: number;
    }>;
    close(): Promise<void>;
    private updateConversationInfo;
    private loadStats;
    private saveStats;
    private recalculateStats;
    private runCompaction;
    private enforceRetentionPolicies;
    private pruneCache;
    private ensureInitialized;
    private serializeMessage;
    private deserializeMessage;
    private serializeSession;
    private deserializeSession;
    private serializeProof;
    private deserializeProof;
    private uint8ArrayToBase64;
    private base64ToUint8Array;
}
//# sourceMappingURL=storage-engine.d.ts.map