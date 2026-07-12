import { InletbaseConfig } from './types';
import { fetchWithTimeout } from './core/http';
import {
  normalizeResponse,
  normalizeFailure,
  ResponseEnvelope,
} from './core/response';

export const SDK_VERSION = '1.0.0';

/** Forms submissions wait at most 30 seconds for a response (Req 1.9). */
const SUBMIT_TIMEOUT_MS = 30_000;

export class InletbaseClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: InletbaseConfig) {
    if (!config.apiKey) {
      throw new Error('[Inletbase] API Key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://inletbase.com/api/external';
  }

  /**
   * Submit form data to Inletbase.
   *
   * Never throws across this boundary: every outcome (success, non-2xx, and
   * network/timeout failure) is returned as a canonical `ResponseEnvelope`
   * (Requirements 1.7, 1.8, 1.9, 6.1, 6.3, 6.4, 6.5, 6.6).
   *
   * @param formSlug The slug of the form to submit to
   * @param data The form data (Record<string, any> or FormData)
   */
  async submit(
    formSlug: string,
    data: Record<string, any> | FormData
  ): Promise<ResponseEnvelope> {
    // Reject an empty or whitespace-only key before sending anything (Req 1.10).
    if (!this.apiKey || this.apiKey.trim() === '') {
      return normalizeFailure('[Inletbase] API Key is required');
    }

    const url = `${this.baseUrl}/forms/${formSlug}/submit`;

    // Auto-track submission metadata (Req 1.6).
    const meta = {
      sdk_version: SDK_VERSION,
      source_url: typeof window !== 'undefined' ? window.location.href : 'server',
      submission_source: 'inletbase_sdk',
    };

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        // Authenticate with the API key as a bearer token (Req 1.2).
        Authorization: `Bearer ${this.apiKey}`,
      },
    };

    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      // Native File uploads require FormData to remain untouched (Req 1.4).
      // Do NOT set Content-Type, the runtime sets the multipart boundary itself.
      data.append('_meta', JSON.stringify(meta));
      fetchOptions.body = data;
    } else {
      // Standard JSON payload (Req 1.3). Attach `_meta`; a `_gotcha` honeypot
      // value, when present on the payload, is preserved and forwarded (Req 1.5, 1.6).
      const payload = { ...(data as Record<string, any>), _meta: meta };

      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json',
      };
      fetchOptions.body = JSON.stringify(payload);
    }

    // Issue the request bounded by a 30s timeout (Req 1.1, 1.9).
    const result = await fetchWithTimeout(url, fetchOptions, SUBMIT_TIMEOUT_MS);

    if (result.timedOut) {
      // Timeout before any HTTP status → failure envelope with status 0 (Req 1.9, 6.5).
      return normalizeFailure('[Inletbase] Request timed out');
    }

    if (result.networkError || !result.response) {
      // Network-level failure before any HTTP status (Req 1.9, 6.5).
      return normalizeFailure(
        result.networkError?.message || '[Inletbase] Network request failed'
      );
    }

    const response = result.response;
    const body = await response.json().catch(() => ({}));

    // Map both success (2xx) and non-2xx responses through the shared normalizer
    // (Req 1.7, 1.8, 6.1, 6.3, 6.4, 6.6).
    return normalizeResponse(response.status, body);
  }
}
