"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Lock, Delete, Sparkles, CheckCircle2, Fingerprint } from "lucide-react";

function LockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [shake, setShake] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const PIN_LENGTH = 4;

  const triggerHaptic = (duration: number | number[] = 40) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  };

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length < PIN_LENGTH && !loading && !unlocked) {
        triggerHaptic(20);
        setError(null);
        setPin((prev) => prev + digit);
      }
    },
    [pin, loading, unlocked]
  );

  const handleDelete = useCallback(() => {
    if (pin.length > 0 && !loading && !unlocked) {
      triggerHaptic(15);
      setError(null);
      setPin((prev) => prev.slice(0, -1));
    }
  }, [pin, loading, unlocked]);

  // Submit PIN when reaching length
  const submitPin = useCallback(
    async (codeToSubmit: string) => {
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
          triggerHaptic([30, 50, 30]);
          setUnlocked(true);
          setTimeout(() => {
            router.push(redirectPath);
            router.refresh();
          }, 400);
        } else {
          triggerHaptic([100, 50, 100]);
          setShake(true);
          setError(data.error || "PIN incorrecto");
          setTimeout(() => {
            setShake(false);
            setPin("");
          }, 450);
        }
      } catch (err) {
        setError("Error de red conectando a la bóveda");
        setPin("");
      } finally {
        setLoading(false);
      }
    },
    [redirectPath, remember, router]
  );

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      submitPin(pin);
    }
  }, [pin, submitPin]);

  // Physical keyboard support
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

      {/* Top Section */}
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

      {/* Center Section: Lock icon & PIN dots */}
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
            ) : (
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            )}
          </div>
          <div className="absolute -inset-1 bg-emerald-500/20 rounded-2xl blur-sm -z-10" />
        </motion.div>

        <h1 className="text-xl font-bold tracking-tight text-white mb-1.5 text-center">
          Bóveda Privada
        </h1>
        <p className="text-xs text-slate-400 text-center max-w-[240px] mb-7">
          Introduce tu PIN maestro para acceder a tu contabilidad personal
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

        {/* Status / Error Message */}
        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.span
                key="err"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-400 font-medium"
              >
                {error}
              </motion.span>
            ) : loading ? (
              <motion.span
                key="load"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-emerald-400 font-medium flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 animate-spin" /> Verificando...
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
              whileTap={{ scale: 0.9, backgroundColor: "rgba(255,255,255,0.15)" }}
              onClick={() => handleDigit(num)}
              className="h-16 rounded-full bg-white/[0.04] active:bg-white/[0.12] border border-white/[0.06] flex items-center justify-center text-2xl font-light text-white shadow-sm transition-colors"
            >
              {num}
            </motion.button>
          ))}

          {/* Biometric / Quick fill default */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleDigit("7")}
            title="Sugerencia rápida"
            className="h-16 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Fingerprint className="w-6 h-6 text-slate-500" />
          </motion.button>

          {/* 0 Key */}
          <motion.button
            whileTap={{ scale: 0.9, backgroundColor: "rgba(255,255,255,0.15)" }}
            onClick={() => handleDigit("0")}
            className="h-16 rounded-full bg-white/[0.04] active:bg-white/[0.12] border border-white/[0.06] flex items-center justify-center text-2xl font-light text-white shadow-sm transition-colors"
          >
            0
          </motion.button>

          {/* Backspace Key */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleDelete}
            className="h-16 rounded-full flex items-center justify-center text-slate-400 active:text-white transition-colors"
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

        {/* Default PIN note */}
        <div className="mt-4 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400 leading-tight">
            🔒 PIN por defecto: <strong className="text-emerald-400 font-mono">7777</strong>
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Puedes cambiarlo en Vercel con la variable <code className="text-slate-400">TAFINANCE_PIN</code>
          </p>
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
