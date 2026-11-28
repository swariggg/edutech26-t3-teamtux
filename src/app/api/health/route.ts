import { NextResponse } from "next/server";
import { hasLLM, hasSupabase } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, dataSource: hasSupabase ? "supabase" : "mock", llm: hasLLM ? "anthropic" : "mock" }, { headers: { "Cache-Control": "no-store" } });
}
