/**
 * Shared response normalization.
 *
 * Maps HTTP responses and network/timeout failures into a single canonical
 * `ResponseEnvelope` shape shared by the forms client and server client
 * (Requirements 1.7, 1.8, 6.1, 6.3, 6.4, 6.5, 6.6).
 */

export interface ResponseEnvelope<T = any> {
  /** true iff status is in 200–299 */
  success: boolean;
  /** numeric HTTP status; 0 for network/timeout failure */
  status: number;
  /** backend response body, or { error } on failure */
  data: T;
  /** convenience mirror of data.error on failure */
  error?: string;
  /** backend top-level fields spread for back-compat (Req 6.6) */
  [key: string]: any;
}

/**
 * Returns true only for a plain object literal (`{}`-shaped) whose top-level
 * fields are safe to spread onto the envelope. Arrays, `null`, and class
 * instances are intentionally excluded so we don't merge array indices or
 * prototype-bound values into the envelope.
 */
function isPlainObject(value: any): value is Record<string, any> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Maps an HTTP response + parsed body to the canonical envelope.
 *
 * `success` is true iff `status` is in 200–299. The parsed `body` is placed in
 * `data`, and when `body` is a plain object its top-level fields are spread onto
 * the envelope for backward-compatible top-level field access (Req 6.6). The
 * canonical `success`/`status`/`data` fields always take precedence over any
 * same-named backend field. On a non-2xx response the backend error is mirrored
 * onto `error` (from `body.error` when present) (Req 6.4).
 */
export function normalizeResponse(status: number, body: any): ResponseEnvelope {
  const success = status >= 200 && status <= 299;

  const envelope: ResponseEnvelope = {
    // Spread backend top-level fields first so canonical fields win on conflict.
    ...(isPlainObject(body) ? body : {}),
    success,
    status,
    data: body,
  };

  if (!success) {
    const backendError = isPlainObject(body) ? body.error : undefined;
    if (typeof backendError === 'string') {
      envelope.error = backendError;
    }
  }

  return envelope;
}

/**
 * Maps a network/timeout failure to the canonical failure envelope
 * (`success:false`, `status:0`, `data:{ error }`). A `status` of `0` is never a
 * valid HTTP status, so this result is always distinguishable from a non-2xx
 * HTTP response (Req 6.5).
 */
export function normalizeFailure(message: string): ResponseEnvelope {
  return {
    success: false,
    status: 0,
    data: { error: message },
    error: message,
  };
}
