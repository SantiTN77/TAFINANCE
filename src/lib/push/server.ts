import webpush from "web-push";
import { createHash } from "crypto";

export interface PushReminder {
  id: string;
  title: string;
  body: string;
  fireAt: string; // ISO
  url?: string;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  reminders: PushReminder[];
  sent: string[];
}

export function subscriptionId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

/** Cliente de servidor con service_role (sin fallback a la clave anónima). */
export { serverDb } from "@/lib/supabase/server";

let vapidReady = false;
export function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@tafinance.local", pub, priv);
  vapidReady = true;
  return true;
}

export async function sendPush(
  sub: Pick<SubscriptionRow, "endpoint" | "p256dh" | "auth">,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<{ ok: boolean; gone: boolean; status?: number }> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: "high" }
    );
    return { ok: true, gone: false };
  } catch (e: any) {
    const status = e?.statusCode as number | undefined;
    return { ok: false, gone: status === 404 || status === 410, status };
  }
}
