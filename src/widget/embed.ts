/**
 * IIFE entry for the vanilla `<script>` chat widget.
 *
 * This is a thin loader: it reads `data-chatbot-id` (and an optional
 * `data-base-url`) from its own `<script>` tag and injects the backend-hosted
 * widget script, which owns the entire chat UI/logic. It exists so the
 * `unpkg.com/inletbase/dist/widget/inletbase-chat.js` URL keeps working while
 * delegating to the single source of truth on the backend.
 *
 * New integrations can also embed the backend script directly:
 *
 * ```html
 * <script src="https://api.inletbase.com/widget/chatbot.js"
 *         data-chatbot-id="YOUR_BOT_ID" async></script>
 * ```
 *
 * Behaviour:
 * - Missing `data-chatbot-id` → console error, nothing is injected.
 */

import { loadChatbotWidget } from './loader';

const BOT_ID_ATTR = 'data-chatbot-id';
const BASE_URL_ATTR = 'data-base-url';
const LOG_PREFIX = '[inletbase]';

/** Resolves the `<script>` element that loaded this widget. */
function resolveScript(doc: Document): HTMLScriptElement | null {
  const current = doc.currentScript;
  if (current instanceof HTMLScriptElement) {
    return current;
  }
  const candidates = doc.querySelectorAll<HTMLScriptElement>(`script[${BOT_ID_ATTR}]`);
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

if (typeof document !== 'undefined') {
  const script = resolveScript(document);
  const botId = script?.getAttribute(BOT_ID_ATTR)?.trim() ?? '';
  const baseUrl = script?.getAttribute(BASE_URL_ATTR)?.trim() || undefined;

  if (!botId) {
    // eslint-disable-next-line no-console
    console.error(
      `${LOG_PREFIX} Missing "${BOT_ID_ATTR}" attribute on the widget <script> tag. ` +
        `The chatbot was not mounted.`
    );
  } else {
    loadChatbotWidget({ botId, baseUrl });
  }
}
