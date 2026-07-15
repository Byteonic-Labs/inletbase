import { InletbaseChatClient, ChatMessage, ChatbotConfig } from '../chat';
import { KeyValueStorage, createDefaultStorage } from './storage';

/**
 * Options for constructing a {@link ChatEngine}.
 *
 * The engine is framework-agnostic: it owns the full chat behaviour (session
 * id, message history, streaming accumulation, config load, and error state)
 * so that both the React drop-in component and the vanilla `<script>` widget
 * consume identical logic.
 */
export interface ChatEngineOptions {
  /** The chatbot identifier sent to the chat backend as `chatbot_id`. */
  botId: string;
  /**
   * Accepted for backward compatibility but ignored by the backend: chat
   * authenticates via Origin_Auth and never requires an API key.
   */
  apiKey?: string;
  /** When `true` (the default) assistant replies stream token-by-token. */
  stream?: boolean;
  /** Injected persistence layer; defaults to the SSR-safe localStorage wrapper. */
  storage?: KeyValueStorage;
}

/**
 * Lifecycle status of a {@link ChatEngine}.
 *
 * - `idle`: constructed but `init()` has not completed.
 * - `loading-config`: `init()` is fetching the chat config.
 * - `ready`: config loaded; the chat experience is usable.
 * - `error`: a botId was missing or the config failed to load; no functional
 *   chat input should be presented.
 */
export type ChatEngineStatus = 'idle' | 'loading-config' | 'ready' | 'error';

/**
 * Immutable snapshot of the engine's state exposed to subscribers.
 */
export interface ChatEngineState {
  status: ChatEngineStatus;
  config: ChatbotConfig | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamedMessage: string;
  /** e.g. `"A botId is required"` or a config-load failure message. */
  error: string | null;
  sessionId: string;
}

/**
 * Appearance view model derived from the loaded {@link ChatbotConfig}.
 *
 * Both UI surfaces read from this single derived shape so appearance is applied
 * consistently (Requirements 1.3, 2.3).
 */
export interface ChatViewModel {
  welcome_message?: string;
  widget_title?: string;
  primary_color?: string;
  bot_avatar?: string;
  suggestions?: string[];
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const BOT_ID_REQUIRED_ERROR = 'A botId is required';

/**
 * Framework-agnostic chat state machine.
 *
 * Holds an immutable state snapshot, notifies subscribers on every change, and
 * never throws across its public surface. Built on {@link InletbaseChatClient}
 * for the network layer and an injected {@link KeyValueStorage} for
 * persistence.
 */
export class ChatEngine {
  private readonly botId: string;
  private readonly stream: boolean;
  private readonly storage: KeyValueStorage;
  private readonly client: InletbaseChatClient;

  private state: ChatEngineState;
  private readonly listeners = new Set<() => void>();
  private destroyed = false;

  private readonly messagesKey: string;
  private readonly sessionKey: string;

  constructor(options: ChatEngineOptions) {
    this.botId = typeof options.botId === 'string' ? options.botId : '';
    this.stream = options.stream ?? true;
    this.storage = options.storage ?? createDefaultStorage();
    // The API key is accepted but ignored by the backend (Origin_Auth). It is
    // forwarded to the client only for backward compatibility.
    this.client = new InletbaseChatClient({
      apiKey: options.apiKey,
    });

    this.messagesKey = `inletbase_messages_${this.botId}`;
    this.sessionKey = `inletbase_chat_${this.botId}`;

    this.state = {
      status: 'idle',
      config: null,
      messages: this.loadPersistedMessages(),
      isLoading: false,
      isStreaming: false,
      streamedMessage: '',
      error: null,
      sessionId: this.loadOrCreateSessionId(),
    };
  }

  /** Returns the current immutable state snapshot. */
  getState(): ChatEngineState {
    return this.state;
  }

  /**
   * Derives the appearance view model from the loaded config. Returns an empty
   * object when no config is present.
   */
  getViewModel(): ChatViewModel {
    const cfg = this.state.config;
    if (!cfg) return {};
    return {
      welcome_message: cfg.welcome_message,
      widget_title: cfg.widget_title,
      primary_color: cfg.primary_color,
      bot_avatar: cfg.bot_avatar,
      suggestions: cfg.suggestions,
      position: cfg.position,
    };
  }

  /**
   * Registers a listener invoked on every state change. Returns an unsubscribe
   * function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Validates the botId, then loads the chat config.
   *
   * - Missing/empty/whitespace botId → `status: 'error'`, `error: 'A botId is
   *   required'`, and no network call (Req 1.7, 2.7).
   * - Config success → apply appearance, seed the welcome message when history
   *   is empty, `status: 'ready'` (Req 1.3, 2.3).
   * - Config failure → `status: 'error'` with `config` remaining `null`
   *   (Req 1.6, 2.6).
   */
  async init(): Promise<void> {
    if (this.destroyed) return;

    if (!this.botId || this.botId.trim() === '') {
      this.setState({ status: 'error', error: BOT_ID_REQUIRED_ERROR, config: null });
      return;
    }

    this.setState({ status: 'loading-config', error: null });

    try {
      const config = await this.client.getConfig(this.botId);
      if (this.destroyed) return;

      const messages = this.maybeSeedWelcome(this.state.messages, config);
      this.setState({
        status: 'ready',
        config: config ?? null,
        messages,
        error: null,
      });
      this.persistMessages(messages);
    } catch (err: unknown) {
      if (this.destroyed) return;
      this.setState({
        status: 'error',
        config: null,
        error: err instanceof Error ? err.message : 'Failed to load chatbot configuration',
      });
    }
  }

  /**
   * Sends a user message and streams the assistant reply.
   *
   * Appends the user message immediately, streams via `generate` (updating
   * `streamedMessage` through `onChunk`), then appends the assistant message or
   * a friendly fallback when the result is unsuccessful/empty (Req 1.4, 2.4).
   */
  async sendMessage(content: string): Promise<void> {
    if (this.destroyed) return;
    if (!content || !content.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content };
    const priorHistory = this.state.messages;
    const newHistory = [...priorHistory, userMsg];

    this.setState({
      messages: newHistory,
      isLoading: true,
      isStreaming: this.stream,
      streamedMessage: '',
    });
    this.persistMessages(newHistory);

    try {
      const res = await this.client.generate(
        this.botId,
        this.state.sessionId,
        content,
        priorHistory,
        {
          onChunk: this.stream
            ? (chunk: string) => {
                if (!this.destroyed) this.setState({ streamedMessage: chunk });
              }
            : undefined,
        }
      );

      if (this.destroyed) return;

      const finalMessage = res.message?.trim();
      const assistantContent =
        res.success && finalMessage
          ? res.message!
          : res.error || 'No response was generated. Please try again.';

      const finalMessages: ChatMessage[] = [
        ...newHistory,
        { role: 'assistant', content: assistantContent },
      ];

      this.setState({
        messages: finalMessages,
        isLoading: false,
        isStreaming: false,
        streamedMessage: '',
      });
      this.persistMessages(finalMessages);
    } catch {
      if (this.destroyed) return;
      const finalMessages: ChatMessage[] = [
        ...newHistory,
        { role: 'assistant', content: 'Network error.' },
      ];
      this.setState({
        messages: finalMessages,
        isLoading: false,
        isStreaming: false,
        streamedMessage: '',
      });
      this.persistMessages(finalMessages);
    }
  }

  /**
   * Clears the conversation, reseeding the welcome message when present, and
   * starts a fresh session id.
   */
  clearHistory(): void {
    if (this.destroyed) return;
    const welcome = this.state.config?.welcome_message;
    const messages: ChatMessage[] = welcome
      ? [{ role: 'assistant', content: welcome }]
      : [];
    const sessionId = this.createSessionId();

    this.storage.setItem(this.sessionKey, sessionId);
    this.storage.removeItem(this.messagesKey);

    this.setState({ messages, sessionId });
    // Re-seed persistence with the welcome message (if any) so a reload keeps it.
    this.persistMessages(messages);
  }

  /** Detaches all listeners and prevents further state updates. */
  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }

  // --- internal helpers ---------------------------------------------------

  private setState(partial: Partial<ChatEngineState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private maybeSeedWelcome(
    messages: ChatMessage[],
    config: ChatbotConfig | null
  ): ChatMessage[] {
    if (messages.length === 0 && config?.welcome_message) {
      return [{ role: 'assistant', content: config.welcome_message }];
    }
    return messages;
  }

  private loadPersistedMessages(): ChatMessage[] {
    const saved = this.storage.getItem(this.messagesKey);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed as ChatMessage[];
      }
    } catch {
      // Corrupt/unparseable persisted value — start fresh.
    }
    return [];
  }

  private persistMessages(messages: ChatMessage[]): void {
    try {
      this.storage.setItem(this.messagesKey, JSON.stringify(messages));
    } catch {
      // Persistence is best-effort; ignore failures.
    }
  }

  private loadOrCreateSessionId(): string {
    const existing = this.storage.getItem(this.sessionKey);
    if (existing) return existing;
    const sessionId = this.createSessionId();
    this.storage.setItem(this.sessionKey, sessionId);
    return sessionId;
  }

  private createSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
