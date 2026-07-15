/**
 * Scoped CSS for the vanilla `<script>` chat widget.
 *
 * This stylesheet is injected once into the widget's Shadow DOM by
 * `render.ts`, so every rule is fully isolated from the host page: the host's
 * CSS cannot reach these nodes and these rules cannot leak out. That isolation
 * lets the selectors stay short and unprefixed at the element level while the
 * `.inletbase-chat-*` class names keep intent readable.
 *
 * Theming: appearance fields from the loaded `ChatbotConfig` are applied by the
 * renderer as CSS custom properties on the widget root (e.g. the bot's
 * `primary_color` becomes `--inletbase-primary`). The values below are the
 * fallback defaults used until the config resolves.
 *
 * Positioning: the renderer adds one of the position classes
 * (`.pos-bottom-right`, `.pos-bottom-left`, `.pos-top-right`, `.pos-top-left`)
 * to the widget root to match the bot's configured `position`.
 */
export const widgetStyles = `
:host {
  all: initial;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

.inletbase-chat-root {
  --inletbase-primary: #4f46e5;
  --inletbase-primary-contrast: #ffffff;
  --inletbase-surface: #ffffff;
  --inletbase-text: #1f2933;
  --inletbase-muted: #6b7280;
  --inletbase-border: #e5e7eb;
  --inletbase-assistant-bg: #f3f4f6;
  --inletbase-radius: 16px;
  --inletbase-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);

  position: fixed;
  z-index: 2147483000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--inletbase-text);
}

/* --- Positioning --------------------------------------------------------- */
.inletbase-chat-root.pos-bottom-right {
  right: 20px;
  bottom: 20px;
  align-items: flex-end;
}
.inletbase-chat-root.pos-bottom-left {
  left: 20px;
  bottom: 20px;
  align-items: flex-start;
}
.inletbase-chat-root.pos-top-right {
  right: 20px;
  top: 20px;
  align-items: flex-end;
}
.inletbase-chat-root.pos-top-left {
  left: 20px;
  top: 20px;
  align-items: flex-start;
}

/* --- Launcher ------------------------------------------------------------ */
.inletbase-chat-launcher {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--inletbase-primary);
  color: var(--inletbase-primary-contrast);
  box-shadow: var(--inletbase-shadow);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.inletbase-chat-launcher:hover {
  transform: scale(1.05);
}
.inletbase-chat-launcher:focus-visible {
  outline: 2px solid var(--inletbase-primary);
  outline-offset: 3px;
}
.inletbase-chat-launcher svg {
  width: 28px;
  height: 28px;
  fill: currentColor;
}
.inletbase-chat-launcher img {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
}

/* --- Panel --------------------------------------------------------------- */
.inletbase-chat-panel {
  display: flex;
  flex-direction: column;
  width: 380px;
  max-width: calc(100vw - 40px);
  height: 560px;
  max-height: calc(100vh - 40px);
  margin-bottom: 16px;
  background: var(--inletbase-surface);
  border: 1px solid var(--inletbase-border);
  border-radius: var(--inletbase-radius);
  box-shadow: var(--inletbase-shadow);
  overflow: hidden;
  opacity: 0;
  transform: translateY(12px) scale(0.98);
  transform-origin: bottom right;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.inletbase-chat-root.pos-top-right .inletbase-chat-panel,
.inletbase-chat-root.pos-top-left .inletbase-chat-panel {
  margin-bottom: 0;
  margin-top: 16px;
  transform-origin: top right;
}
.inletbase-chat-root.is-open .inletbase-chat-panel {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

/* --- Header -------------------------------------------------------------- */
.inletbase-chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--inletbase-primary);
  color: var(--inletbase-primary-contrast);
}
.inletbase-chat-header-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.2);
}
.inletbase-chat-header-title {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.inletbase-chat-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}
.inletbase-chat-close:hover {
  background: rgba(255, 255, 255, 0.18);
}
.inletbase-chat-close svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

/* --- Message list -------------------------------------------------------- */
.inletbase-chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--inletbase-surface);
}
.inletbase-chat-messages::-webkit-scrollbar {
  width: 6px;
}
.inletbase-chat-messages::-webkit-scrollbar-thumb {
  background: var(--inletbase-border);
  border-radius: 3px;
}

.inletbase-chat-message {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.inletbase-chat-message.is-user {
  align-self: flex-end;
  background: var(--inletbase-primary);
  color: var(--inletbase-primary-contrast);
  border-bottom-right-radius: 4px;
}
.inletbase-chat-message.is-assistant {
  align-self: flex-start;
  background: var(--inletbase-assistant-bg);
  color: var(--inletbase-text);
  border-bottom-left-radius: 4px;
}

/* --- Streaming / typing indicator --------------------------------------- */
.inletbase-chat-typing {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.inletbase-chat-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--inletbase-muted);
  animation: inletbase-chat-blink 1.4s infinite both;
}
.inletbase-chat-typing span:nth-child(2) {
  animation-delay: 0.2s;
}
.inletbase-chat-typing span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes inletbase-chat-blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}

/* --- Suggestions --------------------------------------------------------- */
.inletbase-chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 12px;
}
.inletbase-chat-suggestion {
  padding: 8px 12px;
  border: 1px solid var(--inletbase-border);
  border-radius: 999px;
  background: var(--inletbase-surface);
  color: var(--inletbase-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.inletbase-chat-suggestion:hover {
  border-color: var(--inletbase-primary);
  background: var(--inletbase-assistant-bg);
}

/* --- Input --------------------------------------------------------------- */
.inletbase-chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--inletbase-border);
  background: var(--inletbase-surface);
}
.inletbase-chat-input {
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  padding: 10px 12px;
  border: 1px solid var(--inletbase-border);
  border-radius: 12px;
  font-family: inherit;
  font-size: 14px;
  color: var(--inletbase-text);
  background: var(--inletbase-surface);
  resize: none;
  outline: none;
  transition: border-color 0.15s ease;
}
.inletbase-chat-input:focus {
  border-color: var(--inletbase-primary);
}
.inletbase-chat-input::placeholder {
  color: var(--inletbase-muted);
}
.inletbase-chat-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: var(--inletbase-primary);
  color: var(--inletbase-primary-contrast);
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}
.inletbase-chat-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.inletbase-chat-send svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

/* --- Error state --------------------------------------------------------- */
.inletbase-chat-error {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 24px;
  text-align: center;
  color: var(--inletbase-muted);
  font-size: 14px;
}

/* --- Branding ------------------------------------------------------------ */
.inletbase-chat-branding {
  padding: 8px 16px;
  text-align: center;
  font-size: 11px;
  color: var(--inletbase-muted);
  background: var(--inletbase-surface);
}
.inletbase-chat-branding a {
  color: var(--inletbase-muted);
  text-decoration: none;
}
.inletbase-chat-branding a:hover {
  text-decoration: underline;
}

/* --- Reduced motion ------------------------------------------------------ */
@media (prefers-reduced-motion: reduce) {
  .inletbase-chat-launcher,
  .inletbase-chat-panel,
  .inletbase-chat-typing span {
    transition: none;
    animation: none;
  }
}
`;
