import { InletbaseConfig } from './types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Public chatbot appearance config returned by the Inletbase chat API.
 * Mirrors the backend `/api/v1/chat/config` response (snake_case fields).
 */
export interface ChatbotConfig {
  theme?: 'light' | 'dark';
  primary_color?: string;
  text_color?: string;
  widget_title?: string;
  welcome_message?: string;
  placeholder_text?: string;
  bot_avatar?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  proactive_popup_enabled?: boolean;
  proactive_popup_delay?: number;
  suggestions?: string[];
  remove_branding?: boolean;
  [key: string]: any;
}

export interface GenerateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface GenerateOptions {
  onChunk?: (fullMessage: string) => void;
}

export class InletbaseChatClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: InletbaseConfig) {
    if (!config.apiKey) {
      throw new Error('[Inletbase] API Key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.inletbase.com/api/v1/chat';
  }

  async getConfig(botId: string): Promise<ChatbotConfig | null> {
    const url = `${this.baseUrl}/config?id=${botId}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      if (!response.ok) return null;
      const json = await response.json();
      // The backend wraps the appearance config in an envelope:
      // { success: true, data: { ...appearance, remove_branding } }
      // Unwrap `data` so callers receive the config fields directly.
      if (json && typeof json === 'object' && 'data' in json) {
        return (json as { data: ChatbotConfig }).data;
      }
      return json as ChatbotConfig;
    } catch {
      return null;
    }
  }

  async generate(botId: string, sessionId: string, message: string, history: ChatMessage[] = [], options?: GenerateOptions): Promise<GenerateResponse> {
    const url = `${this.baseUrl}/generate`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          chatbot_id: botId,
          session_id: sessionId,
          message,
          history
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Generation failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullMessage = '';

      if (reader) {
        let done = false;
        let buffer = '';
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete lines in buffer

            for (const line of lines) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  const content = data.choices?.[0]?.delta?.content;
                  if (content) {
                    fullMessage += content;
                    if (options?.onChunk) options.onChunk(fullMessage);
                  }
                } catch (e) {
                  // Ignore partial chunk parse errors
                }
              }
            }
          }
        }
      }

      return { success: true, message: fullMessage.trim() || 'No response generated.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  }
}
