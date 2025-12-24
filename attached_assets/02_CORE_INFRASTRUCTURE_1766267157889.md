# G3ZKP Implementation Plan - Part 02
## Core Infrastructure

---

## 1. CORE TYPES

**File: `packages/core/src/types.ts`**

```typescript
// Complete type definitions - NO STUBS

export enum NodeType {
  MOBILE = "mobile",
  DESKTOP = "desktop", 
  PWA = "pwa",
  RELAY = "relay",
  VERIFIER = "verifier"
}

export enum NetworkMode {
  LOCAL_P2P = "local_p2p",
  IPFS_PUBSUB = "ipfs_pubsub",
  HYBRID = "hybrid",
  OFFLINE = "offline"
}

export enum MessageType {
  TEXT = "text",
  FILE = "file",
  IMAGE = "image",
  AUDIO = "audio",
  VIDEO = "video",
  SYSTEM = "system"
}

export enum MessageStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed"
}

export interface G3ZKPConfig {
  node: {
    type: NodeType;
    id: string;
    version: string;
    capabilities: string[];
    publicKey: Uint8Array;
  };
  network: {
    mode: NetworkMode;
    bootstrapNodes: string[];
    enableRelay: boolean;
    enableNatTraversal: boolean;
    maxConnections: number;
    connectionTimeout: number;
  };
  security: {
    zkpCircuitVersion: string;
    encryptionProtocol: string;
    forwardSecrecy: boolean;
    postCompromiseSecurity: boolean;
    auditLevel: "basic" | "standard" | "paranoid";
    keyRotationInterval: number;
  };
  storage: {
    messageRetentionDays: number;
    maxMessageSize: number;
    enableEphemeral: boolean;
    cacheSize: number;
    encryptAtRest: boolean;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  sender: Uint8Array;
  recipient: Uint8Array;
  content: Uint8Array;
  contentType: MessageType;
  timestamp: Date;
  hash: string;
  status: MessageStatus;
  metadata: {
    encryptionVersion: string;
    zkpProofId?: string;
    ephemeral: boolean;
    expiresAt?: Date;
  };
}

export interface EncryptedMessage {
  ciphertext: Uint8Array;
  mac: Uint8Array;
  header: {
    ratchetPublicKey: Uint8Array;
    previousChainLength: number;
    messageNumber: number;
  };
  metadata: {
    messageId: string;
    encryptionVersion: string;
    timestamp: Date;
    keyId: string;
  };
}

export interface ZKProof {
  circuitId: string;
  proof: Uint8Array;
  publicSignals: bigint[];
  metadata: {
    proofId: string;
    generationTime: number;
    circuitConstraints: number;
    timestamp: Date;
    proverId: string;
  };
  verificationKey?: Uint8Array;
}

export interface Session {
  id: string;
  identityKey: Uint8Array;
  ephemeralKey: Uint8Array;
  chainKey: Uint8Array;
  previousChainKey: Uint8Array;
  currentRatchetKey: { publicKey: Uint8Array; secretKey: Uint8Array };
  messageNumber: number;
  previousChainLength: number;
  keyId: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface PeerInfo {
  id: string;
  addresses: string[];
  protocols: string[];
  metadata: {
    discoveryMethod: string;
    lastSeen: Date;
    latency?: number;
  };
}

export interface MessageReceipt {
  messageId: string;
  recipientId: string;
  timestamp: Date;
  status: "sent" | "delivered" | "published" | "failed";
  method: "direct" | "pubsub" | "relay";
}
```

---

## 2. CONFIGURATION MANAGER

**File: `packages/core/src/config.ts`**

```typescript
import { G3ZKPConfig, NodeType, NetworkMode } from './types';
import { generateNodeId } from './utils/hash';

const DEFAULT_BOOTSTRAP = [
  "/dns4/bootstrap1.g3zkp.net/tcp/443/wss/p2p/12D3KooWGzBsJNN",
  "/dns4/bootstrap2.g3zkp.net/tcp/443/wss/p2p/12D3KooWJnVjJ8c"
];

export class ConfigurationManager {
  private config: G3ZKPConfig;

  constructor(partial: Partial<G3ZKPConfig> = {}) {
    this.config = this.buildConfig(partial);
  }

  private buildConfig(partial: Partial<G3ZKPConfig>): G3ZKPConfig {
    return {
      node: {
        type: partial.node?.type ?? NodeType.PWA,
        id: partial.node?.id ?? generateNodeId(),
        version: partial.node?.version ?? "1.0.0",
        capabilities: partial.node?.capabilities ?? ["messaging", "zkp", "p2p"],
        publicKey: partial.node?.publicKey ?? new Uint8Array(32)
      },
      network: {
        mode: partial.network?.mode ?? NetworkMode.HYBRID,
        bootstrapNodes: partial.network?.bootstrapNodes ?? DEFAULT_BOOTSTRAP,
        enableRelay: partial.network?.enableRelay ?? true,
        enableNatTraversal: partial.network?.enableNatTraversal ?? true,
        maxConnections: partial.network?.maxConnections ?? 50,
        connectionTimeout: partial.network?.connectionTimeout ?? 30000
      },
      security: {
        zkpCircuitVersion: partial.security?.zkpCircuitVersion ?? "g3zkp-v1.0",
        encryptionProtocol: partial.security?.encryptionProtocol ?? "x25519-chacha20poly1305",
        forwardSecrecy: partial.security?.forwardSecrecy ?? true,
        postCompromiseSecurity: partial.security?.postCompromiseSecurity ?? true,
        auditLevel: partial.security?.auditLevel ?? "standard",
        keyRotationInterval: partial.security?.keyRotationInterval ?? 86400000
      },
      storage: {
        messageRetentionDays: partial.storage?.messageRetentionDays ?? 30,
        maxMessageSize: partial.storage?.maxMessageSize ?? 10 * 1024 * 1024,
        enableEphemeral: partial.storage?.enableEphemeral ?? false,
        cacheSize: partial.storage?.cacheSize ?? 100 * 1024 * 1024,
        encryptAtRest: partial.storage?.encryptAtRest ?? true
      }
    };
  }

  getConfig(): G3ZKPConfig { return { ...this.config }; }
  
  static fromEnvironment(): ConfigurationManager {
    return new ConfigurationManager({
      node: {
        type: process.env.G3ZKP_NODE_TYPE as NodeType,
        id: process.env.G3ZKP_NODE_ID
      },
      network: {
        mode: process.env.G3ZKP_NETWORK_MODE as NetworkMode,
        maxConnections: parseInt(process.env.G3ZKP_MAX_CONNECTIONS || "50")
      }
    });
  }
}
```

---

## 3. UTILITY FUNCTIONS

**File: `packages/core/src/utils/hash.ts`**

```typescript
import { createHash, randomBytes } from 'crypto';
import { blake2b } from 'blakejs';

export function sha256(data: Uint8Array | string): string {
  const input = typeof data === 'string' ? Buffer.from(data) : data;
  return createHash('sha256').update(input).digest('hex');
}

export function sha256Bytes(data: Uint8Array | string): Uint8Array {
  const input = typeof data === 'string' ? Buffer.from(data) : data;
  return new Uint8Array(createHash('sha256').update(input).digest());
}

export function blake2b256(data: Uint8Array | string): Uint8Array {
  const input = typeof data === 'string' ? Buffer.from(data) : data;
  return blake2b(input, undefined, 32);
}

export function generateNodeId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(16).toString('hex');
  return sha256(`${timestamp}-${random}`).substring(0, 32);
}

export function generateMessageId(): string {
  return sha256(Date.now().toString() + randomBytes(8).toString('hex')).substring(0, 24);
}

export function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
```

**File: `packages/core/src/utils/encoding.ts`**

```typescript
export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function uint8ArrayToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
```

---

## 4. EVENT SYSTEM

**File: `packages/core/src/events.ts`**

```typescript
type EventHandler<T> = (data: T) => void | Promise<void>;

export class EventEmitter<Events extends Record<string, any>> {
  private handlers = new Map<keyof Events, Set<EventHandler<any>>>();

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error);
        }
      }
    }
  }

  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const onceHandler: EventHandler<Events[K]> = (data) => {
      this.off(event, onceHandler);
      handler(data);
    };
    this.on(event, onceHandler);
  }
}
```

---

## 5. ERROR HANDLING

**File: `packages/core/src/errors.ts`**

```typescript
export class G3ZKPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'G3ZKPError';
  }
}

export class SecurityError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SECURITY_ERROR', details);
    this.name = 'SecurityError';
  }
}

export class NetworkError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class CryptoError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CRYPTO_ERROR', details);
    this.name = 'CryptoError';
  }
}

export class ZKPError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ZKP_ERROR', details);
    this.name = 'ZKPError';
  }
}

export class ValidationError extends G3ZKPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}
```

---

## 6. MAIN APPLICATION CLASS

**File: `packages/core/src/g3zkp.ts`**

```typescript
import { G3ZKPConfig, Message, EncryptedMessage, MessageReceipt } from './types';
import { ConfigurationManager } from './config';
import { EventEmitter } from './events';

interface G3ZKPEvents {
  'message:received': Message;
  'message:sent': MessageReceipt;
  'connection:established': { peerId: string };
  'connection:closed': { peerId: string };
  'error': Error;
}

export class G3ZKPApplication extends EventEmitter<G3ZKPEvents> {
  private config: G3ZKPConfig;
  private initialized = false;
  private components: Map<string, any> = new Map();

  constructor(config?: Partial<G3ZKPConfig>) {
    super();
    this.config = new ConfigurationManager(config).getConfig();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize components in dependency order
    // Components will be imported dynamically from other packages
    console.log(`Initializing G3ZKP node: ${this.config.node.id}`);
    
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    
    // Shutdown in reverse order
    for (const [name, component] of [...this.components].reverse()) {
      await component.shutdown?.();
    }
    
    this.initialized = false;
  }

  getConfig(): G3ZKPConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
```

---

*Next: Part 03 - Cryptographic Engine*
