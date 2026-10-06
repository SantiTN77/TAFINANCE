import { NextRequest, NextResponse } from "next/server";
import { storeForRequest } from "@/lib/storage/server-store";
import { TxValidationError } from "@/lib/finance/tx-edit";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Ctx) {
  const scoped = await storeForRequest();
  if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const financeStore = scoped.store;
  try {
    const { id } = await params;
    const tx = await financeStore.getTransaction(id);
    return tx ? NextResponse.json(tx) : notFound();
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Edita campos de un movimiento (monto, descripción, fecha, cuenta, categoría…). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const scoped = await storeForRequest();
  if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const financeStore = scoped.store;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
    }
    const updated = await financeStore.updateTransaction(id, body);
    return updated ? NextResponse.json(updated) : notFound();
  } catch (error: any) {
    if (error instanceof TxValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const scoped = await storeForRequest();
  if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const financeStore = scoped.store;
  try {
    const { id } = await params;
    const ok = await financeStore.deleteTransaction(id);
    return ok ? NextResponse.json({ ok: true, id }) : notFound();
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
