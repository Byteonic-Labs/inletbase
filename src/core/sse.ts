/**
 * Shared Server-Sent Events (SSE) parsing.
 *
 * Consumes the Chat_Generate_Backend stream, accumulating delta content and
 * signalling completion, while robustly ignoring malformed lines
 * (Requirements 4.2, 4.3, 4.4).
 */

export interface SSEHandlers {
  /** chunk callback invoked with the running accumulation (Req 4.2) */
  onContent: (accumulated: string) => void;
  /** invoked when the `[DONE]` event is reached (Req 4.4) */
  onDone: () => void;
}

const DATA_PREFIX = 'data: ';

/**
 * Pure line-level reducer used by parseSSEStream and directly unit/property tested.
 * Given prior accumulation and one raw line, returns the next accumulation and
 * whether a content chunk was emitted / whether [DONE] was seen.
 *
 * - Lines not starting with `data: ` are ignored (Req 4.3).
 * - `data: [DONE]` signals completion; accumulation unchanged, nothing emitted (Req 4.4).
 * - `data: {json}` appends `choices[0].delta.content` when present (Req 4.2).
 * - Empty, partial, or unparseable payloads are ignored (Req 4.3).
 */
export function reduceSSELine(
  accumulated: string,
  line: string
): { accumulated: string; emitted: boolean; done: boolean } {
  // Ignore any line that is not a `data: ` event (Req 4.3).
  if (!line.startsWith(DATA_PREFIX)) {
    return { accumulated, emitted: false, done: false };
  }

  const payload = line.slice(DATA_PREFIX.length);

  // Terminating sentinel — signal completion without emitting (Req 4.4).
  if (payload === '[DONE]') {
    return { accumulated, emitted: false, done: true };
  }

  // Empty payload — nothing to parse (Req 4.3).
  if (payload.length === 0) {
    return { accumulated, emitted: false, done: false };
  }

  // Partial or unparseable JSON — ignore, preserving accumulation (Req 4.3).
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { accumulated, emitted: false, done: false };
  }

  const content = extractContent(parsed);
  if (typeof content !== 'string' || content.length === 0) {
    // No usable delta content — ignore (Req 4.3).
    return { accumulated, emitted: false, done: false };
  }

  // Append the delta content and mark a chunk as emitted (Req 4.2).
  return { accumulated: accumulated + content, emitted: true, done: false };
}

/**
 * Safely extract `choices[0].delta.content` from a parsed SSE payload.
 * Returns undefined when the shape does not match.
 */
function extractContent(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }
  const choices = (parsed as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined;
  }
  const first = choices[0];
  if (!first || typeof first !== 'object') {
    return undefined;
  }
  const delta = (first as { delta?: unknown }).delta;
  if (!delta || typeof delta !== 'object') {
    return undefined;
  }
  const content = (delta as { content?: unknown }).content;
  return typeof content === 'string' ? content : undefined;
}

/**
 * Consumes a ReadableStream of SSE bytes, accumulating delta content.
 * - Appends `choices[0].delta.content` and calls onContent with the full accumulation (Req 4.2).
 * - Ignores lines that are not `data: `, are empty/partial, or unparseable (Req 4.3).
 * - On `data: [DONE]` calls onDone and does NOT call onContent (Req 4.4).
 * Returns the final accumulated string and whether [DONE] was observed.
 */
export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  handlers: SSEHandlers
): Promise<{ content: string; doneSeen: boolean }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');

  let accumulated = '';
  let doneSeen = false;
  // Holds a partial trailing line across chunk boundaries.
  let buffer = '';

  try {
    let streamDone = false;
    while (!streamDone && !doneSeen) {
      const { value, done: readerDone } = await reader.read();
      streamDone = readerDone;

      if (value) {
        buffer += decoder.decode(value, { stream: true });
      } else if (streamDone) {
        // Flush any buffered multi-byte sequences on final read.
        buffer += decoder.decode();
      }

      // Split off complete lines, retaining the trailing partial in `buffer`.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        // Normalize CRLF line endings.
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        const result = reduceSSELine(accumulated, line);
        accumulated = result.accumulated;

        if (result.emitted) {
          handlers.onContent(accumulated);
        }

        if (result.done) {
          doneSeen = true;
          handlers.onDone();
          break;
        }
      }
    }

    // Process any remaining buffered line once the stream is exhausted.
    if (!doneSeen && buffer.length > 0) {
      const line = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
      const result = reduceSSELine(accumulated, line);
      accumulated = result.accumulated;

      if (result.emitted) {
        handlers.onContent(accumulated);
      }

      if (result.done) {
        doneSeen = true;
        handlers.onDone();
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { content: accumulated, doneSeen };
}
