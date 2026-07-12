export interface InletbaseConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Configuration for `InletbaseChatClient`. The chat backend authenticates
 * requests via Origin_Auth (Origin/Referer host matching), so `apiKey` is
 * optional. A supplied key is accepted for backward compatibility but is
 * ignored by the backend.
 */
export interface ChatClientConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface SubmissionResponse {
  success?: boolean;
  message?: string;
  error?: string;
  details?: Record<string, string> | string;
  [key: string]: any;
}
