/**
 * Vanilla DOM renderer for the Inletbase chat widget.
 *
 * This module is framework-free: it subscribes to a {@link ChatEngine} and
 * paints the full chat experience (a floating launcher, a chat panel with a
 * header, a scrollable message list, a live streaming bubble, and a text
 * input) inside a Shadow DOM so the host page's styles cannot leak in and the
 * widget's styles cannot leak out.
 *
 * The renderer never touches credentials: all chat requests are issued by the
 * injected {@link ChatEngine}, which authenticates via Origin_Auth and carries
 * no API key (Requirements 2.2, 2.3, 2.4, 2.5).
 */

import { ChatEngine, ChatEngineState, ChatViewModel } from '../core/chatEngine';

/** Options accepted by {@link mountWidget}. */
export interface MountWidgetOptions {
  /**
   * Stylesheet injected into the Shadow DOM for structural layout. When
   * omitted, a self-contained default stylesheet is used so the widget renders
   * correctly on its own. The `embed.ts` entry supplies the richer stylesheet
   * from `./styles`.
   */
  css?: string;
  /**
   * The `Document` used to create elements. Defaults to the global `document`;
   * injectable for testing in non-browser environments.
   */
  document?: Document;
}

/** Handle returned by {@link mountWidget} for teardown. */
export interface WidgetHandle {
  /** The Shadow DOM root the widget was painted into. */
  readonly shadowRoot: ShadowRoot;
  /** Unsubscribes from the engine and removes the widget's DOM. */
  destroy(): void;
}

const DEFAULT_PRIMARY_COLOR = '#974CF1';
const DEFAULT_TEXT_COLOR = '#ffffff';
const DEFAULT_TITLE = 'AI Assistant';
const DEFAULT_PLACEHOLDER = 'Type your message...';

/**
 * Mounts the chat widget into `target` and binds it to `engine`.
 *
 * `target` may be a {@link ShadowRoot} (used directly) or a host element (a
 * Shadow DOM is attached to it). The returned {@link WidgetHandle} detaches the
 * engine subscription and clears the rendered DOM when destroyed.
 */
export function mountWidget(
  target: ShadowRoot | HTMLElement,
  engine: ChatEngine,
  options: MountWidgetOptions = {}
): WidgetHandle {
  const shadow = resolveShadowRoot(target);
  const doc = options.document ?? shadow.ownerDocument ?? globalDocument();

  // --- style injection --------------------------------------------------
  const styleEl = doc.createElement('style');
  styleEl.textContent = options.css ?? buildDefaultStyles();
  shadow.appendChild(styleEl);

  // --- static structure -------------------------------------------------
  const root = doc.createElement('div');
  root.className = 'inletbase-root';

  const launcher = doc.createElement('button');
  launcher.type = 'button';
  launcher.className = 'inletbase-launcher';
  launcher.setAttribute('aria-label', 'Open chat');

  const panel = doc.createElement('div');
  panel.className = 'inletbase-panel inletbase-hidden';

  const header = doc.createElement('div');
  header.className = 'inletbase-header';
  const headerAvatar = doc.createElement('div');
  headerAvatar.className = 'inletbase-header-avatar';
  const headerTitle = doc.createElement('div');
  headerTitle.className = 'inletbase-header-title';
  header.appendChild(headerAvatar);
  header.appendChild(headerTitle);

  const body = doc.createElement('div');
  body.className = 'inletbase-body';

  const messagesEl = doc.createElement('div');
  messagesEl.className = 'inletbase-messages';

  const suggestionsEl = doc.createElement('div');
  suggestionsEl.className = 'inletbase-suggestions';

  const errorEl = doc.createElement('div');
  errorEl.className = 'inletbase-error inletbase-hidden';

  body.appendChild(messagesEl);
  body.appendChild(suggestionsEl);
  body.appendChild(errorEl);

  // Input area (send control + text field).
  const inputArea = doc.createElement('div');
  inputArea.className = 'inletbase-input-area';
  const inputEl = doc.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'inletbase-input';
  const sendBtn = doc.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'inletbase-send';
  sendBtn.setAttribute('aria-label', 'Send message');
  sendBtn.textContent = 'Send';
  inputArea.appendChild(inputEl);
  inputArea.appendChild(sendBtn);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(inputArea);

  root.appendChild(panel);
  root.appendChild(launcher);
  shadow.appendChild(root);

  // --- interaction ------------------------------------------------------
  let open = false;

  const setOpen = (next: boolean) => {
    open = next;
    panel.classList.toggle('inletbase-hidden', !open);
    launcher.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (open) inputEl.focus();
  };

  launcher.addEventListener('click', () => setOpen(!open));

  const submit = () => {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    // The engine owns the network request; Origin_Auth means no API key is
    // ever attached here (Req 2.5).
    void engine.sendMessage(text);
  };

  sendBtn.addEventListener('click', submit);
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });

  // --- rendering --------------------------------------------------------
  const render = () => {
    const state = engine.getState();
    const vm = engine.getViewModel();

    applyAppearance(root, header, launcher, headerAvatar, headerTitle, vm, state, doc);
    renderSuggestions(suggestionsEl, sendBtn, inputEl, engine, vm, state, doc);
    renderInputState(inputArea, errorEl, state);
    renderMessages(messagesEl, state, vm, doc);
  };

  const unsubscribe = engine.subscribe(render);
  render();

  return {
    shadowRoot: shadow,
    destroy() {
      unsubscribe();
      launcher.remove();
      panel.remove();
      root.remove();
      styleEl.remove();
    },
  };
}

// --- helpers --------------------------------------------------------------

function resolveShadowRoot(target: ShadowRoot | HTMLElement): ShadowRoot {
  if (isShadowRoot(target)) return target;
  // Reuse an existing shadow root if the host already has one; otherwise open one.
  return target.shadowRoot ?? target.attachShadow({ mode: 'open' });
}

function isShadowRoot(value: ShadowRoot | HTMLElement): value is ShadowRoot {
  return (
    typeof ShadowRoot !== 'undefined' && value instanceof ShadowRoot
  ) || (value as ShadowRoot).host !== undefined;
}

function globalDocument(): Document {
  if (typeof document === 'undefined') {
    throw new Error('inletbase widget: no document available to mount into');
  }
  return document;
}

/** Applies view-model appearance (title, avatar, color, position). */
function applyAppearance(
  root: HTMLElement,
  header: HTMLElement,
  launcher: HTMLElement,
  headerAvatar: HTMLElement,
  headerTitle: HTMLElement,
  vm: ChatViewModel,
  state: ChatEngineState,
  doc: Document
): void {
  const primary = vm.primary_color || DEFAULT_PRIMARY_COLOR;
  const textColor = state.config?.text_color || DEFAULT_TEXT_COLOR;

  root.style.setProperty('--inletbase-primary', primary);
  root.style.setProperty('--inletbase-on-primary', textColor);

  applyPosition(root, vm.position);

  headerTitle.textContent = vm.widget_title || DEFAULT_TITLE;

  // Launcher glyph / avatar.
  if (vm.bot_avatar) {
    launcher.style.backgroundColor = '#ffffff';
    setAvatar(launcher, vm.bot_avatar, doc);
    setAvatar(headerAvatar, vm.bot_avatar, doc);
  } else {
    launcher.style.backgroundColor = primary;
    if (!launcher.textContent) launcher.textContent = '💬';
    headerAvatar.textContent = '';
  }
}

function setAvatar(host: HTMLElement, src: string, doc: Document): void {
  const existing = host.querySelector('img');
  const img = existing ?? doc.createElement('img');
  img.setAttribute('src', src);
  img.setAttribute('alt', '');
  if (!existing) {
    host.textContent = '';
    host.appendChild(img);
  }
}

function applyPosition(root: HTMLElement, position?: ChatViewModel['position']): void {
  const pos = position || 'bottom-right';
  const isBottom = pos.includes('bottom');
  const isRight = pos.includes('right');
  root.style.top = isBottom ? '' : '24px';
  root.style.bottom = isBottom ? '24px' : '';
  root.style.left = isRight ? '' : '24px';
  root.style.right = isRight ? '24px' : '';
}

/** Renders suggestion chips (only before the visitor has sent anything). */
function renderSuggestions(
  container: HTMLElement,
  sendBtn: HTMLButtonElement,
  inputEl: HTMLInputElement,
  engine: ChatEngine,
  vm: ChatViewModel,
  state: ChatEngineState,
  doc: Document
): void {
  container.textContent = '';
  const suggestions = vm.suggestions;
  const hasUserMessage = state.messages.some((m) => m.role === 'user');

  if (state.status !== 'ready' || hasUserMessage || !suggestions || suggestions.length === 0) {
    container.classList.add('inletbase-hidden');
    return;
  }

  container.classList.remove('inletbase-hidden');
  for (const suggestion of suggestions) {
    const chip = doc.createElement('button');
    chip.type = 'button';
    chip.className = 'inletbase-suggestion';
    chip.textContent = suggestion;
    chip.addEventListener('click', () => {
      void engine.sendMessage(suggestion);
    });
    container.appendChild(chip);
  }
}

/**
 * When the engine is in an error state (missing botId or config-load failure),
 * hides the functional input and surfaces the error instead (Req 2.6).
 */
function renderInputState(
  inputArea: HTMLElement,
  errorEl: HTMLElement,
  state: ChatEngineState
): void {
  if (state.status === 'error') {
    inputArea.classList.add('inletbase-hidden');
    errorEl.classList.remove('inletbase-hidden');
    errorEl.textContent = state.error || 'The chat is unavailable right now.';
  } else {
    inputArea.classList.remove('inletbase-hidden');
    errorEl.classList.add('inletbase-hidden');
  }
}

/** Repaints the message list, including the live streaming bubble. */
function renderMessages(
  container: HTMLElement,
  state: ChatEngineState,
  vm: ChatViewModel,
  doc: Document
): void {
  container.textContent = '';

  for (const msg of state.messages) {
    container.appendChild(createBubble(msg.role, msg.content, doc));
  }

  // Live streaming / typing bubble while a reply is in flight.
  if (state.isLoading) {
    if (state.isStreaming && state.streamedMessage) {
      container.appendChild(createBubble('assistant', state.streamedMessage, doc));
    } else {
      container.appendChild(createTypingBubble(doc));
    }
  }

  // Keep the newest content in view.
  container.scrollTop = container.scrollHeight;
  // `vm` is accepted for future per-message theming; primary color is applied
  // via CSS custom properties on the root.
  void vm;
}

function createBubble(role: string, content: string, doc: Document): HTMLElement {
  const bubble = doc.createElement('div');
  const kind = role === 'user' ? 'user' : 'assistant';
  bubble.className = `inletbase-msg inletbase-msg-${kind}`;
  // Use textContent to neutralise any HTML in message content (XSS-safe).
  bubble.textContent = content;
  return bubble;
}

function createTypingBubble(doc: Document): HTMLElement {
  const bubble = doc.createElement('div');
  bubble.className = 'inletbase-msg inletbase-msg-assistant inletbase-typing';
  for (let i = 0; i < 3; i++) {
    const dot = doc.createElement('span');
    dot.className = 'inletbase-dot';
    bubble.appendChild(dot);
  }
  return bubble;
}

/**
 * Self-contained default stylesheet used when no `css` option is supplied.
 * Structural only; theme colors are applied via CSS custom properties set on
 * the root element from the view model.
 */
function buildDefaultStyles(): string {
  return `
    :host, .inletbase-root {
      --inletbase-primary: ${DEFAULT_PRIMARY_COLOR};
      --inletbase-on-primary: ${DEFAULT_TEXT_COLOR};
    }
    .inletbase-root {
      position: fixed;
      z-index: 2147483000;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .inletbase-root * { box-sizing: border-box; }
    .inletbase-hidden { display: none !important; }

    .inletbase-launcher {
      width: 56px;
      height: 56px;
      border-radius: 9999px;
      border: none;
      cursor: pointer;
      color: var(--inletbase-on-primary);
      background: var(--inletbase-primary);
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      overflow: hidden;
    }
    .inletbase-launcher img { width: 100%; height: 100%; object-fit: cover; border-radius: 9999px; }

    .inletbase-panel {
      position: absolute;
      bottom: 72px;
      right: 0;
      width: 360px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 120px);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 12px 40px -12px rgba(0,0,0,0.35);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .inletbase-header {
      background: var(--inletbase-primary);
      color: var(--inletbase-on-primary);
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .inletbase-header-avatar { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; }
    .inletbase-header-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .inletbase-header-title { font-weight: 600; font-size: 15px; }

    .inletbase-body {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fafbfd;
    }
    .inletbase-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .inletbase-msg {
      max-width: 85%;
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.45;
      border-radius: 14px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .inletbase-msg-assistant {
      align-self: flex-start;
      background: #ffffff;
      color: #27272a;
      border: 1px solid rgba(0,0,0,0.06);
      border-bottom-left-radius: 4px;
    }
    .inletbase-msg-user {
      align-self: flex-end;
      background: var(--inletbase-primary);
      color: var(--inletbase-on-primary);
      border-bottom-right-radius: 4px;
    }

    .inletbase-typing { display: flex; gap: 5px; align-items: center; }
    .inletbase-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #a1a1aa;
      animation: inletbase-typing 1.4s infinite ease-in-out both;
    }
    .inletbase-dot:nth-child(1) { animation-delay: -0.32s; }
    .inletbase-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes inletbase-typing {
      0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }

    .inletbase-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 16px 12px;
      justify-content: flex-end;
    }
    .inletbase-suggestion {
      background: transparent;
      border: 1px solid rgba(0,0,0,0.12);
      color: #27272a;
      border-radius: 16px;
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
    }
    .inletbase-suggestion:hover { background: #f0f0f2; }

    .inletbase-error {
      padding: 16px;
      color: #b91c1c;
      font-size: 14px;
      text-align: center;
    }

    .inletbase-input-area {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid rgba(0,0,0,0.06);
      background: #ffffff;
    }
    .inletbase-input {
      flex: 1;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 20px;
      padding: 9px 14px;
      font-size: 14px;
      outline: none;
      color: #27272a;
    }
    .inletbase-input:focus { border-color: var(--inletbase-primary); }
    .inletbase-send {
      border: none;
      border-radius: 20px;
      padding: 9px 16px;
      font-size: 14px;
      cursor: pointer;
      color: var(--inletbase-on-primary);
      background: var(--inletbase-primary);
    }
    .inletbase-send:hover { opacity: 0.92; }
  `;
}
