import { useState, useCallback, type FormEvent } from 'react';
import { useInletbaseClient } from './provider';
import { SubmissionResponse } from '../types';
import { InletbaseClient } from '../client';
import { resolveApiKey, readEnvKeys } from '../core/credentials';

export interface UseInletbaseOptions {
  formSlug: string;
  apiKey?: string;
  baseUrl?: string;
}

interface NormalizedArgs {
  formSlug?: string;
  configApiKey?: string;
  configBaseUrl?: string;
  /** Set when the argument is neither a non-empty string nor an object carrying a formSlug (Req 8.4). */
  argError?: string;
}

/**
 * Normalizes the `useInletbase` argument (Req 8.2, 8.3, 8.4):
 * - a non-empty string is treated as the `formSlug`;
 * - an object supplies `formSlug` / `apiKey` / `baseUrl`;
 * - anything else (including empty strings and objects without a usable
 *   `formSlug`) yields an `argError` so the hook can surface it without
 *   initializing, and without throwing during render.
 */
function normalizeArgs(options: UseInletbaseOptions | string): NormalizedArgs {
  if (typeof options === 'string') {
    if (options.trim() === '') {
      return { argError: '[Inletbase] useInletbase requires a non-empty formSlug string' };
    }
    return { formSlug: options };
  }

  if (options !== null && typeof options === 'object') {
    const formSlug = (options as UseInletbaseOptions).formSlug;
    if (typeof formSlug !== 'string' || formSlug.trim() === '') {
      return { argError: '[Inletbase] useInletbase options must include a non-empty formSlug' };
    }
    return {
      formSlug,
      configApiKey: (options as UseInletbaseOptions).apiKey,
      configBaseUrl: (options as UseInletbaseOptions).baseUrl,
    };
  }

  return { argError: '[Inletbase] useInletbase requires a formSlug string or an options object' };
}

export function useInletbase<T = Record<string, any>>(options: UseInletbaseOptions | string) {
  const { formSlug, configApiKey, configBaseUrl, argError } = normalizeArgs(options);

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

  const submit = useCallback(async (data: T | FormData | FormEvent<HTMLFormElement>) => {
    // Invalid argument → surface an error without initializing (Req 8.4).
    if (argError || !formSlug) {
      const message = argError || '[Inletbase] useInletbase requires a valid formSlug';
      setError(message);
      setIsSuccess(false);
      return { success: false, error: message };
    }

    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      let client = contextClient;

      if (!client) {
        // Resolve the key with precedence explicit → context → NEXT_PUBLIC → VITE,
        // reading env through readEnvKeys (no bare import.meta) (Req 7.1-7.4).
        const envKeys = readEnvKeys();
        const apiKey = resolveApiKey({
          explicit: configApiKey,
          context: (contextClient as any)?.apiKey,
          nextPublic: envKeys.nextPublic,
          vite: envKeys.vite,
        });

        if (!apiKey) {
          // No key resolved for an operation that needs one → surface an error
          // rather than throwing during env access (Req 7.5).
          const message =
            '[Inletbase] apiKey is required via <InletbaseProvider>, directly in useInletbase, or as an environment variable (NEXT_PUBLIC_INLETBASE_API_KEY / VITE_INLETBASE_API_KEY)';
          setError(message);
          return { success: false, error: message };
        }

        client = new InletbaseClient({ apiKey, baseUrl: configBaseUrl });
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
  }, [formSlug, argError, contextClient, configApiKey, configBaseUrl]);

  return {
    submit,
    isLoading,
    isSuccess,
    error: argError ?? error,
    response
  };
}
