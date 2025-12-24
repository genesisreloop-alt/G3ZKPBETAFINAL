interface KeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}
interface IdentityKeys {
    identityKeyPair: KeyPair;
    signingKeyPair: KeyPair;
    keyId: string;
    createdAt: Date;
}
export declare class KeyStore {
    private identityKeys;
    private preKeys;
    private signedPreKey;
    private oneTimePreKeys;
    initialize(): Promise<void>;
    generateIdentityKeys(): Promise<IdentityKeys>;
    generateSignedPreKey(): Promise<KeyPair>;
    generateOneTimePreKeys(count: number): Promise<KeyPair[]>;
    getIdentityKey(): Uint8Array;
    getIdentityKeyPair(): KeyPair;
    getSigningKeyPair(): KeyPair;
    getSignedPreKey(): KeyPair;
    consumeOneTimePreKey(): KeyPair | undefined;
    private generateKeyId;
    hasIdentityKey(): boolean;
}
export {};
//# sourceMappingURL=key-store.d.ts.map