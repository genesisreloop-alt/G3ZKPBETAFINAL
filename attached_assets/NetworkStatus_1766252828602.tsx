import React, { useEffect, useState } from 'react';
import { Network, Activity, Signal, Users, Zap, Globe, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useG3ZKP } from '../contexts/G3ZKPContext';

const NetworkStatus: React.FC = () => {
  const { 
    isInitialized, 
    connectedPeers, 
    networkStats, 
    refreshNetworkStats 
  } = useG3ZKP();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      const interval = setInterval(() => {
        refreshNetworkStats();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isInitialized, refreshNetworkStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshNetworkStats();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <div className="w-full space-y-6">
      <div className="border-[0.5px] border-[#4caf50]/40 bg-black/40 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-sm font-black tracking-widest text-[#00f3ff] uppercase flex items-center gap-3">
            <Network size={16} className="text-[#4caf50]" />
            NETWORK STATUS
          </h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border-[0.5px] border-[#4caf50]/30 hover:border-[#00f3ff]/50 transition-all disabled:opacity-50"
          >
            <Activity size={12} className={`text-[#4caf50] ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={12} className="text-[#4caf50]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Connected</span>
            </div>
            <p className="text-2xl font-black text-[#4caf50] font-mono">{connectedPeers.length}</p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Active Peers</p>
          </div>

          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} className="text-[#00f3ff]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Messages</span>
            </div>
            <p className="text-2xl font-black text-[#00f3ff] font-mono">
              {networkStats?.messagesSent || 0}
            </p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Transmitted</p>
          </div>

          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Signal size={12} className="text-[#4caf50]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Routes</span>
            </div>
            <p className="text-2xl font-black text-[#4caf50] font-mono">
              {networkStats?.routesCached || 0}
            </p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Cached Routes</p>
          </div>

          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={12} className="text-[#00f3ff]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Discovery</span>
            </div>
            <p className="text-2xl font-black text-[#00f3ff] font-mono">
              {networkStats?.peersDiscovered || 0}
            </p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Discovered</p>
          </div>
        </div>
      </div>

      <div className="border-[0.5px] border-[#4caf50]/40 bg-black/40 p-6">
        <h4 className="text-[10px] font-black tracking-widest text-[#00f3ff] uppercase mb-4 flex items-center gap-2">
          <Users size={12} />
          CONNECTED PEERS ({connectedPeers.length})
        </h4>
        
        {connectedPeers.length === 0 ? (
          <div className="text-center py-8 opacity-50">
            <Network size={24} className="mx-auto mb-3 text-[#4caf50]" />
            <p className="text-[9px] font-mono uppercase tracking-widest">No peers connected</p>
            <p className="text-[7px] font-mono mt-2 opacity-70">Waiting for P2P discovery...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {connectedPeers.map((peer) => (
              <div 
                key={peer.id} 
                className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4 hover:border-[#00f3ff]/40 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={10} className="text-[#4caf50]" />
                      <span className="text-[9px] font-mono font-black text-[#00f3ff] tracking-wider">
                        PEER_{peer.id.substring(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[7px] font-mono opacity-50 break-all">
                      ID: {peer.id}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 px-2 py-1 bg-[#4caf50]/10 border-[0.5px] border-[#4caf50]/30">
                    <Signal size={8} className="text-[#4caf50]" />
                    <span className="text-[7px] font-mono text-[#4caf50] font-black">ONLINE</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-[7px] font-mono">
                  <div>
                    <span className="opacity-40 block mb-1">Protocols</span>
                    <span className="text-[#4caf50]">{peer.protocols?.length || 0}</span>
                  </div>
                  <div>
                    <span className="opacity-40 block mb-1">Addresses</span>
                    <span className="text-[#4caf50]">{peer.addresses?.length || 0}</span>
                  </div>
                  <div>
                    <span className="opacity-40 block mb-1">Connected</span>
                    <span className="text-[#00f3ff]">
                      {peer.connectedAt ? new Date(peer.connectedAt).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>

                {peer.protocols && peer.protocols.length > 0 && (
                  <div className="mt-3 pt-3 border-t-[0.5px] border-[#4caf50]/10">
                    <span className="text-[7px] opacity-40 block mb-2">Supported Protocols:</span>
                    <div className="flex flex-wrap gap-1">
                      {peer.protocols.slice(0, 5).map((protocol, idx) => (
                        <span 
                          key={idx}
                          className="text-[6px] font-mono px-2 py-1 bg-black/40 border-[0.5px] border-[#4caf50]/20 text-[#4caf50]"
                        >
                          {protocol}
                        </span>
                      ))}
                      {peer.protocols.length > 5 && (
                        <span className="text-[6px] font-mono px-2 py-1 opacity-50">
                          +{peer.protocols.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-[0.5px] border-[#4caf50]/40 bg-black/40 p-6">
        <h4 className="text-[10px] font-black tracking-widest text-[#00f3ff] uppercase mb-4">
          NETWORK DETAILS
        </h4>
        
        <div className="space-y-3 text-[8px] font-mono">
          <div className="flex justify-between items-center p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
            <span className="opacity-50">Transport Protocol</span>
            <span className="text-[#4caf50] font-black">libp2p (TCP/WebSocket/WebRTC)</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
            <span className="opacity-50">Discovery Methods</span>
            <span className="text-[#4caf50] font-black">mDNS, DHT, Bootstrap, PubSub</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
            <span className="opacity-50">Security</span>
            <span className="text-[#4caf50] font-black">Noise Protocol (X25519+ChaCha20)</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
            <span className="opacity-50">Multiplexing</span>
            <span className="text-[#4caf50] font-black">Yamux Stream Multiplexer</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
            <span className="opacity-50">Message Routing</span>
            <span className="text-[#4caf50] font-black">Multi-hop with Route Caching</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus;
