import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/supabase/server";
import { applyOps, fetchSnapshot, MAX_OPS_PER_BATCH, sanitizeOp } from "@/lib/supabase/data-ops";
import { INVALID_OP_CODE } from "@/lib/storage/remote-schema";

export const dynamic = "force-dynamic";

/**
 * Única puerta del navegador a Supabase. Protegida por el middleware (cookie de sesión);
 * el servidor usa service_role y la BD no acepta la clave anónima.
 */
const disabled = () =>
  NextResponse.json({ disabled: true, error: "Base de datos remota no configurada" }, { status: 503 });

export async function GET() {
  const db = serverDb();
  if (!db) return disabled();
  const { data, error } = await fetchSnapshot(db);
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const db = serverDb();
  if (!db) return disabled();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const rawOps = Array.isArray(body?.ops) ? body.ops : null;
  if (!rawOps || rawOps.length === 0 || rawOps.length > MAX_OPS_PER_BATCH) {
    return NextResponse.json({ error: `ops debe tener entre 1 y ${MAX_OPS_PER_BATCH} operaciones` }, { status: 400 });
  }
  // Aplica el prefijo válido; una operación inválida se reporta para que el cliente la descarte
  const ops = rawOps.map(sanitizeOp);
  const bad = ops.findIndex((o: unknown) => o === null);
  const valid = bad === -1 ? ops : ops.slice(0, bad);
  const result = await applyOps(db, valid);
  if (bad !== -1 && !result.error) {
    result.error = { code: INVALID_OP_CODE, message: `Operación inválida en la posición ${bad}` };
  }
  return NextResponse.json(result);
}
