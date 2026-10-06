import { NextRequest, NextResponse } from "next/server";
import { ensureVapid, sendPush } from "@/lib/push/server";
import { requireActiveUser } from "@/lib/auth/session";

/** Envía una notificación de prueba a la suscripción indicada (requiere sesión de la bóveda). */
export async function POST(req: NextRequest) {
  const guard = await requireActiveUser();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!ensureVapid()) return NextResponse.json({ error: "VAPID no configurado" }, { status: 503 });
  const { subscription } = await req.json();
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (typeof endpoint !== "string" || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }
  const res = await sendPush(
    { endpoint, p256dh, auth },
    { title: "TAFINANCE", body: "¡Las notificaciones funcionan! Te avisaré de cortes y pagos aunque la app esté cerrada.", url: "/app", tag: "test" }
  );
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
