import { useState, useEffect, FormEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageInputProps {
  onSend: (message: string) => Promise<void>;
  isLoading: boolean;
  getCooldownRemaining: () => number;
}

export function MessageInput({ onSend, isLoading, getCooldownRemaining }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Update cooldown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldown(getCooldownRemaining());
    }, 100);
    return () => clearInterval(interval);
  }, [getCooldownRemaining]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading || cooldown > 0) return;

    setError(null);
    try {
      await onSend(message);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isDisabled = isLoading || cooldown > 0 || !message.trim();

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card p-4">
      {error && (
        <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="..."
            className="min-h-[52px] max-h-[200px] resize-none bg-background border-border focus:ring-primary/20 pr-4"
            rows={1}
          />
        </div>
        <Button
          type="submit"
          disabled={isDisabled}
          className="h-[52px] px-5 gradient-warm text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : cooldown > 0 ? (
            <span className="text-sm font-medium">{cooldown}s</span>
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </form>