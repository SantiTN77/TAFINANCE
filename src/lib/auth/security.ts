// Web Crypto API HMAC-SHA256: cookies firmadas del dispositivo y desafíos WebAuthn.
// Las sesiones de usuario las gestiona Supabase Auth (ver session.ts).

// Solo para `next dev`: en cualquier otro entorno falta el secreto = nadie entra (falla cerrado).
const DEV_ONLY_SECRET = "tafinance-dev-only-secret-not-for-production";
const DEV_ONLY_PIN = "7777";
const MIN_SECRET_LENGTH = 32;
const MIN_PIN_LENGTH = 4;

const isDev = () => process.env.NODE_ENV === "development";

/** Secreto HMAC de sesiones y cookies firmadas. Lanza si no está configurado (fuera de dev). */
export function getAuthSecret(): string {
  const secret = process.env.TAFINANCE_SECRET?.trim();
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  if (isDev()) return DEV_ONLY_SECRET;
  throw new Error(`TAFINANCE_SECRET no definido o con menos de ${MIN_SECRET_LENGTH} caracteres`);
}

/** PIN maestro, o null si no está configurado (fuera de dev): el login queda deshabilitado. */
export function getMasterPin(): string | null {
  const pin = process.env.TAFINANCE_PIN?.trim();
  if (pin && pin.length >= MIN_PIN_LENGTH) return pin;
  if (isDev()) return DEV_ONLY_PIN;
  return null;
}

/** true si el servidor puede emitir sesiones (secreto y PIN válidos). */
export function isAuthConfigured(): boolean {
  try {
    getAuthSecret();
  } catch {
    return false;
  }
  return getMasterPin() !== null;
}

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

/* ------------------------------------------------------------------ */
/* Tokens firmados genéricos (cookies de dispositivo / desafíos)        */
/* ------------------------------------------------------------------ */

export async function signPayload(payload: Record<string, unknown>, ttlMs: number): Promise<string> {
  const secret = getAuthSecret();
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })));
  const key = await getCryptoKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${base64UrlEncode(sig)}`;
}

export async function verifyPayload<T = Record<string, any>>(token: string | undefined | null): Promise<T | null> {
  if (!token || !token.includes(".")) return null;
  try {
    const [body, sig] = token.split(".");
    const key = await getCryptoKey(getAuthSecret());
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
