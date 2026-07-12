import { useState, useCallback, useEffect } from 'react';
import { useInletbaseClient } from './provider';
import { InletbaseChatClient, ChatMessage, ChatbotConfig } from '../chat';
import { resolveApiKey, readEnvKeys } from '../core/credentials';

export interface UseInletbaseChatbotOptions {
  botId: string;
  apiKey?: string;
  baseUrl?: string;
  stream?: boolean;
}

export function useInletbaseChatbot(options: UseInletbaseChatbotOptions | string) {
  const botId = typeof options === 'string' ? options : options.botId;
  const configApiKey = typeof options === 'string' ? undefined : options.apiKey;
  const configBaseUrl = typeof options === 'string' ? undefined : options.baseUrl;
  const configStream = typeof options === 'string' ? false : (options.stream ?? true);

  let contextClient: any;
  try {
    contextClient = useInletbaseClient();
  } catch (e) {
    // Suppress error if outside provider
  }

  const [client, setClient] = useState<InletbaseChatClient | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<ChatbotConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedMessage, setStreamedMessage] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from local storage exclusively on the client after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`inletbase_messages_${botId}`);
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
    let sid = typeof window !== 'undefined' ? localStorage.getItem(`inletbase_chat_${botId}`) : null;
    if (!sid) {
      sid = Math.random().toString(36).substring(2, 15);
      if (typeof window !== 'undefined') localStorage.setItem(`inletbase_chat_${botId}`, sid);
    }
    setSessionId(sid);

    // The chat backend authenticates via Origin_Auth, so a key is optional.
    // Resolve it if present (explicit → provider context → env) but always
    // construct the client and never warn when it is absent.
    const envKeys = readEnvKeys();
    const finalApiKey = resolveApiKey({
      explicit: configApiKey,
      context: (contextClient as any)?.apiKey,
      nextPublic: envKeys.nextPublic,
      vite: envKeys.vite,
    });

    const resolvedClient = new InletbaseChatClient({ apiKey: finalApiKey, baseUrl: configBaseUrl });
    setClient(resolvedClient);

    if (isInitialized) {
      setError(null);
      // getConfig throws on network/non-2xx (e.g. blocked origin, CSP, 403).
      // Catch it and surface via `error` state so it never becomes an unhandled
      // promise rejection.
      resolvedClient.getConfig(botId).then(cfg => {
        if (cfg) {
          setConfig(cfg);
          // Only set welcome message if we don't have stored messages
          setMessages(prev => {
            if (prev.length === 0 && cfg.welcome_message) {
              return [{ role: 'assistant', content: cfg.welcome_message }];
            }
            return prev;
          });
        }
      }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load chatbot configuration');
      });
    }
  }, [botId, configApiKey, configBaseUrl, isInitialized]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem(`inletbase_messages_${botId}`, JSON.stringify(messages));
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

      // Only render an assistant bubble when there is real (non-blank) content.
      // A blank message (empty or whitespace-only) is treated as "no response"
      // so we show a friendly fallback instead of an empty bubble.
      const finalMessage = res.message?.trim();
      if (res.success && finalMessage) {
        setMessages([...newHistory, { role: 'assistant', content: res.message! }]);
      } else {
        const fallback = res.error || 'No response was generated. Please try again.';
        setMessages([...newHistory, { role: 'assistant', content: fallback }]);
      }
    } catch (e) {
      if (configStream) setIsStreaming(false);
      setMessages([...newHistory, { role: 'assistant', content: 'Network error.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [client, messages, botId, sessionId, configStream]);

  const clearHistory = useCallback(() => {
    setMessages(config?.welcome_message ? [{ role: 'assistant', content: config.welcome_message }] : []);
    const sid = Math.random().toString(36).substring(2, 15);
    setSessionId(sid);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`inletbase_chat_${botId}`, sid);
      localStorage.removeItem(`inletbase_messages_${botId}`);
    }
  }, [botId, config]);

  return {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    streamedMessage,
    config,
    clearHistory,
    error
  };
}
