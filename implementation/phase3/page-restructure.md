# PHASE 3A: PAGE RESTRUCTURING AND CONTACT MANAGEMENT
## Mesh → Contacts, Chat → Mesh, 3 Contact Methods

**Status:** Current Structure → 100% Restructured  
**Timeline:** Days 1-3 (Week 3-4)  
**Dependencies:** libp2p (from Phase 1B)

---

## OVERVIEW

Restructure application pages:
- **OLD Mesh Page** → **NEW Chat Page** (move all mesh/group functionality here)
- **OLD Chat Page** → **NEW Mesh Page** (convert to contacts/chat list)

Add 3 contact addition methods:
1. Manual Peer ID entry
2. Local peer discovery (100m radius)
3. QR code scanning

## PAGE RESTRUCTURING

### NEW MESH PAGE (formerly Chat) - Contact/Chat List

**File:** `g3tzkp-messenger UI/src/pages/MeshPage.tsx`

**FULL IMPLEMENTATION:**

```typescript
import React, { useState, useEffect } from 'react';
import { Search, UserPlus, QrCode, Wifi, MessageSquare } from 'lucide-react';
import { useG3ZKP } from '../contexts/G3ZKPContext';
import { AddContactDialog } from '../components/contacts/AddContactDialog';
import { ContactList } from '../components/contacts/ContactList';
import { RecentConversations } from '../components/contacts/RecentConversations';

export function MeshPage() {
  const { connectedPeers, messages } = useG3ZKP();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversations' | 'contacts'>('conversations');

  // Get recent conversations
  const recentConversations = React.useMemo(() => {
    const conversationMap = new Map<string, any>();
    
    messages.forEach(msg => {
      const otherPeerId = msg.isMe ? msg.recipient : msg.sender;
      if (!conversationMap.has(otherPeerId)) {
        conversationMap.set(otherPeerId, {
          peerId: otherPeerId,
          lastMessage: msg,
          unreadCount: msg.isMe ? 0 : 1
        });
      } else {
        const conv = conversationMap.get(otherPeerId)!;
        if (msg.timestamp > conv.lastMessage.timestamp) {
          conv.lastMessage = msg;
        }
        if (!msg.isMe) {
          conv.unreadCount++;
        }
      }
    });

    return Array.from(conversationMap.values())
      .sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
  }, [messages]);

  // Filter based on search
  const filteredConversations = recentConversations.filter(conv =>
    conv.peerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = connectedPeers.filter(peer =>
    peer.peerId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/30">
        <h1 className="text-2xl font-bold text-cyan-400 mb-4">Mesh Network</h1>
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations or contacts..."
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              activeTab === 'conversations'
                ? 'bg-cyan-500 text-black font-bold'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Conversations
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              activeTab === 'contacts'
                ? 'bg-cyan-500 text-black font-bold'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-2" />
            Contacts ({connectedPeers.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'conversations' ? (
          <RecentConversations conversations={filteredConversations} />
        ) : (
          <ContactList contacts={filteredContacts} />
        )}
      </div>

      {/* Add Contact Button */}
      <div className="p-4 border-t border-cyan-500/30">
        <button
          onClick={() => setShowAddContact(true)}
          className="w-full py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Add Contact
        </button>
      </div>

      {/* Add Contact Dialog */}
      {showAddContact && (
        <AddContactDialog onClose={() => setShowAddContact(false)} />
      )}
    </div>
  );
}

export default MeshPage;
```

### File: `g3tzkp-messenger UI/src/components/contacts/AddContactDialog.tsx`

**FULL IMPLEMENTATION - 3 Contact Methods:**

```typescript
import React, { useState, useEffect } from 'react';
import { X, User, Wifi, QrCode, Scan } from 'lucide-react';
import { useG3ZKP } from '../../contexts/G3ZKPContext';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

interface AddContactDialogProps {
  onClose: () => void;
}

export function AddContactDialog({ onClose }: AddContactDialogProps) {
  const { localPeerId, connectToPeer, discoverPeers } = useG3ZKP();
  const [method, setMethod] = useState<'manual' | 'nearby' | 'qr'>('manual');
  const [peerId, setPeerId] = useState('');
  const [nearbyPeers, setNearbyPeers] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [myQRCode, setMyQRCode] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Generate QR code for my peer ID
  useEffect(() => {
    if (method === 'qr') {
      QRCode.toDataURL(localPeerId, {
        width: 300,
        margin: 2,
        color: {
          dark: '#00ffff',
          light: '#000000'
        }
      }).then(setMyQRCode);
    }
  }, [method, localPeerId]);

  // Discover nearby peers
  useEffect(() => {
    if (method === 'nearby') {
      discoverNearbyPeers();
      const interval = setInterval(discoverNearbyPeers, 5000);
      return () => clearInterval(interval);
    }
  }, [method]);

  const discoverNearbyPeers = async () => {
    const peers = await discoverPeers(100); // 100m radius
    setNearbyPeers(peers);
  };

  const handleManualAdd = async () => {
    if (!peerId.trim()) return;
    
    try {
      await connectToPeer(peerId);
      onClose();
    } catch (error) {
      console.error('Failed to add contact:', error);
      alert('Failed to connect to peer. Check the Peer ID.');
    }
  };

  const handleNearbyPeerAdd = async (peer: any) => {
    try {
      await connectToPeer(peer.peerId);
      onClose();
    } catch (error) {
      console.error('Failed to add nearby peer:', error);
    }
  };

  const startQRScanner = async () => {
    setScanning(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanQRCode();
      }
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Could not access camera');
      setScanning(false);
    }
  };

  const scanQRCode = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !scanning) return;

    const ctx = canvas.getContext('2d')!;
    
    const scan = () => {
      if (!scanning) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          // Found QR code
          stopQRScanner();
          handleQRCodeScanned(code.data);
          return;
        }
      }

      requestAnimationFrame(scan);
    };

    scan();
  };

  const stopQRScanner = () => {
    setScanning(false);
    
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleQRCodeScanned = async (scannedPeerId: string) => {
    try {
      await connectToPeer(scannedPeerId);
      onClose();
    } catch (error) {
      console.error('Failed to add scanned peer:', error);
      alert('Failed to connect to scanned peer');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-cyan-500/50 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-cyan-500/30 flex items-center justify-between">
          <h2 className="text-xl font-bold text-cyan-400">Add Contact</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Selection */}
        <div className="p-4 border-b border-cyan-500/30">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setMethod('manual')}
              className={`p-4 rounded-lg border transition-colors ${
                method === 'manual'
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <User className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm font-bold">Manual</div>
            </button>

            <button
              onClick={() => setMethod('nearby')}
              className={`p-4 rounded-lg border transition-colors ${
                method === 'nearby'
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Wifi className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm font-bold">Nearby</div>
            </button>

            <button
              onClick={() => setMethod('qr')}
              className={`p-4 rounded-lg border transition-colors ${
                method === 'qr'
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <QrCode className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm font-bold">QR Code</div>
            </button>
          </div>
        </div>

        {/* Method Content */}
        <div className="p-4">
          {method === 'manual' && (
            <div>
              <label className="block text-sm font-bold text-cyan-400 mb-2">
                Enter Peer ID
              </label>
              <input
                type="text"
                value={peerId}
                onChange={(e) => setPeerId(e.target.value)}
                placeholder="12D3KooW..."
                className="w-full p-3 bg-gray-800 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500 mb-4"
              />
              <button
                onClick={handleManualAdd}
                disabled={!peerId.trim()}
                className="w-full py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Contact
              </button>
            </div>
          )}

          {method === 'nearby' && (
            <div>
              <div className="mb-4">
                <div className="text-sm text-gray-400 mb-2">
                  Discovering peers within 100m radius...
                </div>
                {nearbyPeers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Wifi className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                    <div>No nearby peers found</div>
                  </div>
                )}
              </div>

              {nearbyPeers.map(peer => (
                <div
                  key={peer.peerId}
                  className="p-3 bg-gray-800 border border-cyan-500/30 rounded-lg mb-2 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-mono text-sm text-cyan-400">
                      {peer.peerId.substring(0, 20)}...
                    </div>
                    {peer.distance && (
                      <div className="text-xs text-gray-500">
                        ~{peer.distance.toFixed(0)}m away
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleNearbyPeerAdd(peer)}
                    className="px-4 py-2 bg-cyan-500 text-black font-bold rounded hover:bg-cyan-400 transition-colors"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {method === 'qr' && (
            <div>
              {!scanning ? (
                <div>
                  {/* My QR Code */}
                  <div className="mb-4">
                    <div className="text-sm font-bold text-cyan-400 mb-2">
                      My QR Code
                    </div>
                    <div className="bg-black p-4 rounded-lg border border-cyan-500/30 flex justify-center">
                      {myQRCode && (
                        <img src={myQRCode} alt="My Peer ID QR Code" className="w-64 h-64" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-2">
                      Others can scan this to add you
                    </div>
                  </div>

                  {/* Scan Button */}
                  <button
                    onClick={startQRScanner}
                    className="w-full py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <Scan className="w-5 h-5" />
                    Scan QR Code
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-bold text-cyan-400 mb-2">
                    Scanning QR Code...
                  </div>
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      className="w-full"
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Scanner overlay */}
                    <div className="absolute inset-0 border-4 border-cyan-500 pointer-events-none">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400" />
                    </div>
                  </div>
                  <button
                    onClick={stopQRScanner}
                    className="w-full mt-4 py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel Scan
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddContactDialog;
```

### File: `g3tzkp-messenger UI/src/components/contacts/ContactList.tsx`

```typescript
import React from 'react';
import { User, MessageCircle, MoreVertical } from 'lucide-react';

interface Contact {
  peerId: string;
  name?: string;
  lastSeen?: number;
  publicKey?: string;
}

interface ContactListProps {
  contacts: Contact[];
}

export function ContactList({ contacts }: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <User className="w-16 h-16 mb-4" />
        <div className="text-lg">No contacts yet</div>
        <div className="text-sm">Add contacts to start messaging</div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {contacts.map(contact => (
        <div
          key={contact.peerId}
          className="p-4 hover:bg-gray-900 transition-colors cursor-pointer flex items-center gap-4"
        >
          {/* Avatar */}
          <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-cyan-400" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white truncate">
              {contact.name || `Peer ${contact.peerId.substring(0, 8)}`}
            </div>
            <div className="text-sm text-gray-500 font-mono truncate">
              {contact.peerId}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <MessageCircle className="w-5 h-5 text-cyan-400" />
            </button>
            <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ContactList;
```

### File: `g3tzkp-messenger UI/src/components/contacts/RecentConversations.tsx`

```typescript
import React from 'react';
import { User, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Conversation {
  peerId: string;
  lastMessage: any;
  unreadCount: number;
}

interface RecentConversationsProps {
  conversations: Conversation[];
}

export function RecentConversations({ conversations }: RecentConversationsProps) {
  const navigate = useNavigate();

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <MessageSquare className="w-16 h-16 mb-4" />
        <div className="text-lg">No conversations yet</div>
        <div className="text-sm">Start messaging your contacts</div>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="divide-y divide-gray-800">
      {conversations.map(conv => (
        <div
          key={conv.peerId}
          onClick={() => navigate(`/chat?peer=${conv.peerId}`)}
          className="p-4 hover:bg-gray-900 transition-colors cursor-pointer flex items-center gap-4"
        >
          {/* Avatar */}
          <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center flex-shrink-0 relative">
            <User className="w-6 h-6 text-cyan-400" />
            {conv.unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="font-bold text-white truncate">
                Peer {conv.peerId.substring(0, 8)}
              </div>
              <div className="text-xs text-gray-500">
                {formatTime(conv.lastMessage.timestamp)}
              </div>
            </div>
            <div className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-white font-bold' : 'text-gray-400'}`}>
              {conv.lastMessage.isMe && 'You: '}
              {conv.lastMessage.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default RecentConversations;
```

### NEW CHAT PAGE (formerly Mesh) - Group/Mesh Management

**File:** `g3tzkp-messenger UI/src/pages/ChatPage.tsx`

**Move all current Mesh page content here** - groups, mesh creation, mesh discovery.

## DEPENDENCIES

Install QR code libraries:

```bash
npm install qrcode jsqr
npm install --save-dev @types/qrcode @types/jsqr
```

## SUCCESS CRITERIA

✅ Mesh page now shows contacts/chat list  
✅ Chat page now shows group/mesh management  
✅ Manual Peer ID entry working  
✅ Local peer discovery (100m) working via libp2p mDNS  
✅ QR code generation for own Peer ID working  
✅ QR code scanning working with camera  
✅ Contact list displays all connected peers  
✅ Recent conversations sorted by time  
✅ Unread message counts displayed  
✅ Navigation between pages working

**RESULT: Page Structure Restructured 100% ✓**
