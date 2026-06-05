import { useState, useCallback } from 'react';
import { useByteonicClient } from './provider';
import { SubmissionResponse } from '../types';
import { ByteonicClient } from '../client';

export interface UseByteonicIntakeOptions {
  formSlug: string;
  apiKey?: string;
  baseUrl?: string;
}

export function useByteonicIntake<T = Record<string, any>>(options: UseByteonicIntakeOptions | string) {
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

  const submit = useCallback(async (data: T | FormData | React.FormEvent<HTMLFormElement>) => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      let client = contextClient;
      
      if (!client) {
        if (!configApiKey) {
          const envKey = 
            (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BYTEONIC_API_KEY) ||
            (typeof (globalThis as any).import?.meta !== 'undefined' && (globalThis as any).import?.meta?.env?.VITE_BYTEONIC_API_KEY) ||
            (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BYTEONIC_API_KEY);

          if (envKey) {
            client = new ByteonicClient({ apiKey: envKey as string, baseUrl: configBaseUrl });
          } else {
            throw new Error('Byteonic Intake: apiKey is required via <ByteonicProvider>, directly in useByteonicIntake, or as an environment variable (NEXT_PUBLIC_BYTEONIC_API_KEY / VITE_BYTEONIC_API_KEY)');
          }
        } else {
          client = new ByteonicClient({ apiKey: configApiKey, baseUrl: configBaseUrl });
        }
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
