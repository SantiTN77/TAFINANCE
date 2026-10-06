import { requireActiveUser } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { scanReceiptImage } from "@/lib/ai/receipt-ocr";

export async function POST(req: NextRequest) {
  // Gasta cuota de IA: solo usuarios con cuenta activa (no basta con una sesión de registro público)
  const guard = await requireActiveUser();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const body = await req.json();
    const { image, mimeType, apiKey } = body;

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "Se requiere la imagen en base64" },
        { status: 400 }
      );
    }

    const scanned = await scanReceiptImage(image, mimeType || "image/jpeg", apiKey);
    return NextResponse.json(scanned);
  } catch (error: any) {
    console.error("Error en /api/ocr/scan:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar la factura" },
      { status: 500 }
    );
  }
}
