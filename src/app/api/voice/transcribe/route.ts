import { requireActiveUser } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { transcribeAndParse } from "@/lib/ai/gemini-client";

export const maxDuration = 30;

/**
 * Plan B de la voz: cuando el navegador no tiene reconocimiento de voz (o falla por red),
 * el cliente graba el audio y lo envía aquí; Gemini lo transcribe y extrae el movimiento.
 */
export async function POST(req: NextRequest) {
  // Gasta cuota de IA: solo usuarios con cuenta activa (no basta con una sesión de registro público)
  const guard = await requireActiveUser();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const started = Date.now();
  try {
    const body = await req.json();
    const { audio, mimeType } = body;
    if (typeof audio !== "string" || !audio || typeof mimeType !== "string") {
      return NextResponse.json({ error: "Audio inválido" }, { status: 400 });
    }
    // ~8 MB en base64: más que suficiente para una frase corta
    if (audio.length > 8_000_000) {
      return NextResponse.json({ error: "Audio demasiado largo" }, { status: 413 });
    }
    const result = await transcribeAndParse(audio, mimeType.split(";")[0], {
      categories: Array.isArray(body.categories) ? body.categories.slice(0, 40) : undefined,
      today: typeof body.today === "string" ? body.today : undefined,
    });
    console.log(`[TAF][voice/transcribe] ok ${Date.now() - started}ms`, { chars: result.transcript.length });
    return NextResponse.json(result);
  } catch (error: any) {
    const noKey = error?.message === "NO_GEMINI_KEY";
    console.error("[TAF][voice/transcribe] error:", error?.message || error);
    return NextResponse.json(
      {
        error: noKey
          ? "La transcripción por servidor requiere GEMINI_API_KEY."
          : "No se pudo transcribir el audio. Intenta de nuevo o escribe el gasto.",
        code: noKey ? "NO_KEY" : "FAILED",
      },
      { status: noKey ? 501 : 502 }
    );
  }
}
