/**
 * Shared credential resolution.
 *
 * Resolves the API key across the four supported sources with a fixed
 * precedence, and reads environment variables in a way that is safe under both
 * CJS and ESM targets (Requirements 7.1, 7.2, 7.3, 7.4, 7.5).
 */

export interface KeySources {
  /** value passed directly to hook/config */
  explicit?: string;
  /** value from InletbaseProvider context */
  context?: string;
  /** NEXT_PUBLIC_INLETBASE_API_KEY */
  nextPublic?: string;
  /** VITE_INLETBASE_API_KEY */
  vite?: string;
}

/**
 * Returns the first defined, non-empty key in precedence order:
 * explicit → context → nextPublic → vite. Returns undefined if none (Req 7.3, 7.5).
 *
 * Never throws: each candidate is coerced defensively before being trimmed.
 */
export function resolveApiKey(sources: KeySources): string | undefined {
  const candidates = [
    sources?.explicit,
    sources?.context,
    sources?.nextPublic,
    sources?.vite,
  ];

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

/**
 * Reads env vars without a bare `import.meta` reference so it is safe under
 * both CJS and ESM targets (Req 7.1, 7.2, 7.4).
 *
 * - `process.env` is read behind a `typeof process` guard so it is safe when
 *   `process` is undefined (browser/ESM) and when it exists (Node/CJS).
 * - `import.meta.env` is read through a `Function`-based indirection wrapped in
 *   a try/catch. Under CJS targets a bare `import.meta` is a syntax error, so
 *   constructing the accessor via `Function` keeps the syntax out of the module
 *   body; any failure (SyntaxError under CJS, or a throw during evaluation) is
 *   swallowed and treated as "no value". This never throws.
 */
export function readEnvKeys(): { nextPublic?: string; vite?: string } {
  const result: { nextPublic?: string; vite?: string } = {};

  // NEXT_PUBLIC_* — Node / bundlers that expose process.env.
  try {
    if (typeof process !== 'undefined' && process.env) {
      const value = process.env.NEXT_PUBLIC_INLETBASE_API_KEY;
      if (typeof value === 'string') {
        result.nextPublic = value;
      }
    }
  } catch {
    // Ignore — treat as absent.
  }

  // VITE_* — ESM-only `import.meta.env`, accessed without a bare `import.meta`.
  try {
    const importMetaEnv = readImportMetaEnv();
    const value = importMetaEnv?.VITE_INLETBASE_API_KEY;
    if (typeof value === 'string') {
      result.vite = value;
    }
  } catch {
    // Ignore — treat as absent.
  }

  return result;
}

/**
 * Safely returns `import.meta.env` (or undefined) without embedding a bare
 * `import.meta` token in this module. Building the accessor lazily via
 * `Function` prevents CJS build targets from choking on the ESM-only syntax at
 * parse time. Errors are contained by the caller.
 */
function readImportMetaEnv(): Record<string, string | undefined> | undefined {
  try {
    // eslint-disable-next-line no-new-func
    const getImportMeta = new Function(
      'try { return typeof import.meta !== "undefined" ? import.meta : undefined; } catch { return undefined; }'
    ) as () => { env?: Record<string, string | undefined> } | undefined;

    const meta = getImportMeta();
    return meta?.env;
  } catch {
    return undefined;
  }
}
