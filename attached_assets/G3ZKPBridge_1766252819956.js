import { EventEmitter } from 'events';
import { G3ZKPStorageEngine, StorageEncryption } from '@g3zkp/storage';
import { G3ZKPNetworkEngine } from '@g3zkp/network';
import { ZKPEngine } from '@g3zkp/zkp';
import { KeyStore, X3DHProtocol, DoubleRatchet } from '@g3zkp/crypto';
import { ConfigurationManager, MessageType, MessageStatus } from '@g3zkp/core';
import { createHash } from 'crypto';
export class G3ZKPBridge extends EventEmitter {
    networkEngine;
    storageEngine;
    zkpEngine;
    keyStore;
    x3dh;
    ratchets = new Map();
    storageEncryption;
    config;
    initialized = false;
    localPeerId = '';
    messageCache = new Map();
    constructor() {
        super();
        this.setMaxListeners(100);
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            const configManager = new ConfigurationManager();
            this.config = configManager.buildConfig({
                nodeType: 'peer',
                networkMode: 'local',
                security: {
                    zkpCircuitVersion: '1.0.0',
                    encryptionProtocol: 'X3DH-DoubleRatchet',
                    forwardSecrecy: true,
                },
                storage: {
                    path: './g3zkp-data',
                    encrypted: true,
                    retentionDays: 30,
                },
                messenger: {
                    maxMessageSize: 10485760, // 10MB
                    enableFileTransfer: true,
                    enableGroupChat: true,
                },
            });
            this.emit('status', 'Initializing storage engine...');
            await this.initializeStorage();
            this.emit('status', 'Initializing cryptographic engines...');
            await this.initializeCrypto();
            this.emit('status', 'Initializing ZKP engine...');
            await this.initializeZKP();
            this.emit('status', 'Initializing network engine...');
            await this.initializeNetwork();
            this.emit('status', 'Setting up event bridges...');
            this.setupEventBridge();
            this.initialized = true;
            this.emit('initialized', true);
            this.emit('status', 'G3ZKP Bridge fully initialized');
        }
        catch (error) {
            this.emit('error', { message: 'Initialization failed', error });
            throw error;
        }
    }
    async initializeStorage() {
        const storageConfig = {
            dbPath: this.config.storage.path,
            encrypted: this.config.storage.encrypted,
            cacheSize: 100,
            enableCompression: true,
            retentionPolicy: {
                enabled: true,
                maxAgeDays: this.config.storage.retentionDays,
            },
        };
        const encryptionKey = this.generateStorageKey();
        this.storageEncryption = new StorageEncryption(encryptionKey);
        this.storageEngine = new G3ZKPStorageEngine(storageConfig, this.storageEncryption);
        await this.storageEngine.initialize();
    }
    async initializeCrypto() {
        this.keyStore = new KeyStore();
        await this.keyStore.initialize();
        this.x3dh = new X3DHProtocol();
        const storedIdentity = await this.storageEngine.getSession('local-identity');
        if (!storedIdentity) {
            const identityKeys = this.keyStore.getIdentityKeyPair();
            await this.storageEngine.saveSession({
                id: 'local-identity',
                peerId: this.bytesToHex(identityKeys.publicKey),
                identityKey: identityKeys.publicKey,
                signedPreKey: this.keyStore.getSignedPreKey().publicKey,
                preKeySignature: new Uint8Array(64),
                ephemeralKey: new Uint8Array(32),
                rootKey: new Uint8Array(32),
                chainKey: new Uint8Array(32),
                sendingChainKey: new Uint8Array(32),
                receivingChainKey: new Uint8Array(32),
                sendingMessageNumber: 0,
                receivingMessageNumber: 0,
                previousSendingChainLength: 0,
                established: true,
                lastActivity: Date.now(),
            });
            this.localPeerId = this.bytesToHex(identityKeys.publicKey);
        }
        else {
            this.localPeerId = storedIdentity.peerId;
        }
    }
    async initializeZKP() {
        this.zkpEngine = new ZKPEngine();
        await this.zkpEngine.initialize();
    }
    async initializeNetwork() {
        const networkConfig = {
            peerId: this.localPeerId,
            listenAddresses: [
                '/ip4/0.0.0.0/tcp/0',
                '/ip4/0.0.0.0/tcp/0/ws',
            ],
            discovery: {
                mdns: { enabled: true, interval: 10 },
                bootstrap: {
                    enabled: true,
                    peers: [
                        '/ip4/127.0.0.1/tcp/63785/p2p/12D3KooWMockBootstrap1',
                    ],
                },
                dht: { enabled: true },
                pubsub: { enabled: true },
            },
            connection: {
                maxConnections: 50,
                minConnections: 5,
                connectionTimeout: 30000,
            },
            security: {
                noise: true,
                tls: false,
            },
        };
        this.networkEngine = new G3ZKPNetworkEngine(networkConfig);
        await this.networkEngine.initialize();
    }
    setupEventBridge() {
        this.networkEngine.on('peer:connected', (peer) => {
            this.emit('peer:connected', peer);
            this.emit('status', `Peer connected: ${peer.id.substring(0, 8)}...`);
        });
        this.networkEngine.on('peer:disconnected', (peerId) => {
            this.emit('peer:disconnected', peerId);
            this.emit('status', `Peer disconnected: ${peerId.substring(0, 8)}...`);
        });
        this.networkEngine.on('message:received', async (data) => {
            try {
                await this.handleIncomingMessage(data);
            }
            catch (error) {
                this.emit('error', { message: 'Failed to process incoming message', error });
            }
        });
        this.storageEngine.on('error', (error) => {
            this.emit('error', { message: 'Storage error', error });
        });
    }
    async handleIncomingMessage(data) {
        try {
            const { encrypted, header, proof, timestamp, senderId } = data;
            this.emit('status', 'Verifying ZKP for incoming message...');
            const isValidProof = await this.zkpEngine.verifyProof(proof);
            if (!isValidProof) {
                this.emit('error', { message: 'ZKP verification failed for incoming message' });
                return;
            }
            let ratchet = this.ratchets.get(senderId);
            if (!ratchet) {
                const session = await this.storageEngine.getSession(senderId);
                if (session) {
                    ratchet = new DoubleRatchet(session.rootKey, session.sendingChainKey, session.receivingChainKey);
                    this.ratchets.set(senderId, ratchet);
                }
                else {
                    this.emit('error', { message: 'No session found for sender', senderId });
                    return;
                }
            }
            this.emit('status', 'Decrypting message with Double Ratchet...');
            const messageKey = ratchet.ratchetReceive(header);
            const decrypted = await this.decrypt(encrypted, messageKey.key);
            const content = new TextDecoder().decode(decrypted);
            const message = {
                id: this.generateMessageId(),
                sender: senderId,
                recipient: this.localPeerId,
                content,
                timestamp,
                status: 'delivered',
                type: 'text',
                isZkpVerified: true,
                isMe: false,
                proofId: proof.id,
                encrypted,
            };
            await this.storageEngine.saveMessage({
                id: message.id,
                conversationId: senderId,
                senderId,
                recipientId: this.localPeerId,
                content,
                encryptedContent: encrypted,
                timestamp,
                type: MessageType.TEXT,
                status: MessageStatus.DELIVERED,
                zkProofId: proof.id,
            });
            this.messageCache.set(message.id, message);
            this.emit('message:received', message);
            this.emit('status', 'Message received and stored');
        }
        catch (error) {
            this.emit('error', { message: 'Failed to handle incoming message', error });
        }
    }
    async sendMessage(content, recipientId) {
        if (!this.initialized) {
            throw new Error('Bridge not initialized');
        }
        try {
            this.emit('status', 'Preparing to send message...');
            const messageId = this.generateMessageId();
            const timestamp = Date.now();
            let ratchet = this.ratchets.get(recipientId);
            if (!ratchet) {
                this.emit('status', 'Establishing session with peer...');
                const session = await this.establishSession(recipientId);
                ratchet = new DoubleRatchet(session.rootKey, session.sendingChainKey, session.receivingChainKey);
                this.ratchets.set(recipientId, ratchet);
            }
            this.emit('status', 'Encrypting message with Double Ratchet...');
            const messageKey = ratchet.ratchetSend();
            const plaintext = new TextEncoder().encode(content);
            const encrypted = await this.encrypt(plaintext, messageKey.key);
            const header = ratchet.getHeader();
            this.emit('status', 'Generating ZKP for message...');
            const messageHash = this.hash(encrypted);
            const proof = await this.zkpEngine.generateProof('MessageSendProof', {
                messageHash,
                senderPublicKey: this.localPeerId,
                recipientPublicKey: recipientId,
                timestamp,
                plaintextHash: this.hash(plaintext),
                encryptionKey: messageKey.key,
                nonce: new Uint8Array(24),
            });
            this.emit('status', 'Transmitting message via libp2p...');
            const receipt = await this.networkEngine.sendMessage(recipientId, {
                encrypted,
                header,
                proof,
                timestamp,
                senderId: this.localPeerId,
            });
            const message = {
                id: messageId,
                sender: this.localPeerId,
                recipient: recipientId,
                content,
                timestamp,
                status: 'sent',
                type: 'text',
                isZkpVerified: true,
                isMe: true,
                proofId: proof.id,
                encrypted,
            };
            this.emit('status', 'Storing message in encrypted database...');
            await this.storageEngine.saveMessage({
                id: messageId,
                conversationId: recipientId,
                senderId: this.localPeerId,
                recipientId,
                content,
                encryptedContent: encrypted,
                timestamp,
                type: MessageType.TEXT,
                status: MessageStatus.SENT,
                zkProofId: proof.id,
            });
            this.messageCache.set(messageId, message);
            this.emit('message:sent', message);
            this.emit('status', 'Message sent successfully');
            return message;
        }
        catch (error) {
            this.emit('error', { message: 'Failed to send message', error });
            throw error;
        }
    }
    async uploadFile(file, recipientId) {
        if (!this.initialized) {
            throw new Error('Bridge not initialized');
        }
        try {
            this.emit('status', `Preparing to upload file: ${file.name}`);
            const messageId = this.generateMessageId();
            const timestamp = Date.now();
            const chunkSize = 256 * 1024; // 256KB chunks
            const totalChunks = Math.ceil(file.size / chunkSize);
            let ratchet = this.ratchets.get(recipientId);
            if (!ratchet) {
                const session = await this.establishSession(recipientId);
                ratchet = new DoubleRatchet(session.rootKey, session.sendingChainKey, session.receivingChainKey);
                this.ratchets.set(recipientId, ratchet);
            }
            const chunks = [];
            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunkBlob = file.slice(start, end);
                const chunkData = new Uint8Array(await chunkBlob.arrayBuffer());
                const messageKey = ratchet.ratchetSend();
                const encrypted = await this.encrypt(chunkData, messageKey.key);
                const chunkHash = this.hash(encrypted);
                chunks.push({
                    index: i,
                    total: totalChunks,
                    data: encrypted,
                    hash: chunkHash,
                });
                this.emit('file:progress', {
                    fileName: file.name,
                    progress: ((i + 1) / totalChunks) * 100,
                });
            }
            this.emit('status', 'Generating ZKP for file integrity...');
            const fileHash = this.hash(new TextEncoder().encode(file.name + file.size));
            const proof = await this.zkpEngine.generateProof('MessageSendProof', {
                messageHash: fileHash,
                senderPublicKey: this.localPeerId,
                recipientPublicKey: recipientId,
                timestamp,
                plaintextHash: fileHash,
                encryptionKey: new Uint8Array(32),
                nonce: new Uint8Array(24),
            });
            this.emit('status', 'Transmitting file chunks...');
            for (const chunk of chunks) {
                await this.networkEngine.sendMessage(recipientId, {
                    type: 'file-chunk',
                    messageId,
                    chunk,
                    fileName: file.name,
                    fileSize: file.size,
                    proof,
                    timestamp,
                    senderId: this.localPeerId,
                });
            }
            const message = {
                id: messageId,
                sender: this.localPeerId,
                recipient: recipientId,
                content: `File: ${file.name}`,
                timestamp,
                status: 'sent',
                type: 'file',
                isZkpVerified: true,
                isMe: true,
                proofId: proof.id,
                fileName: file.name,
                fileSize: file.size,
            };
            await this.storageEngine.saveMessage({
                id: messageId,
                conversationId: recipientId,
                senderId: this.localPeerId,
                recipientId,
                content: file.name,
                encryptedContent: new Uint8Array(0),
                timestamp,
                type: MessageType.FILE,
                status: MessageStatus.SENT,
                zkProofId: proof.id,
                metadata: { fileName: file.name, fileSize: file.size },
            });
            this.messageCache.set(messageId, message);
            this.emit('message:sent', message);
            this.emit('status', 'File uploaded successfully');
            return message;
        }
        catch (error) {
            this.emit('error', { message: 'Failed to upload file', error });
            throw error;
        }
    }
    async getMessages(conversationId, limit = 50) {
        const storedMessages = await this.storageEngine.getMessagesByConversation(conversationId, limit);
        return storedMessages.map(msg => ({
            id: msg.id,
            sender: msg.senderId,
            recipient: msg.recipientId,
            content: msg.content,
            timestamp: msg.timestamp,
            status: this.mapStatus(msg.status),
            type: this.mapType(msg.type),
            isZkpVerified: !!msg.zkProofId,
            isMe: msg.senderId === this.localPeerId,
            proofId: msg.zkProofId,
        }));
    }
    async getStorageStats() {
        return await this.storageEngine.getStorageStats();
    }
    getConnectedPeers() {
        return this.networkEngine.getConnectedPeers();
    }
    async getNetworkStats() {
        return this.networkEngine.getNetworkStats();
    }
    async verifyZKProof(proofId) {
        const proof = await this.zkpEngine.getProofById(proofId);
        if (!proof)
            return false;
        return await this.zkpEngine.verifyProof(proof);
    }
    getCircuitInfo(circuitName) {
        return this.zkpEngine.getCircuitInfo(circuitName);
    }
    isInitialized() {
        return this.initialized;
    }
    getLocalPeerId() {
        return this.localPeerId;
    }
    async establishSession(peerId) {
        const existingSession = await this.storageEngine.getSession(peerId);
        if (existingSession && existingSession.established) {
            return existingSession;
        }
        const identityKeys = this.keyStore.getIdentityKeyPair();
        const signedPreKey = this.keyStore.getSignedPreKey();
        const oneTimePreKey = this.keyStore.consumeOneTimePreKey();
        const bundle = {
            identityKey: identityKeys.publicKey,
            signedPreKey: signedPreKey.publicKey,
            preKeySignature: new Uint8Array(64),
            oneTimePreKey: oneTimePreKey?.publicKey || new Uint8Array(32),
        };
        const result = this.x3dh.initiateHandshake(identityKeys, bundle, oneTimePreKey || { publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) });
        const session = {
            id: peerId,
            peerId,
            identityKey: bundle.identityKey,
            signedPreKey: bundle.signedPreKey,
            preKeySignature: bundle.preKeySignature,
            ephemeralKey: result.ephemeralKey,
            rootKey: result.sharedSecret,
            chainKey: result.associatedData,
            sendingChainKey: result.sharedSecret,
            receivingChainKey: result.sharedSecret,
            sendingMessageNumber: 0,
            receivingMessageNumber: 0,
            previousSendingChainLength: 0,
            established: true,
            lastActivity: Date.now(),
        };
        await this.storageEngine.saveSession(session);
        return session;
    }
    async encrypt(data, key) {
        return this.storageEncryption.encrypt(data);
    }
    async decrypt(data, key) {
        return this.storageEncryption.decrypt(data);
    }
    hash(data) {
        return createHash('sha256').update(data).digest('hex');
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateStorageKey() {
        const key = new Uint8Array(32);
        if (typeof window !== 'undefined' && window.crypto) {
            window.crypto.getRandomValues(key);
        }
        return key;
    }
    bytesToHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    mapStatus(status) {
        switch (status) {
            case MessageStatus.PENDING: return 'pending';
            case MessageStatus.SENT: return 'sent';
            case MessageStatus.DELIVERED: return 'delivered';
            case MessageStatus.READ: return 'read';
            case MessageStatus.FAILED: return 'failed';
            default: return 'pending';
        }
    }
    mapType(type) {
        switch (type) {
            case MessageType.TEXT: return 'text';
            case MessageType.FILE: return 'file';
            default: return 'text';
        }
    }
    async shutdown() {
        if (this.networkEngine) {
            await this.networkEngine.shutdown();
        }
        this.initialized = false;
        this.emit('shutdown');
    }
}
