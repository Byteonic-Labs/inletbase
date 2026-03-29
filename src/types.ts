export interface ByteonicConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface SubmissionResponse {
  success?: boolean;
  message?: string;
  error?: string;
  details?: Record<string, string> | string;
  [key: string]: any;
}
