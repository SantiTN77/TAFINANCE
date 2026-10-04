import { createHash } from "crypto";
import { base64UrlDecode } from "./security";

/**
 * Verificación de aserciones WebAuthn sin dependencias externas.
 * La clave pública se guarda en una cookie firmada y ligada al dispositivo (ver /register),
 * por lo que no hace falta base de datos y nadie puede inyectar credenciales ajenas.
 */

export interface DeviceCredential {
  cid: string; // credentialId (base64url)
  pk: string; // clave pública SPKI (base64url)
  alg: number; // -7 (ES256) | -257 (RS256)
}

/** DER ECDSA (SEQUENCE{INTEGER r, INTEGER s}) → r||s de 64 bytes */
function derToRawEcdsa(der: Uint8Array): Uint8Array {
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f; // longitud larga
  const readInt = () => {
    if (der[i++] !== 0x02) throw new Error("DER inválido");
    const len = der[i++];
    let bytes = der.slice(i, i + len);
    i += len;
    while (bytes.length > 32 && bytes[0] === 0) bytes = bytes.slice(1);
    const out = new Uint8Array(32);
    out.set(bytes, 32 - bytes.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

export async function verifyAssertion(opts: {
  credential: DeviceCredential;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const authData = base64UrlDecode(opts.authenticatorData);
    const clientDataBytes = base64UrlDecode(opts.clientDataJSON);
    const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));

    if (clientData.type !== "webauthn.get") return { ok: false, reason: "tipo" };
    if (clientData.challenge !== opts.expectedChallenge) return { ok: false, reason: "challenge" };
    if (clientData.origin !== opts.expectedOrigin) return { ok: false, reason: "origen" };

    // authData: rpIdHash(32) | flags(1) | signCount(4)
    const rpIdHash = createHash("sha256").update(opts.expectedRpId).digest();
    if (!Buffer.from(authData.slice(0, 32)).equals(rpIdHash)) return { ok: false, reason: "rpId" };
    const flags = authData[32];
    if (!(flags & 0x01)) return { ok: false, reason: "presencia" }; // User Present
    if (!(flags & 0x04)) return { ok: false, reason: "verificación" }; // User Verified (huella/FaceID)

    const clientHash = createHash("sha256").update(clientDataBytes).digest();
    const signed = new Uint8Array(authData.length + clientHash.length);
    signed.set(authData, 0);
    signed.set(clientHash, authData.length);

    const spki = base64UrlDecode(opts.credential.pk);
    const sig = base64UrlDecode(opts.signature);

    let valid = false;
    if (opts.credential.alg === -7) {
      const key = await crypto.subtle.importKey(
        "spki",
        spki as unknown as BufferSource,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );
      valid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        derToRawEcdsa(sig) as unknown as BufferSource,
        signed as unknown as BufferSource
      );
    } else if (opts.credential.alg === -257) {
      const key = await crypto.subtle.importKey(
        "spki",
        spki as unknown as BufferSource,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
      );
      valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        sig as unknown as BufferSource,
        signed as unknown as BufferSource
      );
    } else {
      return { ok: false, reason: "algoritmo" };
    }
    return valid ? { ok: true } : { ok: false, reason: "firma" };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "error" };
  }
}

/** Origen y rpId reales de la petición (detrás del proxy de Vercel). */
export function requestOrigin(req: Request): { origin: string; rpId: string } {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const proto =
    req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return { origin: `${proto}://${host}`, rpId: host.split(":")[0] };
}
