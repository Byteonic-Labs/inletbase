/**
 * Shared credential resolution.
 *
 * Resolves the forms API key from the two supported sources with a fixed
 * precedence: an explicit value passed to the hook/config, then the value
 * supplied through `InletbaseProvider`. There is no environment-variable
 * fallback — the key must be provided explicitly.
 */

export interface KeySources {
  /** value passed directly to the hook/config */
  explicit?: string;
  /** value from InletbaseProvider context */
  context?: string;
}

/**
 * Returns the first defined, non-empty key in precedence order:
 * explicit → context. Returns undefined if none.
 *
 * Never throws: each candidate is coerced defensively before being trimmed.
 */
export function resolveApiKey(sources: KeySources): string | undefined {
  const candidates = [sources?.explicit, sources?.context];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed !== '') {
        return trimmed;
      }
    }
  }

  return undefined;
}
