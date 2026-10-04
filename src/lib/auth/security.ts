// Web Crypto API HMAC-SHA256 Token generator and validator (Edge-compatible)

const DEFAULT_SECRET = "tafinance-vault-secure-auth-token-2026";

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function createSessionToken(
  daysValid: number = 30
): Promise<string> {
  const secret = process.env.TAFINANCE_SECRET || DEFAULT_SECRET;
  const exp = Date.now() + daysValid * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ exp, valid: true });
  const payloadEnc = new TextEncoder().encode(payload);
  const payloadB64 = base64UrlEncode(payloadEnc);

  const key = await getCryptoKey(secret);
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  const sigB64 = base64UrlEncode(sigBuffer);

  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || !token.includes(".")) return false;
  try {
    const [payloadB64, sigB64] = token.split(".");
    const secret = process.env.TAFINANCE_SECRET || DEFAULT_SECRET;
    const key = await getCryptoKey(secret);

    const sigBytes = base64UrlDecode(sigB64);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
      new TextEncoder().encode(payloadB64)
    );

    if (!isValid) return false;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);

    if (!payload.exp || Date.now() > payload.exp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function getMasterPin(): string {
  const pin = process.env.TAFINANCE_PIN;
  if (!pin && process.env.NODE_ENV === "production") {
    console.warn("[TAF][auth] TAFINANCE_PIN no está definido en producción: se usa el PIN por defecto. Defínelo en Vercel.");
  }
  return pin || "7777";
}

/* ------------------------------------------------------------------ */
/* Tokens firmados genéricos (cookies de dispositivo / desafíos)        */
/* ------------------------------------------------------------------ */

export async function signPayload(payload: Record<string, unknown>, ttlMs: number): Promise<string> {
  const secret = process.env.TAFINANCE_SECRET || DEFAULT_SECRET;
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })));
  const key = await getCryptoKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${base64UrlEncode(sig)}`;
}

export async function verifyPayload<T = Record<string, any>>(token: string | undefined | null): Promise<T | null> {
  if (!token || !token.includes(".")) return null;
  try {
    const [body, sig] = token.split(".");
    const key = await getCryptoKey(process.env.TAFINANCE_SECRET || DEFAULT_SECRET);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sig) as unknown as BufferSource,
      new TextEncoder().encode(body)
    );
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
    if (!data.exp || Date.now() > data.exp) return null;
    return data as T;
  } catch {
    return null;
  }
}

export { base64UrlEncode, base64UrlDecode };

/* ------------------------------------------------------------------ */
/* Limitador de intentos de PIN (por IP, en memoria del servidor)       */
/* ------------------------------------------------------------------ */

const attempts = new Map<string, { fails: number; lockedUntil: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

export function checkPinThrottle(ip: string): { allowed: boolean; retryAfterSec: number } {
  const rec = attempts.get(ip);
  if (rec && rec.lockedUntil > Date.now()) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordPinResult(ip: string, success: boolean) {
  if (success) {
    attempts.delete(ip);
    return;
  }
  const rec = attempts.get(ip) || { fails: 0, lockedUntil: 0 };
  rec.fails += 1;
  if (rec.fails >= MAX_FAILS) {
    rec.lockedUntil = Date.now() + LOCK_MS * Math.min(10, rec.fails - MAX_FAILS + 1);
  }
  attempts.set(ip, rec);
  if (attempts.size > 500) attempts.clear();
}
