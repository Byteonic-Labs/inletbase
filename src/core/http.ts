/**
 * Shared HTTP timeout helper.
 *
 * `fetchWithTimeout` issues a fetch bounded by an AbortController-based timeout
 * and reports network/timeout failures structurally instead of throwing across
 * the boundary (Requirements 1.9, 2.5, 3.1).
 */

export interface TimeoutResult {
  /** Present when an HTTP status was received. */
  response?: Response;
  /** True when the request aborted on the timeout. */
  timedOut: boolean;
  /** Present when the request failed before any status. */
  networkError?: Error;
}

/**
 * Issues fetch with an AbortController-based timeout.
 * Never throws for network/timeout: reports them structurally.
 *
 * - When an HTTP status is received, `response` is set (regardless of status code).
 * - When the request aborts because the timeout elapsed, `timedOut` is true.
 * - When the request fails before any status for any other reason, `networkError`
 *   holds the underlying error.
 *
 * The timeout timer is always cleared before returning.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<TimeoutResult> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, timedOut: false };
  } catch (err) {
    // Distinguish a timeout-driven abort from any other network-level failure.
    if (timedOut) {
      return { timedOut: true };
    }

    const error = err instanceof Error ? err : new Error(String(err));
    return { timedOut: false, networkError: error };
  } finally {
    clearTimeout(timer);
  }
}
