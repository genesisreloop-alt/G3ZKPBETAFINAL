import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Users, MessageSquare, Search, Plus, UserPlus } from 'lucide-react';
import { MeshGroup, Message, TypingUser } from '../types';
import ChatListPanel from '../components/chat/ChatListPanel';
import ChatInterface from '../components/chat/ChatInterface';
import { useOperatorStore } from '../stores/operatorStore';

interface MeshContact {
  peerId: string;
  displayName?: string;
  avatar?: string;
  isOnline: boolean;
  lastMessage?: { content: string; timestamp: number; isMe: boolean; read: boolean };
  unreadCount: number;
}

interface MeshPageProps {
  meshGroups: MeshGroup[];
  meshContacts: MeshContact[];
  messages: Message[];
  selectedGroup: MeshGroup | null;
  typingUsers: TypingUser[];
  highlightedMessageId: string | null;
  onSelectGroup: (group: MeshGroup | null) => void;
  onSendMessage: (content: string, replyTo?: string | null) => void;
  onFileUpload: (file: File) => void;
  onVoiceMessage: (blob: Blob) => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  onAddContact: (contact: { peerId: string }) => void;
  onCall: (type: 'voice' | 'video') => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onStartTyping: () => void;
  onStopTyping: () => void;
  onViewThread: (messageId: string) => void;
  onViewTensorObject: (tensorData: any) => void;
  getMessageById: (id: string) => Message | undefined;
  fileProgress: number;
  isVerifying: boolean;
}

type ViewState = 'list' | 'chat' | 'group';

export default function MeshPage({
  meshGroups,
  meshContacts,
  messages,
  selectedGroup,
  typingUsers,
  highlightedMessageId,
  onSelectGroup,
  onSendMessage,
  onFileUpload,
  onVoiceMessage,
  onCreateGroup,
  onJoinGroup,
  onAddContact,
  onCall,
  onReactToMessage,
  onEditMessage,
  onDeleteMessage,
  onStartTyping,
  onStopTyping,
  onViewThread,
  onViewTensorObject,
  getMessageById,
  fileProgress,
  isVerifying
}: MeshPageProps) {
  const [activeTab, setActiveTab] = useState<'groups' | 'chats'>('chats');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewState, setViewState] = useState<ViewState>('list');
  
  const { getDisplayName, getAvatarUrl } = useOperatorStore();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile && viewState === 'list') {
        setViewState('list');
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewState]);

  const handleSelectChat = useCallback((chatId: string, type: 'contact' | 'group') => {
    setSelectedChatId(chatId);
    if (type === 'group') {
      const group = meshGroups.find(g => g.id === chatId);
      onSelectGroup(group || null);
    } else {
      onSelectGroup(null);
    }
    if (isMobile) {
      setViewState('chat');
    }
  }, [isMobile, meshGroups, onSelectGroup]);

  const handleBack = useCallback(() => {
    setViewState('list');
    setSelectedChatId(null);
    onSelectGroup(null);
  }, [onSelectGroup]);

  const selectedContact = meshContacts.find(c => c.peerId === selectedChatId);
  const chatName = selectedGroup?.name || selectedContact?.displayName || 'Chat';
  const isOnline = selectedContact?.isOnline || false;
  const memberCount = selectedGroup?.memberCount;

  if (isMobile && viewState === 'chat' && selectedChatId) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#010401]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#4caf50]/20 bg-black/60 backdrop-blur-md">
          <button 
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#4caf50]/10 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-[#00f3ff]" />
          </button>
          
          <div className="w-10 h-10 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/40 flex items-center justify-center flex-shrink-0">
            {selectedGroup ? (
              <Users className="w-5 h-5 text-[#4caf50]" />
            ) : (
              <span className="text-[#00f3ff] font-bold text-sm">
                {chatName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#00f3ff] truncate">{chatName}</h3>
            <p className="text-xs text-[#4caf50]/60">
              {selectedGroup 
                ? `${memberCount} members` 
                : isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
          
        </div>

        <ChatInterface
          messages={messages}
          onSend={onSendMessage}
          onFileUpload={onFileUpload}
          onVoiceMessage={onVoiceMessage}
          onReact={onReactToMessage}
          onEdit={onEditMessage}
          onDelete={onDeleteMessage}
          onStartTyping={onStartTyping}
          onStopTyping={onStopTyping}
          onViewThread={onViewThread}
          onViewTensorObject={onViewTensorObject}
          getMessageById={getMessageById}
          typingUsers={typingUsers}
          highlightedMessageId={highlightedMessageId}
          fileProgress={fileProgress}
          isVerifying={isVerifying}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#010401]">
      <div className={`${isMobile ? 'flex-1' : 'w-[320px] md:w-[360px]'} flex flex-col border-r border-[#4caf50]/20 bg-black/40`}>
        <div className="px-4 py-3 border-b border-[#4caf50]/20 bg-black/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#00f3ff] uppercase tracking-wider">MESH</h2>
            <span className="text-xs text-[#4caf50]/60 font-mono">
              {meshContacts.filter(c => c.isOnline).length} online
            </span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                activeTab === 'chats'
                  ? 'bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/40'
                  : 'bg-black/20 text-[#4caf50]/60 border border-[#4caf50]/20 hover:border-[#4caf50]/40'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              CHATS
            </button>
            <button 
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                activeTab === 'groups'
                  ? 'bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/40'
                  : 'bg-black/20 text-[#4caf50]/60 border border-[#4caf50]/20 hover:border-[#4caf50]/40'
              }`}
            >
              <Users className="w-4 h-4" />
              GROUPS
            </button>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-[#4caf50]/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4caf50]/40" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-black/40 border border-[#4caf50]/20 rounded-lg pl-10 pr-4 py-2.5 text-sm text-[#00f3ff] placeholder-[#4caf50]/40 focus:outline-none focus:border-[#00f3ff]/40"
            />
          </div>
        </div>

        <ChatListPanel
          activeTab={activeTab}
          groups={meshGroups}
          contacts={meshContacts}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onCreateGroup={onCreateGroup}
          onJoinGroup={onJoinGroup}
          onAddContact={onAddContact}
        />
      </div>

      {!isMobile && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedChatId ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#4caf50]/20 bg-black/60">
                <div className="w-10 h-10 rounded-full bg-[#4caf50]/20 border border-[#4caf50]/40 flex items-center justify-center">
                  {selectedGroup ? (
                    <Users className="w-5 h-5 text-[#4caf50]" />
                  ) : (
                    <span className="text-[#00f3ff] font-bold text-sm">
                      {chatName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#00f3ff] truncate">{chatName}</h3>
                  <p className="text-xs text-[#4caf50]/60">
                    {selectedGroup 
                      ? `${memberCount} members` 
                      : isOnline ? 'Online' : 'Last seen recently'}
                  </p>
                </div>
                
              </div>

              <ChatInterface
                messages={messages}
                onSend={onSendMessage}
                onFileUpload={onFileUpload}
                onVoiceMessage={onVoiceMessage}
                onReact={onReactToMessage}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onStartTyping={onStartTyping}
                onStopTyping={onStopTyping}
                onViewThread={onViewThread}
                onViewTensorObject={onViewTensorObject}
                getMessageById={getMessageById}
                typingUsers={typingUsers}
                highlightedMessageId={highlightedMessageId}
                fileProgress={fileProgress}
                isVerifying={isVerifying}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#010401]/50">
              <div className="w-24 h-24 rounded-full bg-[#4caf50]/10 border border-[#4caf50]/20 flex items-center justify-center mb-6">
                <MessageSquare className="w-12 h-12 text-[#4caf50]/40" />
              </div>
              <h3 className="text-lg font-bold text-[#00f3ff] mb-2">G3ZKP Messenger</h3>
              <p className="text-sm text-[#4caf50]/60 text-center max-w-md">
                Select a chat to start messaging with end-to-end encryption
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
