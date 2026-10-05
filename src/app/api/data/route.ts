import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/session";
import { applyOps, fetchSnapshot, MAX_OPS_PER_BATCH, sanitizeOp } from "@/lib/supabase/data-ops";
import { INVALID_OP_CODE } from "@/lib/storage/remote-schema";

export const dynamic = "force-dynamic";

/**
 * Única puerta del navegador a los datos. Cada petición usa el JWT del usuario: RLS
 * (auth.uid() + perfil activo) acota todo a sus propias filas; user_id se fuerza en servidor.
 */
const denied = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function GET() {
  const guard = await requireActiveUser();
  if (!guard.ok) return denied(guard.status, guard.error);
  const { db, user } = guard.session;
  const { data, error } = await fetchSnapshot(db, user.id);
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const guard = await requireActiveUser();
  if (!guard.ok) return denied(guard.status, guard.error);
  const { db, user } = guard.session;
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
  const result = await applyOps(db, user.id, valid);
  if (bad !== -1 && !result.error) {
    result.error = { code: INVALID_OP_CODE, message: `Operación inválida en la posición ${bad}` };
  }
  return NextResponse.json(result);
}
