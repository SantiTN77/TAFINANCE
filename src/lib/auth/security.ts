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
  return process.env.TAFINANCE_PIN || "7777";
}
