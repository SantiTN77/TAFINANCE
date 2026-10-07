// WebAuthn (huella / Face ID) — el servidor verifica la firma; aquí solo orquestamos al navegador.
import { logger } from "@/lib/debug/logger";

const b64u = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64u = (s: string): Uint8Array<ArrayBuffer> => {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) || false;
  } catch {
    return false;
  }
}

/** Indicador de UI (la credencial real vive en una cookie firmada del servidor). */
export function hasRegisteredBiometrics(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("tafinance_biometric_id");
}

/** Requiere sesión activa (PIN): crea la credencial y la vincula a este dispositivo en el servidor. */
export async function registerBiometricCredential(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "TAFINANCE", id: window.location.hostname },
        user: {
          id: new TextEncoder().encode("tafinance-owner"),
          name: "tafinance",
          displayName: "TAFINANCE",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;
    const response = credential.response as AuthenticatorAttestationResponse;
    const publicKey = response.getPublicKey?.();
    const alg = response.getPublicKeyAlgorithm?.();
    if (!publicKey || (alg !== -7 && alg !== -257)) {
      logger.error("auth", "El navegador no expone la clave pública de la credencial", { alg });
      return false;
    }

    const res = await fetch("/api/auth/biometric/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentialId: credential.id, publicKey: b64u(publicKey), alg }),
    });
    if (!res.ok) {
      logger.error("auth", "El servidor rechazó la credencial", res.status);
      return false;
    }
    localStorage.setItem("tafinance_biometric_id", credential.id);
    logger.info("auth", "Biometría vinculada a este dispositivo");
    return true;
  } catch (err) {
    logger.error("auth", "Error registrando credencial biométrica", err);
    return false;
  }
}

export async function authenticateWithBiometrics(): Promise<{ success: boolean; message?: string }> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { success: false, message: "Tu dispositivo no soporta biometría web" };
  }

  try {
    // 1. Desafío emitido por el servidor (ligado a la credencial de este dispositivo)
    const chalRes = await fetch("/api/auth/biometric/challenge", { cache: "no-store" });
    const chal = await chalRes.json().catch(() => ({}));
    if (!chalRes.ok) {
      localStorage.removeItem("tafinance_biometric_id");
      return { success: false, message: chal.error || "No hay huella vinculada en este dispositivo" };
    }

    // 2. Lectura biométrica real
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: fromB64u(chal.challenge),
        timeout: 60000,
        userVerification: "required",
        rpId: window.location.hostname,
        allowCredentials: [{ id: fromB64u(chal.credentialId), type: "public-key", transports: ["internal"] }],
      },
    })) as PublicKeyCredential | null;

    if (!assertion) return { success: false, message: "Lectura biométrica cancelada" };
    const r = assertion.response as AuthenticatorAssertionResponse;

    // 3. El servidor verifica la firma y emite la sesión
    const res = await fetch("/api/auth/biometric", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentialId: assertion.id,
        authenticatorData: b64u(r.authenticatorData),
        clientDataJSON: b64u(r.clientDataJSON),
        signature: b64u(r.signature),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) return { success: true };
    return { success: false, message: data.error || "Fallo en la verificación del servidor" };
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "AbortError") return { success: false, message: "Escaneo cancelado" };
    logger.error("auth", "Error al escanear biometría", err);
    return { success: false, message: "Error al escanear biometría" };
  }
}
