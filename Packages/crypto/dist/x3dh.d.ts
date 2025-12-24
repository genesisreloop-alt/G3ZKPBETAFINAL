interface KeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}
interface X3DHBundle {
    identityKey: Uint8Array;
    signedPreKey: Uint8Array;
    signedPreKeySignature: Uint8Array;
    oneTimePreKey?: Uint8Array;
}
interface X3DHResult {
    sharedSecret: Uint8Array;
    ephemeralKey: Uint8Array;
    usedOneTimePreKey: boolean;
}
interface KeyStore {
    getIdentityKeyPair(): KeyPair;
    getSignedPreKey(): KeyPair;
    consumeOneTimePreKey(): KeyPair | undefined;
}
export declare class X3DHProtocol {
    private keyStore;
    constructor(keyStore: KeyStore);
    initiateHandshake(recipientBundle: X3DHBundle): Promise<X3DHResult>;
    respondToHandshake(senderIdentityKey: Uint8Array, senderEphemeralKey: Uint8Array, usedOneTimePreKey: boolean, oneTimePreKeySecret?: Uint8Array): Promise<Uint8Array>;
    private deriveSharedSecret;
    private concatUint8Arrays;
}
export {};
//# sourceMappingURL=x3dh.d.ts.map