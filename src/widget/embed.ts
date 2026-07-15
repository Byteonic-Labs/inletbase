/**
 * IIFE entry point for the vanilla `<script>` chat widget.
 *
 * This module self-executes on load. It resolves its own `<script>` element,
 * reads the `data-chatbot-id` (and optional `data-base-url`) attributes, then
 * mounts the full chat experience onto the host page inside a Shadow DOM.
 *
 * Attribute contract (matches the Existing_Widget, Req 2.8):
 *
 * ```html
 * <script src="https://unpkg.com/inletbase/dist/widget/inletbase-chat.js"
 *         data-chatbot-id="YOUR_BOT_ID"
 *         async></script>
 * ```
 *
 * Behaviour:
 * - Missing `data-chatbot-id` → report a console error and do **not** mount
 *   (Req 2.7).
 * - Config-load failure → do **not** mount the chat experience and surface a
 *   console error (Req 2.6). The engine ends in `status: 'error'`; because we
 *   only attach the widget to the page after a successful config load, nothing
 *   is added to `document.body` on failure.
 */

import { ChatEngine } from '../core/chatEngine';
import { mountWidget } from './render';
import { widgetStyles } from './styles';

/** Attribute carrying the bot id (matches the Existing_Widget). */
const BOT_ID_ATTR = 'data-chatbot-id';

const LOG_PREFIX = '[inletbase]';

/**
 * Resolves the `<script>` element that loaded this widget.
 *
 * Prefers `document.currentScript` (accurate while the script is executing),
 * and falls back to the last `script[data-chatbot-id]` on the page for cases
 * where `currentScript` is unavailable (e.g. module/deferred execution).
 */
function resolveScript(doc: Document): HTMLScriptElement | null {
  const current = doc.currentScript;
  if (current && current instanceof HTMLScriptElement && current.hasAttribute(BOT_ID_ATTR)) {
    return current;
  }
  if (current && current instanceof HTMLScriptElement) {
    return current;
  }
  const candidates = doc.querySelectorAll<HTMLScriptElement>(`script[${BOT_ID_ATTR}]`);
  if (candidates.length > 0) {
    return candidates[candidates.length - 1];
  }
  return null;
}

/**
 * Reads configuration attributes from the resolved script element.
 */
function readConfig(script: HTMLScriptElement | null): {
  botId: string;
} {
  const botId = script?.getAttribute(BOT_ID_ATTR)?.trim() ?? '';
  return { botId };
}

/**
 * Bootstraps the widget: reads attributes, validates the bot id, loads the
 * chat config, and only then attaches the widget to `document.body`.
 *
 * Exported for testing; also invoked automatically on load (see bottom).
 */
export async function bootstrapWidget(doc: Document = document): Promise<void> {
  const script = resolveScript(doc);
  const { botId } = readConfig(script);

  // Req 2.7 — no bot id supplied: report a visible/console error, do not mount.
  if (!botId) {
    // eslint-disable-next-line no-console
    console.error(
      `${LOG_PREFIX} Missing "${BOT_ID_ATTR}" attribute on the widget <script> tag. ` +
        `The chatbot was not mounted.`
    );
    return;
  }

  const engine = new ChatEngine({ botId });

  // Load the config before touching the DOM so that a config-load failure
  // (Req 2.6) leaves the host page untouched.
  await engine.init();

  const state = engine.getState();
  if (state.status === 'error') {
    // eslint-disable-next-line no-console
    console.error(
      `${LOG_PREFIX} Unable to start the chatbot: ${state.error ?? 'unknown error'}. ` +
        `The chatbot was not mounted.`
    );
    engine.destroy();
    return;
  }

  // Config loaded successfully — create an isolated host and mount.
  const host = doc.createElement('div');
  host.setAttribute('data-inletbase-widget', botId);
  const body = doc.body ?? doc.documentElement;
  body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  mountWidget(shadow, engine, { css: widgetStyles, document: doc });
}

// Self-execute on load. Guard against non-browser environments so importing
// this module (e.g. in a test runner without a DOM) does not throw.
if (typeof document !== 'undefined') {
  void bootstrapWidget().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`${LOG_PREFIX} Failed to initialise the chatbot widget.`, err);
  });
}
