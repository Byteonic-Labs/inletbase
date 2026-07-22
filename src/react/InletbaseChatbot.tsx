import { useEffect } from 'react';
import { loadChatbotWidget } from '../widget/loader';

/**
 * Props for the {@link InletbaseChatbot} drop-in component.
 *
 * The component is a thin client of the backend-hosted chat widget: it injects
 * `api.inletbase.com/widget/chatbot.js` for the given `botId`. All of the chat
 * UI, styling, and behaviour live on the backend (the single source of truth),
 * so the widget updates without republishing this SDK.
 */
export interface InletbaseChatbotProps {
  /** The chatbot identifier. Required; an empty value renders nothing. */
  botId: string;
  /**
   * Optional override of the backend origin that hosts the widget script and
   * chat API. Defaults to `https://api.inletbase.com`.
   */
  baseUrl?: string;
  /**
   * Accepted for backward compatibility but ignored: chat authenticates via
   * Origin_Auth and never requires an API key.
   */
  apiKey?: string;
}

/**
 * Drop-in React chatbot. Renders no DOM of its own — it loads the hosted
 * Inletbase widget for `botId` on mount and removes it on unmount. Appearance
 * and behaviour come entirely from the bot's dashboard config, applied by the
 * backend widget. Chat requires no API key (Origin_Auth).
 */
export function InletbaseChatbot({ botId, baseUrl }: InletbaseChatbotProps): null {
  useEffect(() => {
    if (!botId) return;
    // Returns a teardown that removes the injected script + mounted widget DOM.
    return loadChatbotWidget({ botId, baseUrl });
  }, [botId, baseUrl]);

  return null;
}
