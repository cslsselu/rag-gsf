import { useState } from 'react';
import { Copy, Check, BookOpen, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Message } from '@/types/chat';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: Message;
  isLatest: boolean;
  onViewCitations: (message: Message) => void;
}

export function ChatMessage({ message, isLatest, onViewCitations }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'group flex gap-3 animate-slide-up',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 shadow-soft',
          isUser
            ? 'bg-chat-user text-foreground'
            : 'bg-chat-assistant text-foreground border border-border'
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        
        {!isUser && (
          <div className={cn(
            'flex items-center gap-2 mt-3 pt-3 border-t border-border/50 transition-opacity',
            isLatest ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
            
            {message.citations && message.citations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewCitations(message)}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <BookOpen className="h-3 w-3 mr-1" />
                View citations ({message.citations.length})
              </Button>
            )}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}