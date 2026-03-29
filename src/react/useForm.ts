import { useState, useCallback } from 'react';
import { useByteonicClient } from './provider';
import { SubmissionResponse } from '../types';
import { ByteonicClient } from '../client';

export interface UseByteonicIntakeOptions {
  formSlug: string;
  apiKey?: string;
  baseUrl?: string;
}

export function useByteonicIntake(options: UseByteonicIntakeOptions | string) {
  const formSlug = typeof options === 'string' ? options : options.formSlug;
  const configApiKey = typeof options === 'string' ? undefined : options.apiKey;
  const configBaseUrl = typeof options === 'string' ? undefined : options.baseUrl;

  let contextClient: ByteonicClient | undefined;
  try {
    contextClient = useByteonicClient();
  } catch (e) {
    // Suppress error if outside provider
  }

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SubmissionResponse | null>(null);

  const submit = useCallback(async (data: Record<string, any> | FormData | React.FormEvent<HTMLFormElement>) => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      let client = contextClient;
      
      if (!client) {
        if (!configApiKey) {
          throw new Error('Byteonic Intake: apiKey is required via <ByteonicProvider> or directly in useByteonicIntake');
        }
        client = new ByteonicClient({ apiKey: configApiKey, baseUrl: configBaseUrl });
      }

      let payload: any = data;
      if (data && typeof (data as any).preventDefault === 'function') {
         (data as any).preventDefault();
         payload = new FormData((data as any).currentTarget);
      }

      const result = await client.submit(formSlug, payload);
      
      setResponse(result);
      if (result.success !== false) {
        setIsSuccess(true);
      } else {
        setError(result.error || 'Submission failed');
      }
      return result;
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [formSlug, contextClient, configApiKey, configBaseUrl]);

  return {
    submit,
    isLoading,
    isSuccess,
    error,
    response
  };
}
