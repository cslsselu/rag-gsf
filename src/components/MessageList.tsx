import { useEffect, useRef } from 'react';
import { Message } from '@/types/chat';
import { ChatMessage } from './ChatMessage';
import { BookOpen } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  searchQuery: string;
  onViewCitations: (message: Message) => void;
  isLoading: boolean;
}

export function MessageList({ messages, searchQuery, onViewCitations, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Filter messages by search query
  const filteredMessages = searchQuery
    ? messages.filter(m => 
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md animate-fade-in">
          <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
            Start with a question you have about your course
          </h3>
          <p className="text-muted-foreground text-sm">
            Get clear answers backed by your documents
          </p>
        </div>
      </div>
    );
  }

  if (searchQuery && filteredMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center animate-fade-in">
          <p className="text-muted-foreground">
            No messages found matching "{searchQuery}"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
      {filteredMessages.map((message, index) => (
        <ChatMessage
          key={message.id}
          message={message}
          isLatest={index === filteredMessages.length - 1 && message.role === 'assistant'}
          onViewCitations={onViewCitations}
        />
      ))}
      
      {isLoading && (
        <div className="flex gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <div className="bg-chat-assistant border border-border rounded-2xl px-4 py-3 shadow-soft">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse-soft" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse-soft" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse-soft" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      )}
      
      <div ref={bottomRef} />
    </div>
  );
}