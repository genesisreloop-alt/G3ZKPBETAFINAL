export declare class StorageEncryption {
    private key;
    constructor(key: Uint8Array);
    static generateKey(): Uint8Array;
    static keyFromPassword(password: string, salt?: Uint8Array): Uint8Array;
    private static sha256Simple;
    private static padMessage;
    private static rightRotate;
    encrypt(plaintext: string): string;
    decrypt(encryptedData: string): string;
    encryptBytes(plaintext: Uint8Array): Uint8Array;
    decryptBytes(encryptedData: Uint8Array): Uint8Array;
    rotateKey(newKey: Uint8Array): void;
    exportKey(): Uint8Array;
    static getKeyLength(): number;
    static getNonceLength(): number;
}
export declare class EncryptedBackup {
    private encryption;
    constructor(key: Uint8Array);
    createBackup(data: Record<string, any>): string;
    restoreBackup(backupString: string): Record<string, any>;
    private compress;
    private decompress;
    private calculateChecksum;
}
export declare class SecureKeyStore {
    private keys;
    private masterKey;
    constructor(masterKey: Uint8Array);
    storeKey(keyId: string, key: Uint8Array, expiresInMs?: number): void;
    retrieveKey(keyId: string): Uint8Array | null;
    deleteKey(keyId: string): boolean;
    listKeys(): string[];
    cleanupExpiredKeys(): number;
    rotateKey(keyId: string): Uint8Array | null;
    exportEncrypted(): string;
    importEncrypted(jsonData: string): number;
}
//# sourceMappingURL=storage-encryption.d.ts.map