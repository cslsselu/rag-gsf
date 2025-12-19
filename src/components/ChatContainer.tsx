import { useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { SearchBar } from './SearchBar';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { CitationsPanel } from './CitationsPanel';

export function ChatContainer() {
  const [searchQuery, setSearchQuery] = useState('');
  const { 
    messages, 
    isLoading, 
    activeCitations, 
    sendMessage, 
    viewCitations,
    getCooldownRemaining 
  } = useChat();

  return (
    <div className="flex h-[calc(100vh-80px)] max-w-6xl mx-auto rounded-2xl overflow-hidden border border-border shadow-card bg-card">
      {/* Chat Section */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search Bar */}
        <div className="p-4 border-b border-border bg-card/50">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
        
        {/* Messages */}
        <MessageList
          messages={messages}
          searchQuery={searchQuery}
          onViewCitations={viewCitations}
          isLoading={isLoading}
        />
        
        {/* Input */}
        <MessageInput
          onSend={sendMessage}
          isLoading={isLoading}
          getCooldownRemaining={getCooldownRemaining}
        />
      </div>
      
      {/* Citations Panel */}
      <div className="w-80 border-l border-border bg-card/50 hidden lg:block">
        <CitationsPanel citations={activeCitations} />
      </div>
    </div>
  );
}