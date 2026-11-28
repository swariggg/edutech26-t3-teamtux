"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./Button";

/** Copia un texto al portapapeles y confirma de forma visible y para lectores de pantalla. */
export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      {copied ? <Check aria-hidden className="size-4 text-success" /> : <Copy aria-hidden className="size-4" />}
      <span aria-live="polite">{copied ? "¡Copiado!" : label}</span>
    </Button>
  );
}
