import { useState, useCallback } from 'react';
import { useInletbaseClient } from './provider';
import { SubmissionResponse } from '../types';
import { InletbaseClient } from '../client';

export interface UseInletbaseOptions {
  formSlug: string;
  apiKey?: string;
  baseUrl?: string;
}

export function useInletbase<T = Record<string, any>>(options: UseInletbaseOptions | string) {
  const formSlug = typeof options === 'string' ? options : options.formSlug;
  const configApiKey = typeof options === 'string' ? undefined : options.apiKey;
  const configBaseUrl = typeof options === 'string' ? undefined : options.baseUrl;

  let contextClient: InletbaseClient | undefined;
  try {
    contextClient = useInletbaseClient();
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
            (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_INLETBASE_API_KEY) ||
            (typeof (globalThis as any).import?.meta !== 'undefined' && (globalThis as any).import?.meta?.env?.VITE_INLETBASE_API_KEY) ||
            (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_INLETBASE_API_KEY);

          if (envKey) {
            client = new InletbaseClient({ apiKey: envKey as string, baseUrl: configBaseUrl });
          } else {
            throw new Error('Inletbase: apiKey is required via <InletbaseProvider>, directly in useInletbase, or as an environment variable (NEXT_PUBLIC_INLETBASE_API_KEY / VITE_INLETBASE_API_KEY)');
          }
        } else {
          client = new InletbaseClient({ apiKey: configApiKey, baseUrl: configBaseUrl });
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
