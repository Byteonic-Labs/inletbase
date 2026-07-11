import { InletbaseConfig, SubmissionResponse } from './types';

export const SDK_VERSION = '1.0.0';

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
   * Submit form data to Inletbase
   * @param formSlug The slug of the form to submit to
   * @param data The form data (Record<string, any> or FormData)
   */
  async submit(formSlug: string, data: Record<string, any> | FormData): Promise<SubmissionResponse> {
    const url = `${this.baseUrl}/forms/${formSlug}/submit`;

    // Auto-track metadata
    const meta = {
      sdk_version: SDK_VERSION,
      source_url: typeof window !== 'undefined' ? window.location.href : 'server',
      submission_source: 'inletbase_sdk'
    };

    let fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    };

    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      // Native File uploads require FormData to remain untouched.
      // Do NOT set Content-Type header, the browser sets the multi-part boundary automatically.
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

    try {
      const response = await fetch(url, fetchOptions);

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || 'Submission failed');
      }

      return responseData;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An unexpected error occurred'
      };
    }
  }
}
