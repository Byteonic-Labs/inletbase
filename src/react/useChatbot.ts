import { useState, useCallback, useEffect } from 'react';
import { useByteonicClient } from './provider';
import { ByteonicChatClient, ChatMessage, ChatbotConfig } from '../chat';

export interface UseByteonicChatbotOptions {
  botId: string;
  apiKey?: string;
  baseUrl?: string;
  stream?: boolean;
}

export function useByteonicChatbot(options: UseByteonicChatbotOptions | string) {
  const botId = typeof options === 'string' ? options : options.botId;
  const configApiKey = typeof options === 'string' ? undefined : options.apiKey;
  const configBaseUrl = typeof options === 'string' ? undefined : options.baseUrl;
  const configStream = typeof options === 'string' ? false : (options.stream ?? true);

  let contextClient: any;
  try {
    contextClient = useByteonicClient();
  } catch (e) {
    // Suppress error if outside provider
  }

  const [client, setClient] = useState<ByteonicChatClient | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<ChatbotConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedMessage, setStreamedMessage] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from local storage exclusively on the client after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`byteonic_messages_${botId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {}
      }
    }
    setIsInitialized(true);
  }, [botId]);

  useEffect(() => {
    // Generate a random session ID if not exists (using localStorage to persist across tabs/reloads)
    let sid = typeof window !== 'undefined' ? localStorage.getItem(`byteonic_chat_${botId}`) : null;
    if (!sid) {
      sid = Math.random().toString(36).substring(2, 15);
      if (typeof window !== 'undefined') localStorage.setItem(`byteonic_chat_${botId}`, sid);
    }
    setSessionId(sid);

    let resolvedClient: ByteonicChatClient | null = null;
    
    // Attempt to pull apiKey from context, then config, then env
    const finalApiKey = configApiKey || (contextClient as any)?.apiKey || 
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BYTEONIC_API_KEY) ||
      (typeof (globalThis as any).import?.meta !== 'undefined' && (globalThis as any).import?.meta?.env?.VITE_BYTEONIC_API_KEY) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BYTEONIC_API_KEY);

    if (finalApiKey) {
      resolvedClient = new ByteonicChatClient({ apiKey: finalApiKey as string, baseUrl: configBaseUrl });
      setClient(resolvedClient);
    } else {
      console.warn('Byteonic Chatbot: No API Key provided. Chat will not function.');
    }

    if (resolvedClient && isInitialized) {
      resolvedClient.getConfig(botId).then(cfg => {
        if (cfg) {
          setConfig(cfg);
          // Only set welcome message if we don't have stored messages
          setMessages(prev => {
            if (prev.length === 0 && cfg.welcomeMessage) {
              return [{ role: 'assistant', content: cfg.welcomeMessage }];
            }
            return prev;
          });
        }
      });
    }
  }, [botId, configApiKey, configBaseUrl, isInitialized]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem(`byteonic_messages_${botId}`, JSON.stringify(messages));
    }
  }, [messages, botId, isInitialized]);

  const sendMessage = useCallback(async (content: string) => {
    if (!client || !content.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsLoading(true);

    if (configStream) {
      setIsStreaming(true);
      setStreamedMessage('');
    }

    try {
      const res = await client.generate(botId, sessionId, content, messages, {
        onChunk: configStream ? (chunk: string) => setStreamedMessage(chunk) : undefined
      });
      
      if (configStream) {
        setIsStreaming(false);
        setStreamedMessage('');
      }

      if (res.success && res.message) {
        setMessages([...newHistory, { role: 'assistant', content: res.message }]);
      } else {
        setMessages([...newHistory, { role: 'assistant', content: res.error || 'Sorry, I encountered an error.' }]);
      }
    } catch (e) {
      if (configStream) setIsStreaming(false);
      setMessages([...newHistory, { role: 'assistant', content: 'Network error.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [client, messages, botId, sessionId, configStream]);

  const clearHistory = useCallback(() => {
    setMessages(config?.welcomeMessage ? [{ role: 'assistant', content: config.welcomeMessage }] : []);
    const sid = Math.random().toString(36).substring(2, 15);
    setSessionId(sid);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`byteonic_chat_${botId}`, sid);
      localStorage.removeItem(`byteonic_messages_${botId}`);
    }
  }, [botId, config]);

  return {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    streamedMessage,
    config,
    clearHistory
  };
}
