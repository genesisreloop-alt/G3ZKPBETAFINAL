export interface EncryptedData {
    ciphertext: Uint8Array;
    nonce: Uint8Array;
}
export declare function encrypt(plaintext: Uint8Array, key: Uint8Array): EncryptedData;
export declare function decrypt(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
export declare function encryptWithAD(plaintext: Uint8Array, key: Uint8Array, associatedData: Uint8Array): EncryptedData;
//# sourceMappingURL=aead.d.ts.map