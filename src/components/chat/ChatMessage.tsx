import Link from "next/link";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/cn";

const ROUTE = /(\*\*[^*]+\*\*|\/(?:admision|estado|pagos|asesor)\b)/g;

/** Markdown mínimo y seguro (sin dangerouslySetInnerHTML): **negrita**, listas con "-" o "1.", enlaces a rutas internas. */
function inline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(ROUTE).filter(Boolean).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      return /^\/(admision|estado|pagos|asesor)$/.test(inner)
        ? <Link key={key} href={inner} className="font-semibold text-primary underline">{inner}</Link>
        : <strong key={key}>{inner}</strong>;
    }
    if (/^\/(admision|estado|pagos|asesor)$/.test(part)) return <Link key={key} href={part} className="font-medium text-primary underline">{part}</Link>;
    return <span key={key}>{part}</span>;
  });
}

export function renderMarkdown(text: string): React.ReactNode {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, b) => {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (lines.length && lines.every((l) => /^\s*[-•]\s+/.test(l))) {
      return <ul key={b} className="my-2 list-disc space-y-1 pl-5">{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*[-•]\s+/, ""), `${b}-${i}`)}</li>)}</ul>;
    }
    if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      return <ol key={b} className="my-2 list-decimal space-y-1 pl-5">{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `${b}-${i}`)}</li>)}</ol>;
    }
    return <p key={b} className="my-1 whitespace-pre-wrap">{inline(block, `${b}`)}</p>;
  });
}

export function ChatMessage({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full", isUser ? "bg-primary text-on-primary" : "bg-accent/15 text-accent")}>
        {isUser ? <User className="size-5" /> : <Bot className="size-5" />}
      </span>
      <div className={cn("max-w-[85%] rounded-xl px-4 py-3 leading-relaxed", isUser ? "bg-primary text-on-primary" : "glass glass-strong")}>
        <p className="sr-only">{isUser ? "Tú dijiste:" : "El asesor respondió:"}</p>
        {isUser ? <p className="whitespace-pre-wrap">{content}</p> : renderMarkdown(content)}
      </div>
    </div>
  );
}
