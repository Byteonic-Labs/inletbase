import { useState, useCallback, type FormEvent } from 'react';
import { useInletbaseFormClient } from './provider';
import { InletbaseFormClient } from '../client';
import { ResponseEnvelope } from '../core/response';
import { resolveApiKey } from '../core/credentials';

export interface UseInletbaseFormOptions {
  formSlug: string;
  apiKey?: string;
}

interface NormalizedArgs {
  formSlug?: string;
  configApiKey?: string;
  /** Set when the argument is neither a non-empty string nor an object carrying a formSlug. */
  argError?: string;
}

/**
 * Normalizes the `useInletbaseForm` argument:
 * - a non-empty string is treated as the `formSlug`;
 * - an object supplies `formSlug` / `apiKey`;
 * - anything else (including empty strings and objects without a usable
 *   `formSlug`) yields an `argError` so the hook can surface it without
 *   initializing, and without throwing during render.
 */
function normalizeArgs(options: UseInletbaseFormOptions | string): NormalizedArgs {
  if (typeof options === 'string') {
    if (options.trim() === '') {
      return { argError: '[Inletbase] useInletbaseForm requires a non-empty formSlug string' };
    }
    return { formSlug: options };
  }

  if (options !== null && typeof options === 'object') {
    const formSlug = (options as UseInletbaseFormOptions).formSlug;
    if (typeof formSlug !== 'string' || formSlug.trim() === '') {
      return { argError: '[Inletbase] useInletbaseForm options must include a non-empty formSlug' };
    }
    return {
      formSlug,
      configApiKey: (options as UseInletbaseFormOptions).apiKey,
    };
  }

  return { argError: '[Inletbase] useInletbaseForm requires a formSlug string or an options object' };
}

export function useInletbaseForm<T = Record<string, any>>(options: UseInletbaseFormOptions | string) {
  const { formSlug, configApiKey, argError } = normalizeArgs(options);

  let contextClient: InletbaseFormClient | undefined;
  try {
    contextClient = useInletbaseFormClient();
  } catch (e) {
    // Suppress error if outside provider
  }

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ResponseEnvelope | null>(null);

  const submit = useCallback(async (data: T | FormData | FormEvent<HTMLFormElement>) => {
    // Invalid argument → surface an error without initializing.
    if (argError || !formSlug) {
      const message = argError || '[Inletbase] useInletbaseForm requires a valid formSlug';
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
        // Resolve the key with precedence explicit → context.
        const apiKey = resolveApiKey({
          explicit: configApiKey,
          context: (contextClient as any)?.apiKey,
        });

        if (!apiKey) {
          // No key resolved for an operation that needs one → surface an error
          // rather than throwing.
          const message =
            '[Inletbase] apiKey is required via <InletbaseProvider> or directly in useInletbaseForm';
          setError(message);
          return { success: false, error: message };
        }

        client = new InletbaseFormClient({ apiKey });
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
  }, [formSlug, argError, contextClient, configApiKey]);

  return {
    submit,
    isLoading,
    isSuccess,
    error: argError ?? error,
    response
  };
}
