/**
 * Hosted chat-widget loader.
 *
 * The Inletbase backend (`api.inletbase.com`) is the single source of truth for
 * the chat widget's UI, styling, and behaviour. This package does NOT reimplement
 * the widget — it simply injects the backend-hosted script, so any change shipped
 * on the backend reaches every embed instantly without republishing this SDK.
 *
 * The injected `<script src="{baseUrl}/widget/chatbot.js" data-chatbot-id="…">`
 * reads its own `data-chatbot-id`, fetches the bot's appearance config, and
 * mounts the full chat experience on the page. Chat authenticates via Origin_Auth
 * (the request's Origin/Referer is matched against the bot's allowed domains), so
 * no API key is involved.
 */

/** Default backend origin that hosts the widget script + chat API. */
export const DEFAULT_CHAT_BASE_URL = 'https://api.inletbase.com';

export interface LoadChatbotOptions {
  /** The chatbot identifier. Required; an empty value is a no-op. */
  botId: string;
  /** Override the backend origin (defaults to {@link DEFAULT_CHAT_BASE_URL}). */
  baseUrl?: string;
}

/** Marker attribute used to find/dedupe an injected widget script. */
const WIDGET_MARKER = 'data-inletbase-widget';

/**
 * Injects the hosted chat widget for `botId`.
 *
 * - No-op in non-browser environments (SSR) and when `botId` is empty.
 * - Injects only once per `botId`; a second call for the same bot returns a
 *   no-op teardown so it never removes another instance's widget.
 * - Returns a teardown that removes the injected script and the widget DOM the
 *   backend script mounts, so React unmount/remount cycles don't stack widgets.
 */
export function loadChatbotWidget(options: LoadChatbotOptions): () => void {
  const botId = typeof options?.botId === 'string' ? options.botId.trim() : '';
  const baseUrl = (options?.baseUrl || DEFAULT_CHAT_BASE_URL).replace(/\/+$/, '');

  if (typeof document === 'undefined' || !botId) {
    return () => {};
  }

  // Already injected for this bot — let the existing instance own the lifecycle.
  const existing = document.querySelector(
    `script[${WIDGET_MARKER}="${escapeAttr(botId)}"]`
  );
  if (existing) {
    return () => {};
  }

  const script = document.createElement('script');
  script.src = `${baseUrl}/widget/chatbot.js`;
  script.async = true;
  script.setAttribute('data-chatbot-id', botId);
  script.setAttribute(WIDGET_MARKER, botId);

  const host = document.body || document.documentElement;
  host.appendChild(script);

  return () => {
    if (script.parentNode) script.parentNode.removeChild(script);
    // The hosted widget mounts fixed-position containers with stable ids; remove
    // them so a remount doesn't leave a second widget behind. (These ids are
    // unique, so this only affects this bot's widget.)
    if (typeof document !== 'undefined') {
      document
        .querySelectorAll('#inletbase-chatbot-widget, #inletbase-proactive-popup')
        .forEach((el) => {
          if (el.parentNode) el.parentNode.removeChild(el);
        });
    }
    // Release the hosted widget's page-global init guard for this bot so a later
    // remount initialises a fresh instance. The widget keeps a Set of loaded bot
    // ids on `window.__inletbaseChatbotInstances` to stay idempotent against
    // double-injection (e.g. React Strict Mode); clearing it here keeps
    // unmount → remount cycles working.
    if (typeof window !== 'undefined') {
      (window as unknown as { __inletbaseChatbotInstances?: Set<string> })
        .__inletbaseChatbotInstances?.delete(botId);
    }
  };
}

/** Escapes `"` and `\` for safe use inside an attribute-selector value. */
function escapeAttr(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}
