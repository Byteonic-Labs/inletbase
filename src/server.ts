import { SubmissionResponse } from './types';
import { SDK_VERSION } from './client';
import { fetchWithTimeout } from './core/http';
import { normalizeResponse, normalizeFailure } from './core/response';

/** Forms submission timeout window (Req 2.1). */
const FORMS_TIMEOUT_MS = 30_000;

export interface ServerConfig {
  apiKey: string;
  baseUrl?: string;
  /**
   * If your Inletbase dashboard has Domain Whitelisting enabled,
   * you MUST provide a matching origin here to bypass the block.
   * Example: "https://yourdomain.com"
   */
  origin?: string;
}

export interface ServerSubmitOptions {
  /**
   * The actual IP address of the end-user (e.g., from req.headers['x-forwarded-for']).
   * This ensures your Inletbase dashboard shows the user's location, not your server's location.
   */
  userIp?: string;
  /**
   * The actual User-Agent of the end-user browser.
   */
  userAgent?: string;
  /**
   * A custom source URL to tag this submission with.
   */
  sourceUrl?: string;
}

export class InletbaseServerClient {
  private apiKey: string;
  private baseUrl: string;
  private origin?: string;

  constructor(config: ServerConfig) {
    if (!config.apiKey) {
      throw new Error('[Inletbase] API Key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://inletbase.com/api/external';
    this.origin = config.origin;
  }

  /**
   * Submit form data to Inletbase from a Node.js Server
   * @param formSlug The slug of the form to submit to
   * @param data The form data (Record<string, any> or FormData)
   * @param options Server-specific options for tracking user IP/Agent
   */
  async submit(formSlug: string, data: Record<string, any> | FormData, options: ServerSubmitOptions = {}): Promise<SubmissionResponse> {
    // Reject a missing/empty (including whitespace-only) API key before sending (Req 2.4).
    if (typeof this.apiKey !== 'string' || this.apiKey.trim() === '') {
      return normalizeFailure('[Inletbase] API Key is required');
    }

    const url = `${this.baseUrl}/forms/${formSlug}/submit`;

    // Auto-track metadata for servers
    const meta = {
      sdk_version: `${SDK_VERSION}-server`,
      source_url: options.sourceUrl || 'server',
      submission_source: 'inletbase_sdk_server'
    };

    let fetchHeaders: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`
    };

    // Spoof origin if provided to bypass domain whitelists safely
    if (this.origin) {
      fetchHeaders['Origin'] = this.origin;
      fetchHeaders['Referer'] = this.origin;
    }

    // Forward user headers if provided
    if (options.userIp) {
      fetchHeaders['x-forwarded-for'] = options.userIp;
    }
    if (options.userAgent) {
      fetchHeaders['User-Agent'] = options.userAgent;
    }

    let fetchOptions: RequestInit = {
      method: 'POST',
      headers: fetchHeaders
    };

    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      // Native Node 18+ FormData support
      data.append('_meta', JSON.stringify(meta));
      fetchOptions.body = data;
    } else {
      // Standard JSON payload
      const payload = data as Record<string, any>;
      payload._meta = meta;

      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json'
      };
      fetchOptions.body = JSON.stringify(payload);
    }

    // Exactly one request attempt — no retry (Req 2.3), bounded at 30s (Req 2.1).
    const result = await fetchWithTimeout(url, fetchOptions, FORMS_TIMEOUT_MS);

    // Timeout or network failure before any HTTP status → status:0 failure (Req 2.5, 6.5).
    if (result.timedOut) {
      return normalizeFailure('[Inletbase] Request timed out');
    }
    if (result.networkError || !result.response) {
      return normalizeFailure(result.networkError?.message || 'Network request failed');
    }

    const response = result.response;
    const responseData = await response.json().catch(() => ({}));

    // Map both success and non-2xx statuses through the shared envelope (Req 2.2, 2.3, 6.2).
    return normalizeResponse(response.status, responseData);
  }
}
