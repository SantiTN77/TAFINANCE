import { serverDb } from "@/lib/supabase/server";

/**
 * Limitador de intentos de PIN persistente (tabla auth_throttle en Supabase).
 *
 * En serverless cada instancia tiene su propia memoria, así que un contador en memoria
 * no limita nada. Se cuentan dos claves: la IP (5 fallos → bloqueo creciente desde 1 min)
 * y una global (20 fallos → bloqueo creciente desde 5 min) contra ataques desde muchas IPs.
 * La biometría no pasa por aquí, así que el dueño puede entrar aunque el PIN esté bloqueado.
 *
 * Falla cerrado: si la BD no está configurada (fuera de `next dev`) o responde con error,
 * el login no se intenta.
 */

type Rule = { key: (ip: string) => string; max: number; lockSeconds: number };
const BASE_RULES: Rule[] = [
  { key: (ip) => `pin:ip:${ip}`, max: 5, lockSeconds: 60 },
  { key: () => "pin:global", max: 20, lockSeconds: 300 },
];
/** Con email (login con contraseña) se limita además por cuenta: frena el ataque distribuido a un usuario. */
const rulesFor = (subject?: string): Rule[] =>
  subject
    ? [...BASE_RULES, { key: () => `login:user:${subject.toLowerCase().slice(0, 200)}`, max: 8, lockSeconds: 120 }]
    : BASE_RULES;

export type ThrottleCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number }
  | { allowed: false; unavailable: true };

/* ---------- respaldo en memoria: SOLO para `next dev` sin Supabase ---------- */
const memory = new Map<string, { fails: number; lockedUntil: number }>();

function memoryHit(ip: string, RULES: Rule[]): number {
  const now = Date.now();
  const wait = Math.max(0, ...RULES.map((r) => Math.ceil(((memory.get(r.key(ip))?.lockedUntil || 0) - now) / 1000)));
  if (wait > 0) return wait;
  for (const r of RULES) {
    const rec = memory.get(r.key(ip)) || { fails: 0, lockedUntil: 0 };
    rec.fails += 1;
    if (rec.fails >= r.max) rec.lockedUntil = now + r.lockSeconds * 1000 * Math.min(10, rec.fails - r.max + 1);
    memory.set(r.key(ip), rec);
  }
  return 0;
}

const devFallback = () => process.env.NODE_ENV === "development";

/**
 * Registra un intento ANTES de comprobar el PIN (atómico en la BD, así que peticiones en
 * paralelo no se saltan el límite). Si el PIN resulta correcto, llama a `resetPinThrottle`.
 */
export async function hitPinThrottle(ip: string, subject?: string): Promise<ThrottleCheck> {
  const RULES = rulesFor(subject);
  const db = serverDb();
  if (!db) {
    if (!devFallback()) return { allowed: false, unavailable: true };
    const wait = memoryHit(ip, RULES);
    return wait > 0 ? { allowed: false, retryAfterSec: wait } : { allowed: true };
  }
  const { data, error } = await db.rpc("taf_throttle_hit", {
    p_keys: RULES.map((r) => r.key(ip)),
    p_max: RULES.map((r) => r.max),
    p_lock_seconds: RULES.map((r) => r.lockSeconds),
  });
  if (error) {
    console.error("[TAF][auth] limitador no disponible:", error.message);
    return { allowed: false, unavailable: true };
  }
  const wait = Number(data) || 0;
  return wait > 0 ? { allowed: false, retryAfterSec: wait } : { allowed: true };
}

export async function resetPinThrottle(ip: string, subject?: string): Promise<void> {
  const keys = rulesFor(subject).map((r) => r.key(ip));
  const db = serverDb();
  if (!db) {
    keys.forEach((k) => memory.delete(k));
    return;
  }
  const { error } = await db.rpc("taf_throttle_reset", { p_keys: keys });
  if (error) console.error("[TAF][auth] no se pudo reiniciar el limitador:", error.message);
}

/** IP del cliente. En Vercel, x-real-ip / x-forwarded-for los fija la plataforma. */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
