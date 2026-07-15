import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ChatEngine, ChatViewModel } from '../core/chatEngine';

/**
 * Props for the {@link InletbaseChatbot} drop-in component.
 *
 * A Consumer embeds a fully working chat widget by supplying only `botId`; no
 * chat UI markup is required (Req 1.1, 1.2).
 */
export interface InletbaseChatbotProps {
  /** The chatbot identifier. Required; an empty value renders an error state. */
  botId: string;
  /**
   * Accepted for backward compatibility but ignored: chat authenticates via
   * Origin_Auth and never requires an API key (Req 1.5).
   */
  apiKey?: string;
  /** Optional extra class applied to the widget root. */
  className?: string;
  /** Optional inline style applied to the widget root. */
  style?: React.CSSProperties;
}

const STYLE_ELEMENT_ID = 'inletbase-chat-styles';
const DEFAULT_PRIMARY = '#4f46e5';

const WIDGET_CSS = `
.inletbase-chat-root {
  position: fixed;
  z-index: 2147483000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #111827;
  box-sizing: border-box;
}
.inletbase-chat-root *,
.inletbase-chat-root *::before,
.inletbase-chat-root *::after {
  box-sizing: border-box;
}
.inletbase-chat-launcher {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: var(--inletbase-chat-primary, ${DEFAULT_PRIMARY});
  color: #fff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  line-height: 1;
}
.inletbase-chat-panel {
  width: 360px;
  max-width: calc(100vw - 32px);
  height: 520px;
  max-height: calc(100vh - 32px);
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
.inletbase-chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--inletbase-chat-primary, ${DEFAULT_PRIMARY});
  color: #fff;
}
.inletbase-chat-header-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.25);
}
.inletbase-chat-header-title {
  font-weight: 600;
  font-size: 15px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inletbase-chat-header-close {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 0 4px;
}
.inletbase-chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #f9fafb;
}
.inletbase-chat-bubble {
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
.inletbase-chat-bubble-user {
  align-self: flex-end;
  background: var(--inletbase-chat-primary, ${DEFAULT_PRIMARY});
  color: #fff;
  border-bottom-right-radius: 4px;
}
.inletbase-chat-bubble-assistant {
  align-self: flex-start;
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #111827;
  border-bottom-left-radius: 4px;
}
.inletbase-chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 12px;
  background: #f9fafb;
}
.inletbase-chat-suggestion {
  border: 1px solid var(--inletbase-chat-primary, ${DEFAULT_PRIMARY});
  color: var(--inletbase-chat-primary, ${DEFAULT_PRIMARY});
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.inletbase-chat-input-row {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.inletbase-chat-input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  color: #111827;
  background: #fff;
}
.inletbase-chat-input:focus {
  border-color: var(--inletbase-chat-primary, ${DEFAULT_PRIMARY});
}
.inletbase-chat-send {
  border: none;
  border-radius: 10px;
  padding: 0 16px;
  background: var(--inletbase-chat-primary, ${DEFAULT_PRIMARY});
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.inletbase-chat-send:disabled {
  opacity: 0.6;
  cursor: default;
}
.inletbase-chat-error {
  padding: 20px 16px;
  text-align: center;
  color: #b91c1c;
  font-size: 14px;
}
`;

/**
 * Injects the widget stylesheet into the document head exactly once. Classes
 * are prefixed (`inletbase-chat-*`) to avoid collisions with host-page styles.
 */
function ensureStylesInjected(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = WIDGET_CSS;
  document.head.appendChild(style);
}

/** Maps a config position to fixed-placement inline styles. */
function positionStyles(position?: ChatViewModel['position']): React.CSSProperties {
  switch (position) {
    case 'bottom-left':
      return { bottom: 16, left: 16, alignItems: 'flex-start' };
    case 'top-right':
      return { top: 16, right: 16, alignItems: 'flex-end' };
    case 'top-left':
      return { top: 16, left: 16, alignItems: 'flex-start' };
    case 'bottom-right':
    default:
      return { bottom: 16, right: 16, alignItems: 'flex-end' };
  }
}

/**
 * Drop-in React chatbot. Renders the full chat experience (launcher, header,
 * scrollable history, streaming bubble, suggestion chips, text input, and send
 * control) from only a `botId`, applying appearance from the bot's dashboard
 * config. Chat authenticates via Origin_Auth and requires no API key.
 */
export function InletbaseChatbot(props: InletbaseChatbotProps): React.JSX.Element {
  const { botId, apiKey, className, style } = props;

  // Latest optional value captured for engine construction. The engine is
  // memoized on botId; apiKey is read at construction time from this ref.
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  // Construct a ChatEngine memoized on botId.
  const engine = useMemo(
    () => new ChatEngine({ botId, apiKey: apiKeyRef.current }),
    [botId]
  );

  // Bind the engine's immutable snapshot to React.
  const state = useSyncExternalStore(
    (listener) => engine.subscribe(listener),
    () => engine.getState(),
    () => engine.getState()
  );

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureStylesInjected();
  }, []);

  // Initialise (validate botId + load config) once per engine, and clean up.
  useEffect(() => {
    void engine.init();
    return () => engine.destroy();
  }, [engine]);

  const view = engine.getViewModel();
  const primary = view.primary_color || DEFAULT_PRIMARY;
  const title = view.widget_title || 'Chat';

  // Auto-scroll the history to the newest content.
  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages, state.streamedMessage, isOpen]);

  const isError = state.status === 'error';
  const canSend =
    !isError && draft.trim().length > 0 && !state.isLoading;

  const handleSend = () => {
    const text = draft.trim();
    if (!text || state.isLoading || isError) return;
    setDraft('');
    void engine.sendMessage(text);
  };

  const handleSuggestion = (suggestion: string) => {
    if (state.isLoading || isError) return;
    void engine.sendMessage(suggestion);
  };

  const rootStyle: React.CSSProperties = {
    ...positionStyles(view.position),
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    ['--inletbase-chat-primary' as any]: primary,
    ...style,
  };

  const rootClassName = className
    ? `inletbase-chat-root ${className}`
    : 'inletbase-chat-root';

  return (
    <div className={rootClassName} style={rootStyle}>
      {isOpen && (
        <div className="inletbase-chat-panel" role="dialog" aria-label={title}>
          <div className="inletbase-chat-header">
            {view.bot_avatar && (
              <img
                className="inletbase-chat-header-avatar"
                src={view.bot_avatar}
                alt=""
              />
            )}
            <span className="inletbase-chat-header-title">{title}</span>
            <button
              type="button"
              className="inletbase-chat-header-close"
              aria-label="Close chat"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          {isError ? (
            <div className="inletbase-chat-error" role="alert">
              {state.error === 'A botId is required'
                ? 'A botId is required to load this chatbot.'
                : 'This chatbot could not be loaded. Please try again later.'}
            </div>
          ) : (
            <>
              <div className="inletbase-chat-history" ref={historyRef}>
                {state.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={
                      msg.role === 'user'
                        ? 'inletbase-chat-bubble inletbase-chat-bubble-user'
                        : 'inletbase-chat-bubble inletbase-chat-bubble-assistant'
                    }
                  >
                    {msg.content}
                  </div>
                ))}
                {state.isStreaming && state.streamedMessage && (
                  <div className="inletbase-chat-bubble inletbase-chat-bubble-assistant">
                    {state.streamedMessage}
                  </div>
                )}
              </div>

              {state.messages.length <= 1 &&
                view.suggestions &&
                view.suggestions.length > 0 && (
                  <div className="inletbase-chat-suggestions">
                    {view.suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className="inletbase-chat-suggestion"
                        onClick={() => handleSuggestion(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

              <div className="inletbase-chat-input-row">
                <input
                  className="inletbase-chat-input"
                  type="text"
                  value={draft}
                  placeholder="Type a message…"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  type="button"
                  className="inletbase-chat-send"
                  onClick={handleSend}
                  disabled={!canSend}
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className="inletbase-chat-launcher"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        onClick={() => setIsOpen((o) => !o)}
      >
        {isOpen ? '×' : '💬'}
      </button>
    </div>
  );
}
