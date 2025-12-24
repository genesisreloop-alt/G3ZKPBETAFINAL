# G3ZKP Implementation Plan - Part 03
## Cryptographic Engine

---

## 1. KEY GENERATION & MANAGEMENT

**File: `packages/crypto/src/key-store.ts`**

```typescript
import { box, sign, randomBytes } from 'tweetnacl';
import { sha256Bytes } from '@g3zkp/core';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface IdentityKeys {
  identityKeyPair: KeyPair;
  signingKeyPair: KeyPair;
  keyId: string;
  createdAt: Date;
}

export class KeyStore {
  private identityKeys: IdentityKeys | null = null;
  private preKeys: Map<string, KeyPair> = new Map();
  private signedPreKey: KeyPair | null = null;
  private oneTimePreKeys: KeyPair[] = [];

  async initialize(): Promise<void> {
    if (!this.identityKeys) {
      await this.generateIdentityKeys();
    }
    if (!this.signedPreKey) {
      await this.generateSignedPreKey();
    }
    if (this.oneTimePreKeys.length < 100) {
      await this.generateOneTimePreKeys(100 - this.oneTimePreKeys.length);
    }
  }

  async generateIdentityKeys(): Promise<IdentityKeys> {
    const identityKeyPair = box.keyPair();
    const signingKeyPair = sign.keyPair();
    const keyId = this.generateKeyId(identityKeyPair.publicKey);

    this.identityKeys = {
      identityKeyPair: {
        publicKey: identityKeyPair.publicKey,
        secretKey: identityKeyPair.secretKey
      },
      signingKeyPair: {
        publicKey: signingKeyPair.publicKey,
        secretKey: signingKeyPair.secretKey
      },
      keyId,
      createdAt: new Date()
    };

    return this.identityKeys;
  }

  async generateSignedPreKey(): Promise<KeyPair> {
    const keyPair = box.keyPair();
    this.signedPreKey = {
      publicKey: keyPair.publicKey,
      secretKey: keyPair.secretKey
    };
    return this.signedPreKey;
  }

  async generateOneTimePreKeys(count: number): Promise<KeyPair[]> {
    const newKeys: KeyPair[] = [];
    for (let i = 0; i < count; i++) {
      const keyPair = box.keyPair();
      newKeys.push({
        publicKey: keyPair.publicKey,
        secretKey: keyPair.secretKey
      });
    }
    this.oneTimePreKeys.push(...newKeys);
    return newKeys;
  }

  getIdentityKey(): Uint8Array {
    if (!this.identityKeys) throw new Error('Keys not initialized');
    return this.identityKeys.identityKeyPair.publicKey;
  }

  getIdentityKeyPair(): KeyPair {
    if (!this.identityKeys) throw new Error('Keys not initialized');
    return this.identityKeys.identityKeyPair;
  }

  getSigningKeyPair(): KeyPair {
    if (!this.identityKeys) throw new Error('Keys not initialized');
    return this.identityKeys.signingKeyPair;
  }

  getSignedPreKey(): KeyPair {
    if (!this.signedPreKey) throw new Error('Signed pre-key not generated');
    return this.signedPreKey;
  }

  consumeOneTimePreKey(): KeyPair | undefined {
    return this.oneTimePreKeys.shift();
  }

  private generateKeyId(publicKey: Uint8Array): string {
    return Buffer.from(sha256Bytes(publicKey)).toString('hex').substring(0, 16);
  }

  hasIdentityKey(): boolean {
    return this.identityKeys !== null;
  }
}
```

---

## 2. X3DH KEY AGREEMENT

**File: `packages/crypto/src/x3dh.ts`**

```typescript
import { box } from 'tweetnacl';
import { hkdf } from './kdf';
import { KeyPair, KeyStore } from './key-store';
import { concatUint8Arrays } from '@g3zkp/core';

export interface X3DHBundle {
  identityKey: Uint8Array;
  signedPreKey: Uint8Array;
  signedPreKeySignature: Uint8Array;
  oneTimePreKey?: Uint8Array;
}

export interface X3DHResult {
  sharedSecret: Uint8Array;
  ephemeralKey: Uint8Array;
  usedOneTimePreKey: boolean;
}

export class X3DHProtocol {
  constructor(private keyStore: KeyStore) {}

  async initiateHandshake(recipientBundle: X3DHBundle): Promise<X3DHResult> {
    const identityKeyPair = this.keyStore.getIdentityKeyPair();
    const ephemeralKeyPair = box.keyPair();

    // DH1 = DH(IK_A, SPK_B)
    const dh1 = box.before(recipientBundle.signedPreKey, identityKeyPair.secretKey);

    // DH2 = DH(EK_A, IK_B)
    const dh2 = box.before(recipientBundle.identityKey, ephemeralKeyPair.secretKey);

    // DH3 = DH(EK_A, SPK_B)
    const dh3 = box.before(recipientBundle.signedPreKey, ephemeralKeyPair.secretKey);

    // DH4 = DH(EK_A, OPK_B) if available
    let dh4 = new Uint8Array(0);
    let usedOneTimePreKey = false;
    if (recipientBundle.oneTimePreKey) {
      dh4 = box.before(recipientBundle.oneTimePreKey, ephemeralKeyPair.secretKey);
      usedOneTimePreKey = true;
    }

    // Combine DH outputs
    const dhOutput = concatUint8Arrays(dh1, dh2, dh3, dh4);

    // Derive shared secret using HKDF
    const sharedSecret = await hkdf(
      dhOutput,
      32,
      new TextEncoder().encode('x3dh-shared-secret'),
      'SHA-256'
    );

    return {
      sharedSecret,
      ephemeralKey: ephemeralKeyPair.publicKey,
      usedOneTimePreKey
    };
  }

  async respondToHandshake(
    senderIdentityKey: Uint8Array,
    senderEphemeralKey: Uint8Array,
    usedOneTimePreKey: boolean,
    oneTimePreKeySecret?: Uint8Array
  ): Promise<Uint8Array> {
    const identityKeyPair = this.keyStore.getIdentityKeyPair();
    const signedPreKey = this.keyStore.getSignedPreKey();

    // DH1 = DH(SPK_B, IK_A)
    const dh1 = box.before(senderIdentityKey, signedPreKey.secretKey);

    // DH2 = DH(IK_B, EK_A)
    const dh2 = box.before(senderEphemeralKey, identityKeyPair.secretKey);

    // DH3 = DH(SPK_B, EK_A)
    const dh3 = box.before(senderEphemeralKey, signedPreKey.secretKey);

    // DH4 = DH(OPK_B, EK_A) if used
    let dh4 = new Uint8Array(0);
    if (usedOneTimePreKey && oneTimePreKeySecret) {
      dh4 = box.before(senderEphemeralKey, oneTimePreKeySecret);
    }

    const dhOutput = concatUint8Arrays(dh1, dh2, dh3, dh4);

    return await hkdf(
      dhOutput,
      32,
      new TextEncoder().encode('x3dh-shared-secret'),
      'SHA-256'
    );
  }
}
```

---

## 3. DOUBLE RATCHET PROTOCOL

**File: `packages/crypto/src/double-ratchet.ts`**

```typescript
import { box } from 'tweetnacl';
import { hkdf } from './kdf';
import { KeyPair } from './key-store';
import { concatUint8Arrays } from '@g3zkp/core';

export interface MessageKey {
  key: Uint8Array;
  number: number;
  ratchetPublicKey: Uint8Array;
}

export interface RatchetHeader {
  ratchetPublicKey: Uint8Array;
  previousChainLength: number;
  messageNumber: number;
}

export class DoubleRatchet {
  private rootKey: Uint8Array;
  private sendingChainKey: Uint8Array;
  private receivingChainKey: Uint8Array;
  private sendingRatchetKey: KeyPair;
  private receivingRatchetKey: Uint8Array | null = null;
  private sendingMessageNumber = 0;
  private receivingMessageNumber = 0;
  private previousSendingChainLength = 0;
  private skippedMessageKeys: Map<string, Uint8Array> = new Map();

  constructor(initialRootKey: Uint8Array) {
    this.rootKey = initialRootKey;
    this.sendingChainKey = initialRootKey;
    this.receivingChainKey = initialRootKey;
    this.sendingRatchetKey = {
      publicKey: box.keyPair().publicKey,
      secretKey: box.keyPair().secretKey
    };
  }

  async ratchetSend(): Promise<MessageKey> {
    const messageNumber = this.sendingMessageNumber++;

    const messageKey = await this.deriveChainKey(
      this.sendingChainKey,
      'message',
      messageNumber
    );

    this.sendingChainKey = await this.deriveChainKey(
      this.sendingChainKey,
      'chain',
      messageNumber
    );

    return {
      key: messageKey,
      number: messageNumber,
      ratchetPublicKey: this.sendingRatchetKey.publicKey
    };
  }

  async ratchetReceive(header: RatchetHeader): Promise<MessageKey> {
    if (!this.receivingRatchetKey || 
        !this.compareKeys(this.receivingRatchetKey, header.ratchetPublicKey)) {
      await this.performDHRatchet(header.ratchetPublicKey);
    }

    const skippedKey = this.getSkippedMessageKey(
      header.ratchetPublicKey,
      header.messageNumber
    );
    if (skippedKey) {
      return {
        key: skippedKey,
        number: header.messageNumber,
        ratchetPublicKey: header.ratchetPublicKey
      };
    }

    while (this.receivingMessageNumber < header.messageNumber) {
      const skipped = await this.deriveChainKey(
        this.receivingChainKey,
        'message',
        this.receivingMessageNumber
      );
      this.storeSkippedMessageKey(
        header.ratchetPublicKey,
        this.receivingMessageNumber,
        skipped
      );
      this.receivingChainKey = await this.deriveChainKey(
        this.receivingChainKey,
        'chain',
        this.receivingMessageNumber
      );
      this.receivingMessageNumber++;
    }

    const messageKey = await this.deriveChainKey(
      this.receivingChainKey,
      'message',
      header.messageNumber
    );

    this.receivingChainKey = await this.deriveChainKey(
      this.receivingChainKey,
      'chain',
      header.messageNumber
    );
    this.receivingMessageNumber++;

    return {
      key: messageKey,
      number: header.messageNumber,
      ratchetPublicKey: header.ratchetPublicKey
    };
  }

  private async performDHRatchet(theirRatchetKey: Uint8Array): Promise<void> {
    this.previousSendingChainLength = this.sendingMessageNumber;
    this.sendingMessageNumber = 0;
    this.receivingMessageNumber = 0;

    this.receivingRatchetKey = theirRatchetKey;

    const dhResult = box.before(theirRatchetKey, this.sendingRatchetKey.secretKey);

    const derived = await hkdf(
      concatUint8Arrays(this.rootKey, dhResult),
      64,
      new TextEncoder().encode('ratchet-step'),
      'SHA-256'
    );

    this.rootKey = derived.slice(0, 32);
    this.receivingChainKey = derived.slice(32, 64);

    this.sendingRatchetKey = {
      publicKey: box.keyPair().publicKey,
      secretKey: box.keyPair().secretKey
    };

    const dhResult2 = box.before(theirRatchetKey, this.sendingRatchetKey.secretKey);
    const derived2 = await hkdf(
      concatUint8Arrays(this.rootKey, dhResult2),
      64,
      new TextEncoder().encode('ratchet-step'),
      'SHA-256'
    );

    this.rootKey = derived2.slice(0, 32);
    this.sendingChainKey = derived2.slice(32, 64);
  }

  private async deriveChainKey(
    chainKey: Uint8Array,
    type: 'message' | 'chain',
    index: number
  ): Promise<Uint8Array> {
    const info = new TextEncoder().encode(`${type}-key-${index}`);
    return await hkdf(chainKey, 32, info, 'SHA-256');
  }

  private compareKeys(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
    return result === 0;
  }

  private storeSkippedMessageKey(
    ratchetKey: Uint8Array,
    messageNumber: number,
    key: Uint8Array
  ): void {
    const id = `${Buffer.from(ratchetKey).toString('hex')}-${messageNumber}`;
    this.skippedMessageKeys.set(id, key);
    if (this.skippedMessageKeys.size > 1000) {
      const firstKey = this.skippedMessageKeys.keys().next().value;
      this.skippedMessageKeys.delete(firstKey);
    }
  }

  private getSkippedMessageKey(
    ratchetKey: Uint8Array,
    messageNumber: number
  ): Uint8Array | undefined {
    const id = `${Buffer.from(ratchetKey).toString('hex')}-${messageNumber}`;
    const key = this.skippedMessageKeys.get(id);
    if (key) this.skippedMessageKeys.delete(id);
    return key;
  }

  getHeader(): RatchetHeader {
    return {
      ratchetPublicKey: this.sendingRatchetKey.publicKey,
      previousChainLength: this.previousSendingChainLength,
      messageNumber: this.sendingMessageNumber
    };
  }
}
```

---

## 4. AEAD ENCRYPTION

**File: `packages/crypto/src/aead.ts`**

```typescript
import { secretbox, randomBytes } from 'tweetnacl';

export interface EncryptedData {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export function encrypt(plaintext: Uint8Array, key: Uint8Array): EncryptedData {
  const nonce = randomBytes(secretbox.nonceLength);
  const ciphertext = secretbox(plaintext, nonce, key);
  return { ciphertext, nonce };
}

export function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Uint8Array {
  const plaintext = secretbox.open(ciphertext, nonce, key);
  if (!plaintext) {
    throw new Error('Decryption failed: invalid ciphertext or key');
  }
  return plaintext;
}

export function encryptWithAD(
  plaintext: Uint8Array,
  key: Uint8Array,
  associatedData: Uint8Array
): EncryptedData {
  const combined = new Uint8Array(associatedData.length + plaintext.length);
  combined.set(associatedData);
  combined.set(plaintext, associatedData.length);
  return encrypt(combined, key);
}
```

---

## 5. KDF FUNCTIONS

**File: `packages/crypto/src/kdf.ts`**

```typescript
import { createHmac } from 'crypto';

export async function hkdf(
  ikm: Uint8Array,
  length: number,
  info: Uint8Array,
  hash: string = 'SHA-256'
): Promise<Uint8Array> {
  const hashLen = hash === 'SHA-256' ? 32 : 64;
  
  // Extract
  const prk = createHmac('sha256', new Uint8Array(hashLen))
    .update(ikm)
    .digest();

  // Expand
  const n = Math.ceil(length / hashLen);
  const okm = new Uint8Array(n * hashLen);
  let prev = new Uint8Array(0);

  for (let i = 0; i < n; i++) {
    const input = new Uint8Array(prev.length + info.length + 1);
    input.set(prev);
    input.set(info, prev.length);
    input[input.length - 1] = i + 1;

    prev = new Uint8Array(
      createHmac('sha256', prk).update(input).digest()
    );
    okm.set(prev, i * hashLen);
  }

  return okm.slice(0, length);
}
```

---

*Next: Part 04 - ZKP Circuit System*
