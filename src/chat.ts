import { ChatClientConfig } from './types';
import { fetchWithTimeout } from './core/http';
import { parseSSEStream } from './core/sse';

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
  private apiKey?: string;
  private baseUrl: string;

  /**
   * Constructs a chat client. The chat backend authenticates via Origin_Auth,
   * so an API key is not required: constructing with or without a key always
   * succeeds and never emits a missing-key warning. A supplied key is stored
   * for backward compatibility but is ignored by the backend.
   */
  constructor(config: ChatClientConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.inletbase.com/api/v1/chat';
  }

  /**
   * Retrieves the public appearance configuration for a chatbot.
   *
   * Sends `GET {baseUrl}/config?id={botId}` bounded by a 10-second abort. The
   * chat backend authenticates via Origin_Auth (Origin/Referer matched against
   * the bot's allowed domains) and ignores any Authorization header, so no API
   * key is required here.
   *
   * Behaviour (Requirements 3.1-3.5, 5.4):
   * - Success (2xx) with a non-null envelope `data` object -> returns the
   *   unwrapped `data` (the backend responds with `{ success, data: {...} }`).
   * - Success (2xx) with null/absent `data` -> returns `null`.
   * - Non-2xx -> throws an Error whose message includes the numeric status; a
   *   `403` surfaces a domain-authorization error message that includes `403`.
   *   No partial or cached config is returned.
   * - Timeout (10s) or network failure -> throws an error distinct from an HTTP
   *   status.
   *
   * A rejection never corrupts the instance: Origin_Auth is a request-time
   * check, so the same client remains usable for subsequent calls.
   */
  async getConfig(botId: string): Promise<ChatbotConfig | null> {
    const url = `${this.baseUrl}/config?id=${botId}`;

    const result = await fetchWithTimeout(url, { method: 'GET' }, 10_000);

    // Timeout abort: surface a timeout error distinct from any HTTP status.
    if (result.timedOut) {
      throw new Error('Chat config request timed out after 10000ms');
    }

    // Network-level failure before any HTTP status was received.
    if (result.networkError) {
      throw new Error(`Chat config request failed: ${result.networkError.message}`);
    }

    const response = result.response!;

    // Non-2xx: throw an error including the numeric status; never return a
    // partial/cached config object.
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          `Chat config request failed with status 403: domain not authorized. ` +
          `The request Origin/Referer does not match this chatbot's allowed domains.`
        );
      }
      throw new Error(`Chat config request failed with status ${response.status}`);
    }

    const json = await response.json();

    // The backend wraps the appearance config in an envelope:
    // { success: true, data: { ...appearance, remove_branding } }
    // Unwrap `data` so callers receive the config fields directly. A null or
    // absent `data` maps to `null` for the consumer.
    if (json && typeof json === 'object' && 'data' in json) {
      const data = (json as { data: ChatbotConfig | null }).data;
      if (data && typeof data === 'object') {
        return data;
      }
      return null;
    }

    return null;
  }

  /**
   * Requests a generated chat response and streams it back through the chunk
   * callback.
   *
   * Sends `POST {baseUrl}/generate` with the JSON body
   * `{ chatbot_id, session_id, message, history }` (Req 4.1). The chat backend
   * authenticates via Origin_Auth and ignores `Authorization`, so no API key is
   * required; a stored key is forwarded for backward compatibility when present
   * but never blocks the request (Req 5.2).
   *
   * The SSE response body is delegated to `parseSSEStream`, which:
   * - appends each `choices[0].delta.content` and invokes `options.onChunk`
   *   with the running accumulation (Req 4.2);
   * - robustly ignores non-`data:`, empty, partial, or unparseable lines
   *   without touching the accumulation or the callback (Req 4.3);
   * - completes on `data: [DONE]` without a final callback (Req 4.4).
   *
   * Result shape `GenerateResponse { success, message?, error? }`:
   * - Non-2xx BEFORE streaming -> `{ success: false, error }` with the numeric
   *   status embedded; the chunk callback is never invoked and any subsequent
   *   SSE bytes are ignored (Req 4.5).
   * - Premature stream termination (stream ends without `[DONE]`) ->
   *   `{ success: false, error, message }` while RETAINING the content
   *   accumulated so far in `message` (Req 4.6).
   * - Success (`[DONE]` observed) -> `{ success: true, message }` with the final
   *   accumulated content.
   * - A network-level failure before any status -> `{ success: false, error }`.
   */
  async generate(
    botId: string,
    sessionId: string,
    message: string,
    history: ChatMessage[] = [],
    options?: GenerateOptions
  ): Promise<GenerateResponse> {
    const url = `${this.baseUrl}/generate`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Origin_Auth is used by the backend; forward a key only when present for
    // backward compatibility, never sending a `Bearer undefined` header.
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatbot_id: botId,
          session_id: sessionId,
          message,
          history,
        }),
      });
    } catch (err: any) {
      // Network-level failure before any HTTP status was received.
      return { success: false, error: err?.message || 'Network error' };
    }

    // Non-2xx before streaming: surface an error including the status and do
    // NOT invoke the chunk callback or consume any SSE for this request (Req 4.5).
    if (!response.ok) {
      let detail = '';
      try {
        const errorData = await response.json();
        if (errorData && typeof errorData.error === 'string') {
          detail = `: ${errorData.error}`;
        }
      } catch {
        // Body may be empty or non-JSON; the status alone conveys the error.
      }
      return {
        success: false,
        error: `Chat generation failed with status ${response.status}${detail}`,
      };
    }

    // A successful status must carry a readable body stream to parse (Req 4.6:
    // treat a missing/closed body as a premature termination).
    if (!response.body) {
      return {
        success: false,
        error: 'Chat generation stream ended before completion',
        message: '',
      };
    }

    const { content, doneSeen } = await parseSSEStream(response.body, {
      onContent: (accumulated) => {
        options?.onChunk?.(accumulated);
      },
      onDone: () => {
        // Completion is reported via the returned `doneSeen`; no callback fires
        // for the `[DONE]` sentinel (Req 4.4).
      },
    });

    // Stream ended without a `[DONE]` sentinel: premature termination. Retain
    // the accumulated content in the result (Req 4.6).
    if (!doneSeen) {
      return {
        success: false,
        error: 'Chat generation stream ended before completion',
        message: content,
      };
    }

    // `[DONE]` observed. The stream completed cleanly, but the model may have
    // produced no usable content (empty or whitespace-only accumulation). Treat
    // that as a soft failure so every consumer can show a fallback instead of an
    // empty/blank assistant message. The (blank) content is still returned for
    // callers that want it.
    if (content.trim() === '') {
      return {
        success: false,
        error: 'The assistant returned an empty response.',
        message: content,
      };
    }

    // `[DONE]` observed with content: the last accumulation is the final response (Req 4.4).
    return { success: true, message: content };
  }
}
