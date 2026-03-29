import { ByteonicConfig, SubmissionResponse } from './types';

export class ByteonicClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ByteonicConfig) {
    if (!config.apiKey) {
      throw new Error('[Byteonic Intake] API Key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://intake.byteoniclabs.com/api/external';
  }

  /**
   * Submit form data to Byteonic Intake
   * @param formSlug The slug of the form to submit to
   * @param data The form data (Record<string, any> or FormData)
   */
  async submit(formSlug: string, data: Record<string, any> | FormData): Promise<SubmissionResponse> {
    const url = `${this.baseUrl}/forms/${formSlug}/submit`;
    
    // Convert FormData to JSON payload
    let payload: Record<string, any> = {};
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      data.forEach((value, key) => {
        if (payload[key]) {
          if (Array.isArray(payload[key])) {
            payload[key].push(value);
          } else {
            payload[key] = [payload[key], value];
          }
        } else {
          payload[key] = value;
        }
      });
    } else {
      payload = data as Record<string, any>;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

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
