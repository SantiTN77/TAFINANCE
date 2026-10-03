// WebAuthn Passkeys & Hardware Biometric Sensor Authentication

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }
  try {
    return (
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) ||
      false
    );
  } catch {
    return false;
  }
}

export function hasRegisteredBiometrics(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("tafinance_biometric_id");
}

export async function registerBiometricCredential(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "TAFINANCE Vault",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode("tafinance-owner-primary"),
          name: "propietario@tafinance.app",
          displayName: "Propietario TAFINANCE",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Native Android Fingerprint / iOS TouchID / FaceID
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential;

    if (!credential) return false;

    const rawIdB64 = btoa(
      String.fromCharCode(...new Uint8Array(credential.rawId))
    );

    localStorage.setItem("tafinance_biometric_id", credential.id);
    localStorage.setItem("tafinance_biometric_raw", rawIdB64);
    return true;
  } catch (err) {
    console.error("Error registrando credencial biométrica:", err);
    return false;
  }
}

export async function authenticateWithBiometrics(): Promise<{
  success: boolean;
  message?: string;
}> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { success: false, message: "Tu dispositivo no soporta biometría web" };
  }

  const storedId = localStorage.getItem("tafinance_biometric_id");
  const storedRaw = localStorage.getItem("tafinance_biometric_raw");

  if (!storedId) {
    return {
      success: false,
      message: "No has configurado tu huella aún. Ingresa con tu PIN para activarla.",
    };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    let allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (storedRaw) {
      try {
        const rawBytes = Uint8Array.from(atob(storedRaw), (c) =>
          c.charCodeAt(0)
        );
        allowCredentials = [
          {
            id: rawBytes,
            type: "public-key",
            transports: ["internal"],
          },
        ];
      } catch {}
    }

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required", // Hardware biometric trigger (Fingerprint / FaceID)
        allowCredentials,
        rpId: window.location.hostname,
      },
    })) as PublicKeyCredential;

    if (!assertion || !assertion.id) {
      return { success: false, message: "Lectura biométrica cancelada o fallida" };
    }

    // Exchange valid hardware assertion for session cookie
    const res = await fetch("/api/auth/biometric", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentialId: assertion.id }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true };
    }

    return {
      success: false,
      message: data.error || "Fallo en la verificación del servidor",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("NotAllowedError") || errorMsg.includes("canceled")) {
      return { success: false, message: "Escaneo cancelado" };
    }
    return { success: false, message: "Error al escanear biometría" };
  }
}
