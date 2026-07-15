/**
 * SSR-safe key/value storage.
 *
 * Provides a minimal storage abstraction the ChatEngine uses to persist chat
 * messages and the session id. The default implementation delegates to
 * `window.localStorage` when it is available and falls back to an in-memory
 * `Map` otherwise, so it is safe to construct during server-side rendering or
 * in any non-browser environment (Requirements 1.3, 3.2).
 */

export interface KeyValueStorage {
  /** Returns the stored value for `key`, or `null` when absent. */
  getItem(key: string): string | null;
  /** Stores `value` under `key`. */
  setItem(key: string, value: string): void;
  /** Removes any stored value for `key`. */
  removeItem(key: string): void;
}

/**
 * In-memory `KeyValueStorage` backed by a `Map`. Used as the fallback when no
 * usable `window.localStorage` is present (SSR / non-browser) and never throws.
 */
class MemoryStorage implements KeyValueStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

/**
 * `KeyValueStorage` that delegates to a real `Storage` implementation (such as
 * `window.localStorage`). Each operation is guarded so that a throwing backend
 * (e.g. quota errors or privacy-mode restrictions) degrades gracefully instead
 * of propagating an exception across the storage boundary.
 */
class DelegatingStorage implements KeyValueStorage {
  constructor(private readonly backend: Storage) {}

  getItem(key: string): string | null {
    try {
      return this.backend.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.backend.setItem(key, value);
    } catch {
      // Ignore — treat storage as unavailable for this write.
    }
  }

  removeItem(key: string): void {
    try {
      this.backend.removeItem(key);
    } catch {
      // Ignore — treat storage as unavailable for this removal.
    }
  }
}

/**
 * Returns a usable `Storage` (typically `window.localStorage`) when one is
 * available and functional, or `undefined` otherwise. Some environments expose
 * `window.localStorage` but throw on access (privacy mode, sandboxed iframes),
 * so availability is probed with a round-trip write/remove.
 */
function getBrowserStorage(): Storage | undefined {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return undefined;
    }

    const storage = window.localStorage;
    const probeKey = '__inletbase_storage_probe__';
    storage.setItem(probeKey, probeKey);
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return undefined;
  }
}

/**
 * Creates the default SSR-safe `KeyValueStorage`.
 *
 * Delegates to `window.localStorage` when it is present and functional, and
 * otherwise returns an in-memory store. This lets the ChatEngine persist state
 * in the browser while remaining safe to construct on the server (Req 1.3, 3.2).
 */
export function createDefaultStorage(): KeyValueStorage {
  const browserStorage = getBrowserStorage();
  return browserStorage
    ? new DelegatingStorage(browserStorage)
    : new MemoryStorage();
}
