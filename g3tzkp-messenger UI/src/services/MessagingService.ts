import { io, Socket } from 'socket.io-client';
import { cryptoService, EncryptedData } from './CryptoService';
import { Message, PeerInfo } from '../types';
import { libP2PService, LibP2PMessage } from './LibP2PService';

export interface MessagePayload {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content?: string;
  encrypted?: EncryptedData;
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'file' | '3d-object';
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  fileSize?: number;
  tensorData?: {
    objectUrl: string;
    dimensions: { width: number; height: number; depth: number };
    vertices: number;
  };
  zkpProofId?: string;
  isEncrypted: boolean;
}

export type MessageHandler = (message: Message) => void;
export type PeerHandler = (peer: PeerInfo) => void;
export type ConnectionHandler = (status: 'connected' | 'disconnected' | 'error', error?: string) => void;

class MessagingService {
  private socket: Socket | null = null;
  private localPeerId: string = '';
  private localPeerName: string = 'LOCAL_OPERATOR';
  private messageHandlers: Set<MessageHandler> = new Set();
  private peerConnectHandlers: Set<PeerHandler> = new Set();
  private peerDisconnectHandlers: Set<PeerHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private connectedPeers: Map<string, PeerInfo> = new Map();
  private messageQueue: MessagePayload[] = [];
  private isConnected: boolean = false;
  private p2pMode: 'hybrid' | 'p2p-only' | 'relay-only' = 'hybrid';
  private libp2pInitialized: boolean = false;

  async initialize(serverUrl?: string): Promise<string> {
    if (!cryptoService.isInitialized()) {
      await cryptoService.initialize();
    }
    this.localPeerId = '12D3KooW' + this.generateId(32);
    
    const url = serverUrl || this.getServerUrl();
    
    return new Promise((resolve, reject) => {
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.socket!.emit('register', {
          peerId: this.localPeerId,
          peerName: this.localPeerName,
          publicKey: cryptoService.getPublicKey(),
          timestamp: Date.now()
        });
        this.notifyConnectionHandlers('connected');
        this.flushMessageQueue();
        
        this.initializeP2P().catch(err => {
          console.warn('[MessagingService] P2P initialization failed (non-fatal):', err);
        });
        
        resolve(this.localPeerId);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.notifyConnectionHandlers('disconnected');
      });

      this.socket.on('connect_error', (error) => {
        this.notifyConnectionHandlers('error', error.message);
        if (!this.isConnected) {
          resolve(this.localPeerId);
        }
      });

      this.socket.on('message', (payload: MessagePayload) => {
        this.handleIncomingMessage(payload);
      });

      this.socket.on('peer_connected', (peer: PeerInfo) => {
        this.connectedPeers.set(peer.peerId, peer);
        this.peerConnectHandlers.forEach(handler => handler(peer));
      });

      this.socket.on('peer_disconnected', (peerId: string) => {
        const peer = this.connectedPeers.get(peerId);
        if (peer) {
          this.connectedPeers.delete(peerId);
          this.peerDisconnectHandlers.forEach(handler => handler(peer));
        }
      });

      this.socket.on('peers_list', (peers: PeerInfo[]) => {
        peers.forEach(peer => {
          if (peer.peerId !== this.localPeerId) {
            this.connectedPeers.set(peer.peerId, peer);
          }
        });
      });

      setTimeout(() => {
        if (!this.isConnected) {
          this.initializeP2P().catch(err => {
            console.warn('[MessagingService] P2P initialization failed (offline mode):', err);
          });
          resolve(this.localPeerId);
        }
      }, 3000);
    });
  }

  private getServerUrl(): string {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isSecure = window.location.protocol === 'https:';
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://${hostname}:3001`;
      }
      const port = window.location.port || (isSecure ? '443' : '80');
      return isSecure 
        ? `https://${hostname}${port !== '443' ? ':' + port : ''}`
        : `http://${hostname}${port !== '80' ? ':' + port : ''}`;
    }
    return 'http://localhost:3001';
  }

  private generateId(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private handleIncomingMessage(payload: MessagePayload): void {
    let content = payload.content || '';
    
    if (payload.isEncrypted && payload.encrypted) {
      try {
        content = cryptoService.decrypt(payload.senderId, payload.encrypted);
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        content = '[Encrypted message - decryption failed]';
      }
    }

    const message: Message = {
      id: payload.id,
      sender: payload.senderName,
      recipient: payload.recipientId,
      content,
      timestamp: payload.timestamp,
      status: 'delivered',
      type: payload.type,
      isZkpVerified: !!payload.zkpProofId,
      isMe: false,
      mediaUrl: payload.mediaUrl,
      mediaType: payload.mediaType,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      tensorData: payload.tensorData
    };

    this.messageHandlers.forEach(handler => handler(message));
  }

  async sendMessage(
    recipientId: string,
    content: string,
    options: {
      type?: 'text' | 'image' | 'video' | 'file' | '3d-object';
      encrypt?: boolean;
      mediaUrl?: string;
      mediaType?: string;
      fileName?: string;
      fileSize?: number;
      tensorData?: MessagePayload['tensorData'];
    } = {}
  ): Promise<Message> {
    const messageId = this.generateId(16);
    const timestamp = Date.now();
    
    let encrypted: EncryptedData | undefined;
    let messageContent = content;
    
    if (options.encrypt !== false && cryptoService.hasSession(recipientId)) {
      encrypted = cryptoService.encrypt(recipientId, content);
      messageContent = '[Encrypted]';
    }

    const payload: MessagePayload = {
      id: messageId,
      senderId: this.localPeerId,
      senderName: this.localPeerName,
      recipientId,
      content: encrypted ? undefined : content,
      encrypted,
      timestamp,
      type: options.type || 'text',
      mediaUrl: options.mediaUrl,
      mediaType: options.mediaType,
      fileName: options.fileName,
      fileSize: options.fileSize,
      tensorData: options.tensorData,
      isEncrypted: !!encrypted
    };

    let sentViaP2P = false;
    if (this.libp2pInitialized && this.p2pMode !== 'relay-only') {
      sentViaP2P = await this.sendViaP2P(recipientId, payload);
    }
    
    if (this.p2pMode !== 'p2p-only') {
      if (this.isConnected && this.socket) {
        this.socket.emit('message', payload);
      } else if (!sentViaP2P) {
        this.messageQueue.push(payload);
      }
    } else if (!sentViaP2P) {
      this.messageQueue.push(payload);
    }

    const message: Message = {
      id: messageId,
      sender: this.localPeerName,
      recipient: recipientId,
      content,
      timestamp,
      status: this.isConnected ? 'sent' : 'pending',
      type: options.type || 'text',
      isZkpVerified: false,
      isMe: true,
      mediaUrl: options.mediaUrl,
      mediaType: options.mediaType,
      fileName: options.fileName,
      fileSize: options.fileSize,
      tensorData: options.tensorData
    };

    return message;
  }

  async sendMediaMessage(
    recipientId: string,
    file: File,
    options: { convert3D?: boolean } = {}
  ): Promise<Message> {
    const mediaUrl = URL.createObjectURL(file);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    let type: 'image' | 'video' | 'file' | '3d-object' = 'file';
    let tensorData: MessagePayload['tensorData'] | undefined;
    
    if (isImage) {
      type = options.convert3D ? '3d-object' : 'image';
      if (options.convert3D) {
        tensorData = await this.convertTo3DObject(file);
      }
    } else if (isVideo) {
      type = options.convert3D ? '3d-object' : 'video';
      if (options.convert3D) {
        tensorData = await this.convertTo3DObject(file);
      }
    }

    return this.sendMessage(recipientId, file.name, {
      type,
      mediaUrl,
      mediaType: file.type,
      fileName: file.name,
      fileSize: file.size,
      tensorData
    });
  }

  private async convertTo3DObject(file: File): Promise<MessagePayload['tensorData']> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          resolve({
            objectUrl: url,
            dimensions: { 
              width: aspectRatio, 
              height: 1, 
              depth: 0.1 
            },
            vertices: 4
          });
        };
        img.src = url;
      } else {
        resolve({
          objectUrl: url,
          dimensions: { width: 1.78, height: 1, depth: 0.1 },
          vertices: 4
        });
      }
    });
  }

  private async flushMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return;
    
    const canUseSocket = this.isConnected && this.socket && this.p2pMode !== 'p2p-only';
    const canUseP2P = this.libp2pInitialized && this.p2pMode !== 'relay-only';
    
    if (!canUseSocket && !canUseP2P) return;
    
    const failedPayloads: MessagePayload[] = [];
    
    while (this.messageQueue.length > 0) {
      const payload = this.messageQueue.shift();
      if (!payload) continue;
      
      let sent = false;
      
      if (canUseP2P) {
        try {
          const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
          await libP2PService.sendDirectMessage(payload.recipientId, payloadBytes);
          sent = true;
          console.log('[MessagingService] Queued message sent via P2P to:', payload.recipientId);
        } catch (err) {
          console.warn('[MessagingService] P2P flush failed for:', payload.id);
        }
      }
      
      if (!sent && canUseSocket) {
        this.socket!.emit('message', payload);
        sent = true;
      }
      
      if (!sent) {
        failedPayloads.push(payload);
      }
    }
    
    if (failedPayloads.length > 0) {
      this.messageQueue.push(...failedPayloads);
    }
  }

  private notifyConnectionHandlers(status: 'connected' | 'disconnected' | 'error', error?: string): void {
    this.connectionHandlers.forEach(handler => handler(status, error));
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onPeerConnect(handler: PeerHandler): () => void {
    this.peerConnectHandlers.add(handler);
    return () => this.peerConnectHandlers.delete(handler);
  }

  onPeerDisconnect(handler: PeerHandler): () => void {
    this.peerDisconnectHandlers.add(handler);
    return () => this.peerDisconnectHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.connectedPeers.values());
  }

  getLocalPeerId(): string {
    return this.localPeerId;
  }

  getLocalPeerName(): string {
    return this.localPeerName;
  }

  setLocalPeerName(name: string): void {
    this.localPeerName = name;
    if (this.socket && this.isConnected) {
      this.socket.emit('update_name', { peerId: this.localPeerId, name });
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  getSocket(): import('socket.io-client').Socket | null {
    return this.socket;
  }

  establishSession(peerId: string, publicKey: string): void {
    cryptoService.establishSession(peerId, publicKey);
  }

  async initializeP2P(): Promise<void> {
    if (this.libp2pInitialized) {
      console.log('[MessagingService] LibP2P already initialized');
      return;
    }

    try {
      console.log('[MessagingService] Initializing LibP2P...');
      const peerId = await libP2PService.initialize();
      console.log('[MessagingService] LibP2P initialized with peerId:', peerId);
      
      libP2PService.onMessage((message: LibP2PMessage) => {
        console.log('[MessagingService] Received P2P message from:', message.from);
        this.handleP2PMessage(message);
      });

      libP2PService.onPeerConnect((peer) => {
        console.log('[MessagingService] P2P peer connected:', peer.id);
        const peerInfo: PeerInfo = {
          peerId: peer.id,
          name: peer.metadata?.name || 'P2P_PEER',
          publicKey: peer.metadata?.publicKey,
          isOnline: true,
          lastSeen: peer.lastSeen.getTime()
        };
        this.connectedPeers.set(peer.id, peerInfo);
        this.peerConnectHandlers.forEach(handler => handler(peerInfo));
      });

      libP2PService.onPeerDisconnect((peer) => {
        console.log('[MessagingService] P2P peer disconnected:', peer.id);
        const peerInfo = this.connectedPeers.get(peer.id);
        if (peerInfo) {
          this.connectedPeers.delete(peer.id);
          this.peerDisconnectHandlers.forEach(handler => handler(peerInfo));
        }
      });

      this.libp2pInitialized = true;
      console.log('[MessagingService] LibP2P fully integrated');
      
      this.flushMessageQueue().catch(err => {
        console.warn('[MessagingService] Queue flush after P2P init failed:', err);
      });
    } catch (error) {
      console.error('[MessagingService] Failed to initialize LibP2P:', error);
    }
  }

  private async sendViaP2P(recipientId: string, payload: MessagePayload): Promise<boolean> {
    if (!this.libp2pInitialized || this.p2pMode === 'relay-only') {
      return false;
    }

    try {
      const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
      await libP2PService.sendDirectMessage(recipientId, payloadBytes);
      console.log('[MessagingService] Message sent via P2P to:', recipientId);
      return true;
    } catch (error) {
      console.warn('[MessagingService] P2P send failed, falling back to relay:', error);
      return false;
    }
  }

  private handleP2PMessage(message: LibP2PMessage): void {
    try {
      const payloadJson = new TextDecoder().decode(message.data);
      const payload: MessagePayload = JSON.parse(payloadJson);
      this.handleIncomingMessage(payload);
    } catch (error) {
      console.error('[MessagingService] Failed to parse P2P message:', error);
    }
  }

  setP2PMode(mode: 'hybrid' | 'p2p-only' | 'relay-only'): void {
    this.p2pMode = mode;
    console.log('[MessagingService] P2P mode set to:', mode);
  }

  getP2PMode(): 'hybrid' | 'p2p-only' | 'relay-only' {
    return this.p2pMode;
  }

  isP2PInitialized(): boolean {
    return this.libp2pInitialized;
  }

  async getP2PStats(): Promise<{ peerId: string; connectedPeers: number; uptime: number } | null> {
    if (!this.libp2pInitialized) return null;
    return libP2PService.getStats();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.libp2pInitialized) {
      libP2PService.stop();
      this.libp2pInitialized = false;
    }
    this.isConnected = false;
    this.connectedPeers.clear();
  }
}

export const messagingService = new MessagingService();
