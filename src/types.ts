export interface InletbaseConfig {
  apiKey: string;
}

export interface SubmissionResponse {
  success?: boolean;
  message?: string;
  error?: string;
  details?: Record<string, string> | string;
  [key: string]: any;
}
