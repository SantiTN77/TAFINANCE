"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Delete,
  Sparkles,
  CheckCircle2,
  Fingerprint,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  isBiometricSupported,
  hasRegisteredBiometrics,
  authenticateWithBiometrics,
} from "@/lib/auth/webauthn";

function LockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [shake, setShake] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);

  // Rate Limiting & Lockout
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const PIN_LENGTH = 4;

  const triggerHaptic = (duration: number | number[] = 40) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  };

  // Check biometric support and lockout status on mount
  useEffect(() => {
    isBiometricSupported().then(setBiometricAvailable);
    setHasBiometric(hasRegisteredBiometrics());

    const lockoutUntil = localStorage.getItem("tafinance_lockout_until");
    if (lockoutUntil) {
      const remaining = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutSeconds(remaining);
      } else {
        localStorage.removeItem("tafinance_lockout_until");
      }
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          localStorage.removeItem("tafinance_lockout_until");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (lockoutSeconds > 0) return;
      if (pin.length < PIN_LENGTH && !loading && !unlocked && !biometricLoading) {
        triggerHaptic(20);
        setError(null);
        setPin((prev) => prev + digit);
      }
    },
    [pin, loading, unlocked, biometricLoading, lockoutSeconds]
  );

  const handleDelete = useCallback(() => {
    if (lockoutSeconds > 0) return;
    if (pin.length > 0 && !loading && !unlocked && !biometricLoading) {
      triggerHaptic(15);
      setError(null);
      setPin((prev) => prev.slice(0, -1));
    }
  }, [pin, loading, unlocked, biometricLoading, lockoutSeconds]);

  // Submit PIN when reaching PIN_LENGTH
  const submitPin = useCallback(
    async (codeToSubmit: string) => {
      if (lockoutSeconds > 0) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: codeToSubmit, remember }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          localStorage.removeItem("tafinance_failed_attempts");
          triggerHaptic([30, 50, 30]);
          setUnlocked(true);
          setTimeout(() => {
            router.push(redirectPath);
            router.refresh();
          }, 350);
        } else {
          // Increment failed attempts
          const currentFails =
            parseInt(localStorage.getItem("tafinance_failed_attempts") || "0", 10) + 1;
          localStorage.setItem("tafinance_failed_attempts", currentFails.toString());

          if (currentFails >= 5) {
            const lockoutTime = Date.now() + 60 * 1000;
            localStorage.setItem("tafinance_lockout_until", lockoutTime.toString());
            setLockoutSeconds(60);
            localStorage.removeItem("tafinance_failed_attempts");
            setError("Bóveda bloqueada por 60 segundos por múltiples intentos");
          } else {
            setError(
              `${data.error || "PIN incorrecto"} (${5 - currentFails} intentos restantes)`
            );
          }

          triggerHaptic([100, 50, 100]);
          setShake(true);
          setTimeout(() => {
            setShake(false);
            setPin("");
          }, 450);
        }
      } catch {
        setError("Error de red conectando con la bóveda");
        setPin("");
      } finally {
        setLoading(false);
      }
    },
    [redirectPath, remember, router, lockoutSeconds]
  );

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      submitPin(pin);
    }
  }, [pin, submitPin]);

  // Real Hardware Biometric Trigger (Android Fingerprint / iOS TouchID / FaceID)
  const handleBiometricAuth = async () => {
    if (lockoutSeconds > 0) return;
    if (!hasBiometric) {
      setError("Primero desbloquea con tu PIN para registrar tu huella");
      return;
    }

    setBiometricLoading(true);
    setError(null);
    try {
      const result = await authenticateWithBiometrics();
      if (result.success) {
        triggerHaptic([30, 60, 30]);
        setUnlocked(true);
        setTimeout(() => {
          router.push(redirectPath);
          router.refresh();
        }, 350);
      } else {
        triggerHaptic([80, 80]);
        if (result.message) {
          setError(result.message);
        }
      }
    } catch {
      setError("Error durante la lectura biométrica");
    } finally {
      setBiometricLoading(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigit, handleDelete]);

  return (
    <div className="min-h-screen bg-[#070A11] text-white flex flex-col items-center justify-between p-6 select-none overflow-hidden relative">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-sm flex items-center justify-between pt-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-xs font-semibold tracking-wider text-slate-300">
            TAFINANCE VAULT
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
          E2E ENCRYPTED
        </span>
      </header>

      {/* Center Section: Lock status & PIN dots */}
      <div className="flex flex-col items-center justify-center max-w-sm w-full my-auto">
        <motion.div
          animate={
            unlocked
              ? { scale: [1, 1.15, 1], rotate: [0, 5, 0] }
              : { scale: 1 }
          }
          className="relative mb-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 border border-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex items-center justify-center">
            {unlocked ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-in zoom-in" />
            ) : lockoutSeconds > 0 ? (
              <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            )}
          </div>
          <div className="absolute -inset-1 bg-emerald-500/20 rounded-2xl blur-sm -z-10" />
        </motion.div>

        <h1 className="text-xl font-bold tracking-tight text-white mb-1.5 text-center">
          {lockoutSeconds > 0 ? "Bóveda en Enfriamiento" : "Bóveda Privada"}
        </h1>
        <p className="text-xs text-slate-400 text-center max-w-[250px] mb-7">
          {lockoutSeconds > 0
            ? `Demasiados intentos fallidos. Reintenta en ${lockoutSeconds} segundos.`
            : "Introduce tu PIN maestro o usa tu sensor biométrico"}
        </p>

        {/* PIN Indicators */}
        <motion.div
          animate={shake ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4 mb-6"
        >
          {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
            const filled = pin.length > idx;
            return (
              <motion.div
                key={idx}
                animate={{
                  scale: filled ? [1, 1.25, 1] : 1,
                  backgroundColor: error
                    ? "#ef4444"
                    : filled
                    ? "#10b981"
                    : "rgba(255, 255, 255, 0.08)",
                }}
                transition={{ duration: 0.15 }}
                className={`w-3.5 h-3.5 rounded-full border ${
                  error
                    ? "border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                    : filled
                    ? "border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    : "border-white/10"
                }`}
              />
            );
          })}
        </motion.div>

        {/* Status / Error message */}
        <div className="min-h-6 flex items-center justify-center px-4 text-center">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.span
                key="err"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-400 font-medium flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </motion.span>
            ) : loading || biometricLoading ? (
              <motion.span
                key="load"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-emerald-400 font-medium flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 animate-spin" />{" "}
                {biometricLoading ? "Escaneando sensor biométrico..." : "Verificando..."}
              </motion.span>
            ) : unlocked ? (
              <motion.span
                key="ok"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-emerald-400 font-medium"
              >
                Acceso Concedido
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Section: Numeric Keypad (iOS Style) */}
      <div className="w-full max-w-[280px] pb-6">
        <div className="grid grid-cols-3 gap-3.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <motion.button
              key={num}
              disabled={lockoutSeconds > 0}
              whileTap={{ scale: 0.9, backgroundColor: "rgba(255,255,255,0.15)" }}
              onClick={() => handleDigit(num)}
              className="h-16 rounded-full bg-white/[0.04] active:bg-white/[0.12] border border-white/[0.06] flex items-center justify-center text-2xl font-light text-white shadow-sm transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              {num}
            </motion.button>
          ))}

          {/* Real Native Biometric Trigger (Fingerprint / FaceID) */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            disabled={lockoutSeconds > 0 || biometricLoading}
            onClick={handleBiometricAuth}
            title="Desbloquear con Huella o FaceID"
            className={`h-16 rounded-full flex flex-col items-center justify-center transition-all ${
              hasBiometric
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "bg-white/[0.02] border border-white/[0.04] text-slate-500 hover:text-slate-400"
            }`}
          >
            <Fingerprint className={`w-7 h-7 ${hasBiometric ? "text-emerald-400" : "text-slate-500"}`} />
            {hasBiometric && (
              <span className="text-[9px] font-medium tracking-tight text-emerald-300 mt-0.5">
                Huella
              </span>
            )}
          </motion.button>

          {/* 0 Key */}
          <motion.button
            disabled={lockoutSeconds > 0}
            whileTap={{ scale: 0.9, backgroundColor: "rgba(255,255,255,0.15)" }}
            onClick={() => handleDigit("0")}
            className="h-16 rounded-full bg-white/[0.04] active:bg-white/[0.12] border border-white/[0.06] flex items-center justify-center text-2xl font-light text-white shadow-sm transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            0
          </motion.button>

          {/* Backspace Key */}
          <motion.button
            disabled={lockoutSeconds > 0}
            whileTap={{ scale: 0.9 }}
            onClick={handleDelete}
            className="h-16 rounded-full flex items-center justify-center text-slate-400 active:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <Delete className="w-6 h-6" />
          </motion.button>
        </div>

        {/* Remember device toggle */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500/20"
            />
            <span>Mantener sesión iniciada en este móvil</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default function LockPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070A11] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
        </div>
      }
    >
      <LockContent />
    </Suspense>
  );
}
