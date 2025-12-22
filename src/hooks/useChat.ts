import { useState, useCallback } from 'react';
import { Message, Citation } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';

const COOLDOWN_MS = 2000; // 2 second cooldown between messages

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSendTime, setLastSendTime] = useState(0);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);

  const sendMessage = useCallback(async (content: string) => {
    const now = Date.now();
    const timeSinceLastSend = now - lastSendTime;
    
    if (timeSinceLastSend < COOLDOWN_MS) {
      const waitTime = Math.ceil((COOLDOWN_MS - timeSinceLastSend) / 1000);
      throw new Error(`Please wait ${waitTime} second${waitTime > 1 ? 's' : ''} before sending another message.`);
    }

    if (!content.trim()) {
      throw new Error('Please enter a message.');
    }

    setIsLoading(true);
    setLastSendTime(now);

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { message: content.trim() },
      });

      if (error) {
        throw new Error(error.message || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
        verified: data.verified || false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setActiveCitations(data.citations || []);

    } catch (error) {
      // Remove the user message on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [lastSendTime]);

  const viewCitations = useCallback((message: Message) => {
    setActiveCitations(message.citations || []);
  }, []);

  const getCooldownRemaining = useCallback(() => {
    const elapsed = Date.now() - lastSendTime;
    if (elapsed >= COOLDOWN_MS) return 0;
    return Math.ceil((COOLDOWN_MS - elapsed) / 1000);
  }, [lastSendTime]);

  return {
    messages,
    isLoading,
    activeCitations,
    sendMessage,
    viewCitations,
    getCooldownRemaining,
  };
}