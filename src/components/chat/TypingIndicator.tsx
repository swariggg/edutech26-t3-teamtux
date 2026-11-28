export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <span className="sr-only">El asesor está escribiendo…</span>
      <span aria-hidden className="glass glass-strong inline-flex gap-1 rounded-xl px-4 py-4">
        <span className="typing-dot size-2 rounded-full bg-muted" />
        <span className="typing-dot size-2 rounded-full bg-muted" />
        <span className="typing-dot size-2 rounded-full bg-muted" />
      </span>
    </div>
  );
}
