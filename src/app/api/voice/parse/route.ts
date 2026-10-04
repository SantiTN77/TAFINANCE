import { NextRequest, NextResponse } from "next/server";
import { parseVoiceFinancialInput } from "@/lib/ai/gemini-client";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const body = await req.json();
    const rawText = body.text || body.prompt || body.message || body.query;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json({ error: "El campo 'text' o 'prompt' es obligatorio" }, { status: 400 });
    }

    const parsed = await parseVoiceFinancialInput(rawText.trim(), {
      customApiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      categories: Array.isArray(body.categories) ? body.categories.filter((c: unknown) => typeof c === "string").slice(0, 40) : undefined,
      today: typeof body.today === "string" ? body.today : undefined,
    });
    console.log(`[TAF][voice/parse] ok ${Date.now() - started}ms`, { amount: parsed.amount, type: parsed.type, cat: parsed.category });
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("[TAF][voice/parse] error:", error);
    return NextResponse.json({ error: error?.message || "Error procesando el comando financiero" }, { status: 500 });
  }
}
