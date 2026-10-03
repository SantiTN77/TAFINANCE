import { NextRequest, NextResponse } from "next/server";
import { parseVoiceFinancialInput } from "@/lib/ai/gemini-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = body.text || body.prompt || body.message || body.query;
    const apiKey = body.apiKey;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json(
        { error: "El campo 'text' o 'prompt' es obligatorio" },
        { status: 400 }
      );
    }

    const parsed = await parseVoiceFinancialInput(rawText.trim(), apiKey);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Error en /api/voice/parse:", error);
    return NextResponse.json(
      { error: error?.message || "Error procesando el comando financiero" },
      { status: 500 }
    );
  }
}
