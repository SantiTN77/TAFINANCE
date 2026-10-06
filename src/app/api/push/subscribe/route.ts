import { NextRequest, NextResponse } from "next/server";
import { subscriptionId, PushReminder } from "@/lib/push/server";
import { requireActiveUser } from "@/lib/auth/session";

function cleanReminders(input: unknown): PushReminder[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((r) => r && typeof r.id === "string" && typeof r.title === "string" && typeof r.fireAt === "string")
    .slice(0, 100)
    .map((r) => ({
      id: String(r.id).slice(0, 120),
      title: String(r.title).slice(0, 120),
      body: String(r.body || "").slice(0, 240),
      fireAt: String(r.fireAt),
      url: "/app",
    }));
}

/** Registra/actualiza la suscripción push del dispositivo y sus recordatorios programados. */
export async function POST(req: NextRequest) {
  try {
    const { subscription, reminders, userAgent } = await req.json();
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || !p256dh || !auth) {
      return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
    }
    const guard = await requireActiveUser();
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { db, user } = guard.session;

    const id = subscriptionId(endpoint);
    const list = cleanReminders(reminders);

    // Conserva los ya enviados que siguen vigentes (evita repetir avisos)
    const { data: existing } = await db.from("push_subscriptions").select("sent").eq("user_id", user.id).eq("id", id).maybeSingle();
    const liveIds = new Set(list.map((r) => r.id));
    const sent = ((existing?.sent as string[]) || []).filter((s) => liveIds.has(s));

    const { error } = await db.from("push_subscriptions").upsert({
      user_id: user.id,
      id,
      endpoint,
      p256dh,
      auth,
      reminders: list,
      sent,
      user_agent: typeof userAgent === "string" ? userAgent.slice(0, 200) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,id" });
    if (error) {
      console.error("[TAF][push/subscribe]", error.message);
      return NextResponse.json({ error: "No se pudo guardar la suscripción" }, { status: 500 });
    }
    console.log("[TAF][push/subscribe] ok", { id, reminders: list.length });
    return NextResponse.json({ ok: true, id, reminders: list.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    const guard = await requireActiveUser();
    if (!guard.ok || typeof endpoint !== "string") return NextResponse.json({ ok: true });
    await guard.session.db
      .from("push_subscriptions")
      .delete()
      .eq("user_id", guard.session.user.id)
      .eq("id", subscriptionId(endpoint));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
