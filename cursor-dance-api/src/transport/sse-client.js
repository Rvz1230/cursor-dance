function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException("AI 请求已取消。", "AbortError");
}

export function consumeSseChunk(buffer, eventType, chunk, flush = false) {
  const lines = `${buffer}${chunk}`.split(/\r?\n/);
  let remainder = lines.pop() || "";
  if (flush && remainder) {
    lines.push(remainder);
    remainder = "";
  }

  const events = [];
  let nextEventType = eventType || "message";
  for (const line of lines) {
    if (line.startsWith("event:")) {
      nextEventType = line.slice(6).trim() || "message";
      continue;
    }
    if (!line.startsWith("data:")) continue;
    const rawData = line.slice(5).trim();
    if (!rawData) continue;
    try {
      events.push({ type: nextEventType, data: JSON.parse(rawData) });
    } catch {
      // A malformed provider event must not invalidate the remaining stream.
    }
  }

  return { events, eventType: nextEventType, remainder };
}

export async function* readJsonSseEvents(response, { signal } = {}) {
  if (!response.body) throw new Error("SSE response body is unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "message";
  let completed = false;
  const cancelReader = () => {
    void reader.cancel(signal?.reason).catch(() => {});
  };
  signal?.addEventListener("abort", cancelReader, { once: true });

  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      throwIfAborted(signal);
      if (done) {
        completed = true;
        const finalChunk = consumeSseChunk(buffer, eventType, decoder.decode(), true);
        for (const event of finalChunk.events) yield event;
        return;
      }

      const parsed = consumeSseChunk(
        buffer,
        eventType,
        decoder.decode(value, { stream: true }),
      );
      buffer = parsed.remainder;
      eventType = parsed.eventType;
      for (const event of parsed.events) yield event;
    }
  } finally {
    signal?.removeEventListener("abort", cancelReader);
    if (!completed) {
      try {
        await reader.cancel();
      } catch {
        // The response may already have been cancelled by its AbortSignal.
      }
    }
    reader.releaseLock?.();
  }
}
