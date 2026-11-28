/** Convierte un AsyncIterable<string> en un ReadableStream de bytes UTF-8. */
export function iterableToStream(iterable: AsyncIterable<string>, onDone?: (full: string) => void): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let full = "";
  const iterator = iterable[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          onDone?.(full);
          return;
        }
        full += value;
        controller.enqueue(encoder.encode(value));
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}
