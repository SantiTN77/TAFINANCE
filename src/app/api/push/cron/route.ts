import { NextRequest, NextResponse } from "next/server";
import { ensureVapid, sendPush, serverDb, SubscriptionRow } from "@/lib/push/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Envía los recordatorios vencidos a cada dispositivo suscrito (la app puede estar cerrada).
 * Lo invoca Vercel Cron (ver vercel.json) con `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  if (!secret || bearer !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ensureVapid()) return NextResponse.json({ error: "VAPID no configurado" }, { status: 503 });
  const db = serverDb();
  if (!db) return NextResponse.json({ error: "Base de datos no configurada" }, { status: 503 });

  const { data, error } = await db.from("push_subscriptions").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  let delivered = 0;
  let removed = 0;

  for (const row of (data || []) as SubscriptionRow[]) {
    const sent = new Set(row.sent || []);
    // Vencidos y no enviados; ignora los de hace más de 3 días (ya no son útiles)
    const due = (row.reminders || []).filter((r) => {
      const t = Date.parse(r.fireAt);
      return !sent.has(r.id) && t <= now && now - t < 3 * 86400000;
    });
    let gone = false;
    for (const r of due) {
      const res = await sendPush(row, { title: r.title, body: r.body, url: r.url || "/app", tag: r.id });
      if (res.ok) {
        sent.add(r.id);
        delivered++;
      } else if (res.gone) {
        gone = true;
        break;
      }
    }
    if (gone) {
      await db.from("push_subscriptions").delete().eq("id", row.id);
      removed++;
    } else if (due.length) {
      await db.from("push_subscriptions").update({ sent: [...sent] }).eq("id", row.id);
    }
  }
  console.log("[TAF][push/cron]", { subs: data?.length || 0, delivered, removed });
  return NextResponse.json({ ok: true, subs: data?.length || 0, delivered, removed });
}
