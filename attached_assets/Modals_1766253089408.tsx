
import React, { useState, useEffect } from 'react';
// Added RefreshCw to imports
import { X, Phone, Video, Users, CreditCard, Settings as SettingsIcon, Shield, Binary, Hash, Lock, Activity, Zap, Award, Loader2, RefreshCw } from 'lucide-react';

export interface ModalProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const ModalWrapper: React.FC<ModalProps> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 md:p-6 backdrop-blur-xl bg-black/85 animate-in fade-in duration-300">
    <div className="w-full max-w-lg border-[0.5px] border-[#4caf50]/20 bg-[#0a1a0a]/95 p-6 md:p-10 relative overflow-hidden flex flex-col gap-6 shadow-[0_0_100px_rgba(0,0,0,0.95)] max-h-[95vh]">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent"></div>
      <div className="flex justify-between items-center border-b-[0.5px] border-[#4caf50]/10 pb-5 shrink-0">
        <div className="flex flex-col gap-1">
          <h3 className="orbitron text-[9px] md:text-sm font-black tracking-[0.2em] md:tracking-[0.4em] text-[#00f3ff] uppercase opacity-100">{title}</h3>
          <span className="text-[6px] text-[#4caf50] uppercase tracking-[0.3em] font-bold opacity-60">ISO_LINK_PARAMETER_0x{Math.floor(Math.random()*256).toString(16).toUpperCase()}</span>
        </div>
        <button onClick={onClose} className="text-[#4caf50] hover:text-[#00f3ff] transition-all p-2 bg-black/40 border-[0.5px] border-[#4caf50]/10 hover:border-[#00f3ff]/30 active:scale-90">
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide py-3">
        {children}
      </div>
      <div className="absolute top-2 left-2 w-3 h-3 border-t-[0.5px] border-l-[0.5px] border-[#00f3ff]/30"></div>
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-[0.5px] border-r-[0.5px] border-[#00f3ff]/30"></div>
    </div>
  </div>
);

export const CallModal: React.FC<{ type: 'voice' | 'video', onClose: () => void }> = ({ type, onClose }) => {
  const [status, setStatus] = useState('INITIATING_DTLS...');
  const [timer, setTimer] = useState(0);
  const [isSecure, setIsSecure] = useState(false);

  useEffect(() => {
    const s1 = setTimeout(() => setStatus('ESTABLISHING_SRTP_TUNNEL...'), 1200);
    const s2 = setTimeout(() => { setStatus('CONNECTED_ENCRYPTED_G3T'); setIsSecure(true); }, 2800);
    return () => { clearTimeout(s1); clearTimeout(s2); };
  }, []);

  useEffect(() => {
    if (isSecure) {
      const interval = setInterval(() => setTimer(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [isSecure]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <ModalWrapper title={`${type.toUpperCase()}_SESSION_ISO`} onClose={onClose}>
      <div className="flex flex-col items-center gap-8 md:gap-12 py-8 md:py-14">
        <div className="relative">
          <div className="absolute inset-0 bg-[#00f3ff]/5 blur-[60px] rounded-full animate-pulse"></div>
          <div className={`w-28 h-28 md:w-40 md:h-40 border-[0.5px] rounded-full flex items-center justify-center relative transition-all duration-1000 ${isSecure ? 'border-[#00f3ff] shadow-[0_0_30px_#00f3ff22] text-[#00f3ff]' : 'border-[#4caf50]/20 text-[#4caf50]/40 animate-pulse'}`}>
            {/* Removed non-existent md:size property and adjusted icons */}
            {type === 'voice' ? <Phone size={44} strokeWidth={0.5} className="md:w-14 md:h-14" /> : <Video size={44} strokeWidth={0.5} className="md:w-14 md:h-14" />}
            <div className={`absolute inset-0 border-[0.5px] rounded-full opacity-20 ${isSecure ? 'border-[#00f3ff] animate-ping' : 'border-[#4caf50]/40'}`}></div>
            {isSecure && (
              <div className="absolute -top-1 right-2 bg-black border-[0.5px] border-[#00f3ff] p-2 text-[#00f3ff] animate-in zoom-in duration-500 shadow-glow">
                <Shield size={14} strokeWidth={1} />
              </div>
            )}
          </div>
        </div>
        <div className="text-center space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2">
            <p className={`orbitron text-[8px] md:text-[11px] tracking-[0.4em] md:tracking-[0.6em] uppercase font-black ${isSecure ? 'text-[#00f3ff]' : 'text-[#4caf50] animate-pulse'}`}>{status}</p>
            <p className="text-[6px] md:text-[8px] uppercase tracking-widest text-[#4caf50]/50 font-mono">PEER: ISO_V_X9_TAUTOLOGY</p>
          </div>
          {isSecure ? (
            <div className="flex flex-col gap-2">
               <p className="font-mono text-2xl md:text-4xl text-[#00f3ff] font-black tracking-tighter shadow-glow">{formatTime(timer)}</p>
               <span className="text-[6px] text-[#00f3ff]/40 uppercase tracking-[0.5em] font-bold">Bitrate: 512Kbps (AES_256)</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 justify-center text-[#4caf50]/30 italic font-black text-[9px] tracking-widest">
               <Loader2 size={12} className="animate-spin" /> SYNCHRONIZING_CLOCKS...
            </div>
          )}
        </div>
        <div className="w-full max-w-[240px] pt-6">
          <button onClick={onClose} className="w-full py-5 border-[0.5px] border-red-500/30 text-red-500 text-[9px] md:text-[11px] font-black tracking-[0.4em] uppercase hover:bg-red-500/10 transition-all active:scale-95 shadow-lg group">
             <span className="opacity-80 group-hover:opacity-100">TERMINATE_ISO_SESSION</span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export const GroupModal: React.FC<{ onClose: () => void, onCreate?: (name: string) => void }> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('G3ZKP_MESH_01');
  const [securityLevel, setSecurityLevel] = useState(2);
  
  return (
    <ModalWrapper title="INITIALIZE_MESH_NODE" onClose={onClose}>
      <div className="space-y-10">
        <div className="space-y-3">
          <label className="text-[7px] md:text-[8px] uppercase tracking-widest text-[#4caf50] font-black opacity-70">Node_Designation_Label</label>
          <div className="relative">
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MESH_ISO_..." 
              className="w-full bg-black/40 border-[0.5px] border-[#4caf50]/20 p-5 text-[11px] md:text-[13px] outline-none focus:border-[#00f3ff]/40 text-[#00f3ff] font-black tracking-widest uppercase transition-all" 
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
              <Binary size={14} />
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <p className="text-[7px] md:text-[8px] uppercase tracking-widest text-[#4caf50] font-black opacity-70">Cryptographic_Protocol_Tiers</p>
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'TAUTOLOGICAL_SOUNDNESS', icon: Shield, active: true },
              { label: 'ISO_MAPPING_PERSISTENCE', icon: Zap, active: true },
              { label: 'EPHEMERAL_GEODESIC_RATCHET', icon: RefreshCw, active: false }
            ].map((p, i) => (
              <div key={i} className="flex justify-between items-center p-4 border-[0.5px] border-[#4caf50]/10 bg-black/20 group hover:border-[#00f3ff]/20 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <p.icon size={14} className="text-[#4caf50]/40 group-hover:text-[#00f3ff]/40" strokeWidth={1} />
                  <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-[#00f3ff]/80 font-black">{p.label}</span>
                </div>
                <div className="w-10 h-5 bg-black border-[0.5px] border-[#4caf50]/20 relative shrink-0">
                  <div className={`absolute top-1 left-1 w-3 h-3 transition-all ${p.active ? 'bg-[#00f3ff] translate-x-5 shadow-[0_0_8px_#00f3ff]' : 'bg-[#4caf50]/20'}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <button 
          onClick={() => onCreate?.(name)} 
          className="w-full py-5 border-[0.5px] border-[#00f3ff]/50 text-[#00f3ff] font-black text-[10px] md:text-[12px] tracking-[0.5em] uppercase hover:bg-[#00f3ff]/10 transition-all active:scale-95 shadow-glow"
        >
          GENERATE_MESH_TX
        </button>
      </div>
    </ModalWrapper>
  );
};

export const LicenseModal: React.FC<{ status: any, onClose: () => void }> = ({ status, onClose }) => (
  <ModalWrapper title="G3T_ISO_ECONOMICS" onClose={onClose}>
    <div className="space-y-12">
      <div className="p-8 border-[0.5px] border-[#00f3ff]/30 bg-[#00f3ff]/5 flex flex-col items-center gap-6 shadow-inner">
        <div className="relative">
          <Award size={40} className="text-[#00f3ff] animate-pulse" strokeWidth={0.5} />
          <div className="absolute inset-0 border-[0.5px] border-[#00f3ff]/20 rounded-full scale-150 opacity-20"></div>
        </div>
        <div className="text-center">
          <p className="orbitron text-[10px] md:text-[12px] font-black text-[#00f3ff] tracking-[0.3em] uppercase">TAUTOLOGY_GENESIS_LICENSE</p>
          <p className="text-[8px] text-[#4caf50] mt-2 font-black uppercase opacity-60">Status: PERSISTENT_GRADE_3</p>
        </div>
      </div>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <p className="text-[8px] uppercase tracking-[0.3em] text-[#4caf50] font-black opacity-60">PROOF_SOUNDNESS_CREDITS</p>
          <p className="text-[10px] font-mono font-black text-[#00f3ff] shadow-glow">{status.accumulatedValue.toFixed(1)} / 30.0</p>
        </div>
        <div className="h-[3px] w-full bg-black border-[0.5px] border-[#4caf50]/10 overflow-hidden shadow-inner">
          <div className="h-full bg-[#00f3ff] shadow-[0_0_20px_#00f3ff] transition-all duration-1000" style={{ width: `${(status.accumulatedValue / 30) * 100}%` }}></div>
        </div>
        <div className="flex items-center gap-3 text-[7px] text-[#4caf50]/40 font-mono italic leading-relaxed uppercase tracking-widest text-center justify-center">
           <Activity size={10} strokeWidth={1} /> AUTO_RENEW_ENABLED_CYCLE_V1.1
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button className="py-4 border-[0.5px] border-[#4caf50]/10 text-[8px] font-black tracking-widest uppercase opacity-20 cursor-not-allowed">RENEW</button>
        <button className="py-4 border-[0.5px] border-[#00f3ff]/40 text-[#00f3ff] text-[8px] font-black tracking-widest uppercase hover:bg-[#00f3ff]/10 transition-all active:scale-95 shadow-glow">TOP_UP_G3T_ISO</button>
      </div>
    </div>
  </ModalWrapper>
);

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <ModalWrapper title="CORE_NODE_PARAMETERS" onClose={onClose}>
    <div className="space-y-10">
      {[
        { title: 'GEODESIC_LINK', items: ['Protocol: Tautology_3.1', 'Theme: Geodesic_Deep'] },
        { title: 'SECURITY_VAULT', items: ['ZKP_Soundness: Supreme', 'Stealth_Ratchet: ON'] },
        { title: 'NETWORK_ISO', items: ['GossipSub: Active', 'Mesh_Topology: Isomorphic'] }
      ].map((section, idx) => (
        <div key={idx} className="space-y-5">
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-black text-[#4caf50] tracking-[0.3em] uppercase opacity-80 shrink-0">{section.title}</span>
            <div className="flex-1 h-[0.5px] bg-[#4caf50]/10"></div>
          </div>
          <div className="space-y-4">
            {section.items.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-[10px] text-[#00f3ff]/70 font-mono py-2 bg-black/20 px-3 border-l-[1px] border-[#4caf50]/10 hover:border-[#00f3ff]/40 transition-all group">
                <span className="truncate pr-4 uppercase tracking-tighter group-hover:tracking-normal transition-all">{item}</span>
                <span className="text-[#4caf50]/40 cursor-pointer hover:text-[#00f3ff] transition-all uppercase text-[7px] font-black shrink-0">ADJUST</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="pt-6 border-t-[0.5px] border-[#4caf50]/10 flex flex-col items-center gap-2">
         <p className="text-[7px] uppercase font-mono opacity-20 tracking-tighter truncate max-w-full">NODE_HASH: 0xG3T_ISO_ARCHITECT_CORE_v1.0.99XF</p>
         <div className="flex gap-4 opacity-10">
            <Binary size={10} /> <Activity size={10} /> <Zap size={10} />
         </div>
      </div>
    </div>
  </ModalWrapper>
);
