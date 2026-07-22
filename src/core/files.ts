/**
 * File encoding helpers for form submissions.
 *
 * The Inletbase forms backend stores uploaded files that arrive as base64
 * data-URL payloads tagged with `__inletbase_file`. It does NOT decode raw
 * multipart `File` parts into stored files. So the SDK converts any native
 * `File`/`Blob` values (whether supplied via `FormData` or a plain object) into
 * that payload shape and submits a JSON body — matching exactly what the
 * first-party form renderer produces and what the backend ingests.
 */

/** The stored-file payload the forms backend understands. */
export interface InletbaseFilePayload {
  __inletbase_file: true;
  name: string;
  type: string;
  size: number;
  /** `data:<mime>;base64,<...>` */
  data: string;
}

/**
 * Detects a native binary value (browser `File`/`Blob` or Node 18+ undici
 * `File`/`Blob`). We feature-detect `arrayBuffer()` + numeric `size` rather
 * than rely on `instanceof`, which is unreliable across realms/runtimes.
 */
export function isFileLike(value: unknown): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function' &&
    typeof (value as { size?: unknown }).size === 'number'
  );
}

/** Base64-encodes an ArrayBuffer in both Node (Buffer) and the browser (btoa). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // avoid arg-count limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

/** Reads a File/Blob into the `__inletbase_file` base64 payload. */
export async function fileToPayload(file: Blob): Promise<InletbaseFilePayload> {
  const buffer = await file.arrayBuffer();
  const type = file.type || 'application/octet-stream';
  const name = (file as File).name || 'file';
  const size = typeof file.size === 'number' ? file.size : buffer.byteLength;
  return {
    __inletbase_file: true,
    name,
    type,
    size,
    data: `data:${type};base64,${arrayBufferToBase64(buffer)}`,
  };
}

/**
 * Converts `FormData` to a plain object, encoding every `File` entry as a
 * payload. Repeated keys (multi-file inputs) collapse into an array.
 */
export async function formDataToObject(formData: FormData): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  const entries: Array<[string, FormDataEntryValue]> = [];
  formData.forEach((value, key) => entries.push([key, value]));

  for (const [key, value] of entries) {
    const encoded = isFileLike(value) ? await fileToPayload(value) : value;
    if (key in out) {
      const existing = out[key];
      if (Array.isArray(existing)) existing.push(encoded);
      else out[key] = [existing, encoded];
    } else {
      out[key] = encoded;
    }
  }
  return out;
}

/**
 * Encodes any `File`/`Blob` values found in a plain object — both top-level
 * values and items inside array values — leaving everything else untouched.
 */
export async function encodeObjectFiles(obj: Record<string, any>): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isFileLike(value)) {
      out[key] = await fileToPayload(value);
    } else if (Array.isArray(value)) {
      out[key] = await Promise.all(
        value.map((item) => (isFileLike(item) ? fileToPayload(item) : item))
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Normalizes a submission input (`FormData` or a plain object) into a
 * JSON-serializable object, encoding any `File`/`Blob` values as base64
 * `__inletbase_file` payloads. This lets the SDK always POST JSON — the format
 * the forms backend actually stores.
 */
export async function normalizeSubmissionData(
  data: Record<string, any> | FormData
): Promise<Record<string, any>> {
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return formDataToObject(data);
  }
  if (data && typeof data === 'object') {
    return encodeObjectFiles(data as Record<string, any>);
  }
  return {};
}
