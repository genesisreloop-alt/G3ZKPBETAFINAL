
import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Terminal as TerminalIcon, ShieldCheck, Cpu, Zap, Activity, 
  Shield, Binary, Loader2, Sparkles, CheckCircle, Info, 
  Phone, Video, MoreVertical, Paperclip, Smile, Lock, Grid, X
} from 'lucide-react';
import { Message } from '../types';

interface DiegeticTerminalProps {
  messages: Message[];
  onSend: (text: string) => void;
  onFileUpload?: (file: File) => void;
  fileProgress?: number;
  isVerifying: boolean;
  nodeId: string;
  onCall?: (type: 'voice' | 'video') => void;
}

const MULTIVECTOR_SYMBOLS = 'φψη_rR₄Ψ𝔾₃₂∧∨⊗∘∇∫∂∑∏√∞αβγδεζηθικλμνξοπρςστυφχψωℛℳ𝒢𝒪∇_φφ⁻¹φ²φ³φ⁴⟨⟩•⋆⁺⁻ℏℂℍℕℙℚℝℤℵℶℷℸ∆∇∈∋∎∏∐∑∓∔∕∖∗∘∙√∛∜∝∟∠∡∢∣∤∥∦∩∪∬∭∮∯∰∱∲∳∴∵∶∷∸∹∺∻∼∽∾∿≀≁≂≃≄≅≆≇≈≉≊≋≌≍≎≏≐≑≒≓≔≕≖≗≘≙≚≛≜≝≞≟≠≡≢≣≤≥≦≧≨≩≪≫≬≭≮≯≰≱≲≳≴≵≶≷≸≹≺≻≼≽≾≿⊀⊁⊂⊃⊄⊅⊆⊇⊈⊉⊊⊋⊌⊍⊎⊏⊐⊑⊒⊓⊔⊕⊖⊗⊘⊙⊚⊛⊜⊝⊞⊟⊠⊡⊢⊣⊤⊥⊦⊧⊨⊩⊪⊫⊬⊭⊮⊯⊰⊱⊲⊳⊴⊵⊶⊷⊸⊹⊺⊻⊼⊽⊾⊿⋀⋁⋂⋃⋄⋅⋆⋇⋈⋉⋊⋋⋌⋍⋎⋏⋐⋑⋒⋓⋔⋕⋖⋗⋘⋙⋚⋛⋜⋝⋞⋟⋠⋡⋢⋣⋤⋥⋦⋧⋨⋩⋪⋫⋬⋭⋮⋯⋰⋱₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾';

const FlowerOfLifeSmall: React.FC<{ size?: number, color?: string, rotor?: boolean, pulse?: boolean }> = ({ 
  size = 24, color = "currentColor", rotor = false, pulse = false 
}) => (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`opacity-100 transition-all duration-700 ${rotor ? 'animate-[rotorse-alpha_10s_linear_infinite]' : ''} ${pulse ? 'animate-pulse scale-110' : ''}`}>
        <circle cx="50" cy="50" r="16" fill="none" stroke={color} strokeWidth="1" />
        {[0, 60, 120, 180, 240, 300].map(angle => (
            <circle 
                key={angle} 
                cx={50 + 16 * Math.cos(angle * Math.PI / 180)} 
                cy={50 + 16 * Math.sin(angle * Math.PI / 180)} 
                r="16" 
                fill="none" 
                stroke={color} 
                strokeWidth="1" 
            />
        ))}
    </svg>
);

const DiegeticTerminal: React.FC<DiegeticTerminalProps> = ({ 
  messages, onSend, onFileUpload, fileProgress = 0, isVerifying, nodeId, onCall 
}) => {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isVerifying]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isVerifying) {
      onSend(input);
      setInput('');
      setShowPalette(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
      setFeedback(`ISO_FILE_QUEUED: ${file.name.toUpperCase()}`);
      setTimeout(() => setFeedback(null), 3000);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const insertSymbol = (sym: string) => {
    setInput(prev => prev + sym);
  };

  const triggerEmotesFeedback = () => {
    setFeedback("EMOTE_ENGINE_PROVING_SOUNDNESS...");
    setTimeout(() => setFeedback(null), 3000);
  };

  const isAiThinking = isVerifying || (messages.length > 0 && !messages[messages.length - 1].isMe && messages[messages.length - 1].content === '');

  return (
    <div className="flex flex-col h-full bg-[#010401] font-mono text-[#00f3ff] relative overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      
      {/* Session HUD Header - Optimized for Mobile */}
      <div className="px-4 md:px-12 py-4 md:py-6 border-b-[0.5px] border-[#4caf50]/30 bg-black/90 flex justify-between items-center text-[7px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.4em] relative z-20 font-black shadow-lg">
        <div className="flex gap-4 md:gap-10 items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <FlowerOfLifeSmall color="#00f3ff" size={18} rotor />
            <span className="text-[#00f3ff] drop-shadow-[0_0_8px_#00f3ff66] truncate max-w-[90px] sm:max-w-none opacity-80">CHANNEL_ISO_CORE_0x9</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 opacity-30">
            <Binary size={14} strokeWidth={1} />
            <span className="hidden md:block">TUNNEL: {nodeId}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-10 text-[#00f3ff]">
          <div className="flex gap-4">
            <button 
              onClick={() => {
                setFeedback("INITIATING_SECURE_VOICE...");
                setTimeout(() => { setFeedback(null); onCall?.('voice'); }, 1000);
              }}
              className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity active:scale-90 p-1"
            >
              <Phone size={18} strokeWidth={1} />
            </button>
            <button 
              onClick={() => {
                setFeedback("INITIATING_SECURE_VIDEO...");
                setTimeout(() => { setFeedback(null); onCall?.('video'); }, 1000);
              }}
              className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity active:scale-90 p-1"
            >
              <Video size={18} strokeWidth={1} />
            </button>
          </div>
          <div className="w-[0.5px] h-4 bg-[#4caf50]/30"></div>
          <div className="flex items-center gap-1.5 text-[#4caf50]">
            <div className="w-1.5 h-1.5 bg-[#4caf50] rounded-full animate-pulse opacity-60"></div>
            <span className="tracking-widest uppercase italic font-black text-[7px] hidden xs:block opacity-60">SYNC</span>
          </div>
          <MoreVertical size={18} className="cursor-pointer opacity-20 hover:opacity-100 p-1" strokeWidth={1} />
        </div>
      </div>

      {/* Message Output - Mobile Optimized Spacing */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-12 lg:p-16 space-y-10 md:space-y-14 scrollbar-hide scroll-smooth relative z-10 pb-24 md:pb-16 bg-[#010401]">
        <div className="text-[7px] md:text-[9px] text-[#4caf50]/30 uppercase mb-8 md:mb-12 pb-6 md:pb-10 border-b-[0.5px] border-[#4caf50]/20 font-black tracking-[0.2em] md:tracking-[0.4em] leading-loose italic">
          <p className="flex items-center gap-3 md:gap-4 mb-2"><Activity size={10} strokeWidth={1} /> ISO_ESTABLISHED: {new Date().toLocaleTimeString()}</p>
          <p className="flex items-center gap-3 md:gap-4 mb-2"><Shield size={10} strokeWidth={1} /> ENCRYPTION: G3T_DOUBLE_RATCHET</p>
          <p className="flex items-center gap-3 md:gap-4 text-[#00f3ff]/40 animate-pulse"><Sparkles size={10} strokeWidth={1} /> GEODESIC_SYNC: 0.9999812_STABLE</p>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-500 relative group`}>
            <div className={`flex items-center gap-3 md:gap-4 mb-2 md:mb-3 text-[7px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-black ${msg.isMe ? 'text-[#00f3ff]/50' : 'text-[#4caf50]/50'}`}>
              {!msg.isMe && <Lock size={10} className="text-[#00f3ff] opacity-60" strokeWidth={1} />}
              {msg.isZkpVerified && <ShieldCheck size={12} className="opacity-60" strokeWidth={1} />}
              <span className="opacity-60">{msg.sender}</span>
              <span className="opacity-30 font-black font-mono">[{new Date(msg.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span>
            </div>
            
            <div className={`relative max-w-[95%] md:max-w-[85%] p-4 md:p-8 text-[11px] md:text-[15px] border-l-[0.5px] transition-all duration-500 shadow-lg ${
              msg.isMe 
                ? 'bg-[#00f3ff]/[0.03] border-[#00f3ff]/30 text-[#00f3ff] hover:bg-[#00f3ff]/[0.05]' 
                : 'bg-[#4caf50]/[0.03] border-[#4caf50]/30 text-[#4caf50] hover:bg-[#4caf50]/[0.05]'
            }`}>
              <p className="leading-relaxed whitespace-pre-wrap font-bold tracking-tight opacity-90 group-hover:opacity-100 transition-opacity">
                {msg.content || (
                  <span className="flex items-center gap-6 italic opacity-30">
                    <Loader2 size={16} className="animate-spin" strokeWidth={1} />
                    Calculating...
                  </span>
                )}
              </p>
              
              <div className="absolute -top-3 right-4 md:right-8 flex items-center gap-2 px-3 py-0.5 bg-black border-[0.5px] border-[#00f3ff]/20 text-[6px] md:text-[8px] font-black tracking-[0.2em] md:tracking-[0.3em] text-[#00f3ff] uppercase group-hover:opacity-100 opacity-30 transition-opacity cursor-default z-20 shadow-xl">
                 <CheckCircle size={8} className="animate-pulse" strokeWidth={1} />
                 <span>SOUND_VERIFIED</span>
              </div>

              {msg.isMe && (
                <div className="absolute -bottom-4 md:-bottom-5 right-0 flex items-center gap-2 md:gap-3 text-[6px] md:text-[9px] font-black italic tracking-widest opacity-20 group-hover:opacity-60 transition-opacity">
                  <span className="uppercase font-mono">PKT_{msg.id.substr(0, 4).toUpperCase()}</span>
                  <div className="flex items-center gap-1.5">
                     {msg.isZkpVerified && <Shield size={8} className="text-[#00f3ff] opacity-40" strokeWidth={1.5} />}
                     <div className="flex gap-0.5">
                        <CheckCircle size={8} className={msg.status === 'read' ? 'text-[#00f3ff]' : 'text-white/10'} strokeWidth={1} />
                        <CheckCircle size={8} className={msg.status === 'delivered' || msg.status === 'read' ? 'text-[#00f3ff]' : 'text-white/10'} strokeWidth={1} />
                     </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isAiThinking && (
          <div className="flex flex-col items-start animate-in fade-in duration-700">
            <div className="flex items-center gap-4 mb-3 text-[7px] md:text-[11px] uppercase tracking-[0.3em] md:tracking-[0.4em] font-black text-[#4caf50]/40">
              <FlowerOfLifeSmall size={14} color="#4caf50" rotor pulse />
              <span>G3T_ISO_ARCHITECT</span>
            </div>
            <div className="p-4 md:p-10 border-l-[0.5px] border-[#4caf50]/20 bg-[#4caf50]/[0.02] text-[10px] md:text-[14px] italic opacity-30 flex items-center gap-6 md:gap-12">
               <FlowerOfLifeSmall size={28} color="#00f3ff" pulse rotor />
               <span className="font-black tracking-[0.1em] md:tracking-[0.2em] opacity-80 animate-pulse">Synchronizing_Geodesic...</span>
            </div>
          </div>
        )}
      </div>

      {/* Multivector Palette - Optimized Mobile View */}
      {showPalette && (
        <div className="absolute bottom-24 md:bottom-28 left-4 md:left-12 right-4 md:right-12 z-[150] animate-in slide-in-from-bottom-6 duration-300">
          <div className="bg-black border-[0.5px] border-[#4caf50]/30 p-4 md:p-6 shadow-[0_-15px_60px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <div className="flex justify-between items-center mb-4 border-b-[0.5px] border-[#4caf50]/10 pb-3">
               <span className="text-[7px] md:text-[9px] font-black tracking-[0.3em] uppercase text-[#4caf50]/60 flex items-center gap-2">
                 <Binary size={10} /> MULTIVECTOR_ONTOLOGY_PALETTE
               </span>
               <button onClick={() => setShowPalette(false)} className="text-[#4caf50] opacity-40 hover:opacity-100 p-1"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-16 lg:grid-cols-20 gap-1.5 h-36 md:h-48 overflow-y-auto scrollbar-hide">
               {MULTIVECTOR_SYMBOLS.split('').map((sym, idx) => (
                 <button 
                  key={idx} 
                  type="button"
                  onClick={() => insertSymbol(sym)}
                  className="w-full aspect-square border-[0.5px] border-[#4caf50]/10 flex items-center justify-center text-[12px] md:text-[15px] text-[#00f3ff]/40 hover:text-[#00f3ff] hover:bg-[#00f3ff]/10 hover:border-[#00f3ff]/30 transition-all active:scale-90 font-bold"
                 >
                   {sym}
                 </button>
               ))}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Overlay - Pop-up feedback for buttons */}
      {feedback && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] px-8 py-5 border-[0.5px] border-[#00f3ff]/60 bg-black/95 text-[#00f3ff] text-[9px] md:text-[11px] font-black tracking-[0.4em] uppercase animate-in zoom-in duration-300 shadow-[0_0_50px_#00f3ff33] backdrop-blur-xl text-center flex flex-col items-center gap-4">
           <FlowerOfLifeSmall size={24} color="#00f3ff" rotor />
           {feedback}
        </div>
      )}

      {/* Message Composer - Fully Responsive */}
      <form onSubmit={handleSubmit} className={`p-4 md:p-8 lg:p-12 border-t-[0.5px] border-[#4caf50]/20 bg-black/95 flex flex-col md:flex-row items-center gap-4 md:gap-8 relative transition-all duration-700 z-50 ${isFocused ? 'bg-black shadow-[inset_0_1px_50px_rgba(0,243,255,0.05)]' : ''}`}>
        <div className={`absolute -top-[0.5px] left-0 h-[0.5px] bg-[#00f3ff] transition-all duration-700 opacity-60 ${isFocused ? 'w-full' : 'w-0'}`}></div>
        
        <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto">
          <div className="flex gap-2.5">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              className="p-3 border-[0.5px] border-[#4caf50]/20 text-[#4caf50] hover:text-[#00f3ff] hover:border-[#00f3ff]/40 transition-all relative overflow-hidden group active:scale-90"
            >
               <Paperclip size={18} className={`relative z-10 transition-transform ${fileProgress > 0 ? 'scale-75 opacity-40' : 'group-hover:scale-110'}`} strokeWidth={1} />
               {fileProgress > 0 && (
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 border-[0.5px] border-[#00f3ff]/40 rounded-full animate-spin"></div>
                 </div>
               )}
               {fileProgress > 0 && (
                 <div className="absolute bottom-0 left-0 w-full bg-[#00f3ff]/40 transition-all duration-300" style={{ height: `${fileProgress}%` }}></div>
               )}
            </button>
            <button 
              type="button" 
              onClick={() => setShowPalette(!showPalette)}
              className={`p-3 border-[0.5px] transition-all active:scale-90 ${showPalette ? 'border-[#00f3ff] text-[#00f3ff] bg-[#00f3ff]/10' : 'border-[#4caf50]/20 text-[#4caf50] hover:text-[#00f3ff] hover:border-[#00f3ff]/40'}`}
            >
               <Binary size={18} strokeWidth={1} />
            </button>
            <button 
              type="button" 
              onClick={triggerEmotesFeedback}
              className="p-3 border-[0.5px] border-[#4caf50]/20 text-[#4caf50] hover:text-[#00f3ff] hover:border-[#00f3ff]/40 transition-all active:scale-90 opacity-50"
            >
               <Smile size={18} strokeWidth={1} />
            </button>
          </div>
          
          <div className="md:hidden flex-1 px-4 flex justify-center">
             {isVerifying && <Loader2 size={16} className="animate-spin text-[#00f3ff]/50" />}
          </div>

          <button 
            type="submit" 
            disabled={!input.trim() || isVerifying} 
            className={`md:hidden p-3 border-[0.5px] transition-all active:scale-90 ${ !input.trim() || isVerifying ? 'opacity-20 border-[#4caf50]/10 text-[#4caf50]' : 'border-[#00f3ff]/60 text-[#00f3ff] bg-[#00f3ff]/10' }`}
          >
            <Send size={18} strokeWidth={1} />
          </button>
        </div>
        
        <div className="flex-1 flex items-center gap-3 w-full px-2 border-b-[0.5px] md:border-none border-[#4caf50]/10 md:pb-0">
           <TerminalIcon size={16} className={`hidden sm:block transition-colors duration-700 ${isFocused ? 'text-[#00f3ff]/40' : 'text-[#4caf50]/20'}`} strokeWidth={1} />
           <input
             type="text"
             value={input}
             onFocus={() => setIsFocused(true)}
             onBlur={() => setIsFocused(false)}
             onChange={(e) => setInput(e.target.value)}
             placeholder={isVerifying ? "DERIVING_PROOF..." : "Transmit ISO packet..."}
             disabled={isVerifying}
             className="flex-1 bg-transparent border-none outline-none text-[#00f3ff] placeholder-[#4caf50]/20 text-[13px] md:text-xl py-3 md:py-4 tracking-wider md:tracking-widest font-mono font-black caret-[#00f3ff] uppercase opacity-80 hover:opacity-100 transition-opacity"
           />
        </div>
        
        <button 
          type="submit" 
          disabled={!input.trim() || isVerifying} 
          className={`hidden md:flex items-center justify-center gap-6 px-12 py-5 border-[0.5px] border-[#00f3ff]/40 font-black text-xs md:text-sm orbitron tracking-[0.4em] md:tracking-[0.5em] transition-all duration-700 relative overflow-hidden ${ !input.trim() || isVerifying ? 'opacity-20 border-[#4caf50]/10 text-[#4caf50]' : 'text-[#00f3ff] hover:bg-[#00f3ff]/10 hover:border-[#00f3ff]/60 active:scale-95 shadow-[0_0_20px_rgba(0,243,255,0.1)]' }`}
        >
          <span className="relative z-10 uppercase">TRANSMIT</span>
          <Send size={18} className={`relative z-10 transition-transform duration-700 ${input.trim() && !isVerifying ? 'translate-x-1 -translate-y-1 scale-110' : ''}`} strokeWidth={1} />
          {input.trim() && !isVerifying && <div className="absolute inset-0 bg-[#00f3ff]/[0.05] animate-pulse"></div>}
        </button>
      </form>
    </div>
  );
};

export default DiegeticTerminal;
