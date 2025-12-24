# PHASE 3B: UI COMPONENT REFACTORING
## Split 68,065-line App.tsx into Modular Components

**Status:** Monolithic → 100% Modular  
**Timeline:** Days 4-7 (Week 3-4)  
**Goal:** App.tsx < 500 lines

---

## OVERVIEW

Extract all components from the massive App.tsx file into separate, modular, maintainable files following React best practices.

## CURRENT STRUCTURE (PROBLEM)

```
App.tsx (68,065 lines)
├── All components defined inline
├── All state management
├── All UI logic
└── Impossible to maintain/test
```

## TARGET STRUCTURE (SOLUTION)

```
src/
├── App.tsx (< 500 lines) - Main routing and layout only
├── components/
│   ├── chat/
│   │   ├── DiegeticTerminal.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   ├── MessageList.tsx
│   │   └── TypingIndicator.tsx
│   ├── media/
│   │   ├── FileUploadDialog.tsx
│   │   ├── VoiceMessageRecorder.tsx
│   │   ├── VoiceMessagePlayer.tsx
│   │   ├── TensorObjectViewer.tsx
│   │   ├── MediaTensorConverter.tsx
│   │   └── MediaPreview.tsx
│   ├── navigation/
│   │   ├── WazeLikeMap.tsx
│   │   ├── StreetView.tsx
│   │   └── NavigationInterface.tsx
│   ├── system/
│   │   ├── ZKPVerifier.tsx
│   │   ├── SystemDashboard.tsx
│   │   ├── ProtocolMonitor.tsx
│   │   ├── NetworkStatus.tsx
│   │   └── SecurityPanel.tsx
│   ├── contacts/
│   │   ├── AddContactDialog.tsx
│   │   ├── ContactList.tsx
│   │   └── RecentConversations.tsx
│   ├── settings/
│   │   ├── SettingsPanel.tsx
│   │   ├── ThemeSelector.tsx
│   │   ├── ProfileSettings.tsx
│   │   └── PrivacySettings.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Card.tsx
│   │   └── MatrixRain.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── MainLayout.tsx
├── pages/
│   ├── MeshPage.tsx
│   ├── ChatPage.tsx
│   ├── NavigationPage.tsx
│   ├── SettingsPage.tsx
│   └── SystemPage.tsx
└── hooks/
    ├── useMessages.ts
    ├── usePeers.ts
    ├── useNavigation.ts
    └── useTheme.ts
```

## REFACTORING PLAN

### Step 1: Create Component Directory Structure

```bash
cd "g3tzkp-messenger UI/src"
mkdir -p components/{chat,media,navigation,system,contacts,settings,ui,layout}
mkdir -p pages hooks utils
```

### Step 2: Extract Core Components

#### File: `g3tzkp-messenger UI/src/components/layout/MainLayout.tsx`

```typescript
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MatrixRain } from '../ui/MatrixRain';

export function MainLayout() {
  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Background Matrix Rain */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <MatrixRain />
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
```

#### File: `g3tzkp-messenger UI/src/components/layout/Sidebar.tsx`

```typescript
import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageSquare, Navigation, Settings, Activity, Users } from 'lucide-react';

export function Sidebar() {
  const navItems = [
    { path: '/mesh', icon: Users, label: 'Mesh' },
    { path: '/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/navigation', icon: Navigation, label: 'Navigation' },
    { path: '/system', icon: Activity, label: 'System' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-20 bg-black/50 border-r border-cyan-500/30 flex flex-col items-center py-4 gap-4">
      {/* Logo */}
      <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-4">
        <div className="text-cyan-400 font-bold text-xl">G3</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `w-14 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? 'bg-cyan-500 text-black'
                  : 'text-gray-400 hover:bg-cyan-500/20 hover:text-cyan-400'
              }`
            }
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
```

#### File: `g3tzkp-messenger UI/src/components/layout/Header.tsx`

```typescript
import React from 'react';
import { useG3ZKP } from '../../contexts/G3ZKPContext';
import { Wifi, WifiOff, Shield } from 'lucide-react';

export function Header() {
  const { isInitialized, localPeerId, connectedPeers, connectionQuality } = useG3ZKP();

  return (
    <header className="h-16 bg-black/50 border-b border-cyan-500/30 flex items-center justify-between px-6">
      {/* Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {isInitialized ? (
            <>
              <Wifi className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-400">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-red-400" />
              <span className="text-sm text-red-400">Offline</span>
            </>
          )}
        </div>

        <div className="text-sm text-gray-400">
          <span className="text-cyan-400">{connectedPeers.length}</span> peers
        </div>
      </div>

      {/* Peer ID */}
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-mono text-cyan-400">
          {localPeerId ? `${localPeerId.substring(0, 12)}...` : 'Initializing...'}
        </span>
      </div>
    </header>
  );
}

export default Header;
```

### Step 3: Extract UI Components

#### File: `g3tzkp-messenger UI/src/components/ui/MatrixRain.tsx`

**Updated to use mathematical notations only:**

```typescript
import React, { useEffect, useRef } from 'react';

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Mathematical notation characters (from MULTIVECTOR_ONTOLOGY_OPCODES)
    const chars = '∑∏∫∂∇∆αβγδεζηθλμπρσφψω⊕⊗⊙∧∨¬∀∃∈∉⊂⊃∩∪∅ℝℂℚℤℕ∞≈≠≤≥±×÷√∛∜°′″';
    const charArray = chars.split('');

    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);

    const drops: number[] = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ffff'; // Brighter cyan color
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = charArray[Math.floor(Math.random() * charArray.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        drops[i]++;
      }
    }

    const interval = setInterval(draw, 35);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

export default MatrixRain;
```

#### File: `g3tzkp-messenger UI/src/components/ui/Button.tsx`

```typescript
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  
  const variantStyles = {
    primary: 'bg-cyan-500 text-black hover:bg-cyan-400',
    secondary: 'bg-gray-700 text-white hover:bg-gray-600',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'bg-transparent text-cyan-400 hover:bg-cyan-500/20'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5" />}
      {children}
    </button>
  );
}

export default Button;
```

### Step 4: Extract Chat Components

#### File: `g3tzkp-messenger UI/src/components/chat/DiegeticTerminal.tsx`

Extract terminal component from App.tsx - this should be ~500-1000 lines instead of being inline.

#### File: `g3tzkp-messenger UI/src/components/chat/MessageBubble.tsx`

```typescript
import React from 'react';
import { Check, CheckCheck, Shield } from 'lucide-react';
import { VoiceMessagePlayer } from '../media/VoiceMessagePlayer';
import { TensorObjectViewer } from '../media/TensorObjectViewer';

interface MessageBubbleProps {
  message: any;
  isMe: boolean;
}

export function MessageBubble({ message, isMe }: MessageBubbleProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[70%] rounded-lg p-3 ${
          isMe
            ? 'bg-cyan-500 text-black'
            : 'bg-gray-800 text-white'
        }`}
      >
        {/* Message Content */}
        {message.type === 'text' && (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}

        {message.type === 'voice' && message.waveformData && (
          <VoiceMessagePlayer
            audioUrl={message.mediaUrl}
            waveformData={message.waveformData}
            duration={message.duration}
          />
        )}

        {message.type === 'image' && (
          <img src={message.mediaUrl} alt="Shared image" className="rounded max-w-full" />
        )}

        {message.type === '3d-object' && message.tensorData && (
          <div className="w-64 h-64">
            <TensorObjectViewer tensorData={message.tensorData} />
          </div>
        )}

        {/* Metadata */}
        <div className={`flex items-center gap-2 mt-2 text-xs ${isMe ? 'text-black/70' : 'text-gray-400'}`}>
          <span>{formatTime(message.timestamp)}</span>
          
          {message.isZkpVerified && (
            <Shield className="w-3 h-3" title="ZKP Verified" />
          )}

          {isMe && (
            message.status === 'sent' ? (
              <Check className="w-3 h-3" />
            ) : message.status === 'delivered' ? (
              <CheckCheck className="w-3 h-3" />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
```

### Step 5: Create Custom Hooks

#### File: `g3tzkp-messenger UI/src/hooks/useMessages.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useG3ZKP } from '../contexts/G3ZKPContext';

export function useMessages(peerId?: string) {
  const { messages, sendMessage, retrieveMessages } = useG3ZKP();
  const [filteredMessages, setFilteredMessages] = useState<any[]>([]);

  useEffect(() => {
    if (peerId) {
      const filtered = messages.filter(
        msg => msg.sender === peerId || msg.recipient === peerId
      );
      setFilteredMessages(filtered);
    } else {
      setFilteredMessages(messages);
    }
  }, [messages, peerId]);

  const send = useCallback(
    async (content: string, options?: any) => {
      if (peerId) {
        return sendMessage(peerId, content, options);
      }
    },
    [peerId, sendMessage]
  );

  return {
    messages: filteredMessages,
    sendMessage: send,
    retrieveMessages
  };
}

export default useMessages;
```

#### File: `g3tzkp-messenger UI/src/hooks/useTheme.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  theme: string;
  setTheme: (theme: string) => void;
  applyTheme: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'cyberpunk',
      
      setTheme: (theme: string) => {
        set({ theme });
        get().applyTheme();
      },

      applyTheme: () => {
        const theme = get().theme;
        const root = document.documentElement;

        const themes: Record<string, any> = {
          cyberpunk: {
            '--color-primary': '#00ffff',
            '--color-secondary': '#ff00ff',
            '--color-bg': '#000000',
            '--color-text': '#ffffff'
          },
          matrix: {
            '--color-primary': '#00ff00',
            '--color-secondary': '#00aa00',
            '--color-bg': '#000000',
            '--color-text': '#00ff00'
          },
          light: {
            '--color-primary': '#0088ff',
            '--color-secondary': '#6600ff',
            '--color-bg': '#ffffff',
            '--color-text': '#000000'
          }
        };

        const themeVars = themes[theme] || themes.cyberpunk;

        Object.entries(themeVars).forEach(([key, value]) => {
          root.style.setProperty(key, value as string);
        });
      }
    }),
    {
      name: 'g3zkp-theme'
    }
  )
);
```

### Step 6: Update Main App.tsx

#### File: `g3tzkp-messenger UI/src/App.tsx` (NEW - < 500 lines)

```typescript
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { G3ZKPProvider } from './contexts/G3ZKPContext';
import { MainLayout } from './components/layout/MainLayout';
import { MeshPage } from './pages/MeshPage';
import { ChatPage } from './pages/ChatPage';
import { NavigationPage } from './pages/NavigationPage';
import { SystemPage } from './pages/SystemPage';
import { SettingsPage } from './pages/SettingsPage';
import { useTheme } from './hooks/useTheme';

function App() {
  const { applyTheme } = useTheme();

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    <G3ZKPProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/mesh" replace />} />
            <Route path="mesh" element={<MeshPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="navigation" element={<NavigationPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </G3ZKPProvider>
  );
}

export default App;
```

## REFACTORING CHECKLIST

### Components to Extract (Priority Order)

1. ✅ Layout Components (MainLayout, Sidebar, Header)
2. ✅ UI Components (Button, Input, Modal, MatrixRain)
3. ✅ Chat Components (DiegeticTerminal, MessageBubble, MessageList, MessageInput)
4. ✅ Media Components (FileUploadDialog, VoiceRecorder, VoicePlayer, TensorViewer)
5. ✅ Navigation Components (WazeLikeMap, StreetView, NavigationInterface)
6. ✅ System Components (ZKPVerifier, SystemDashboard, ProtocolMonitor)
7. ✅ Contact Components (AddContactDialog, ContactList, RecentConversations)
8. ✅ Settings Components (SettingsPanel, ThemeSelector, ProfileSettings)
9. ✅ Custom Hooks (useMessages, usePeers, useNavigation, useTheme)
10. ✅ Pages (MeshPage, ChatPage, NavigationPage, SystemPage, SettingsPage)

### Code Organization Rules

1. **One component per file**
2. **Components in PascalCase files**
3. **Hooks in camelCase files starting with 'use'**
4. **Export default at end of file**
5. **Props interfaces defined above component**
6. **Shared types in separate types files**
7. **Utils in separate utils folder**
8. **Max 300 lines per component file**
9. **Related components grouped in folders**
10. **Index.ts for folder exports**

## TESTING AFTER REFACTORING

```bash
# Ensure all imports work
npm run type-check

# Build to verify no circular dependencies
npm run build

# Run dev server
npm run dev
```

## SUCCESS CRITERIA

✅ App.tsx < 500 lines  
✅ All components in separate files  
✅ Proper folder structure  
✅ No circular dependencies  
✅ All imports working  
✅ Application builds successfully  
✅ Application runs without errors  
✅ No functionality lost  
✅ Code easier to read and maintain  
✅ Components reusable across pages

**RESULT: App.tsx 68,065 lines → < 500 lines, Fully Modular ✓**
