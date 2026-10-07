"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";

const MIN_PASSWORD = 12;
const card = "flex flex-col gap-3 rounded-2xl bg-card border border-white/[0.06] p-5 shadow-xl";
const input =
  "w-full rounded-lg bg-inset border border-white/[0.08] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60";

/** Cuenta: correo, acceso al panel admin (solo rol admin) y cambio de contraseña. */
export function AccountSection({ onShowToast }: { onShowToast: (msg: string) => void }) {
  const [me, setMe] = useState<{ email?: string; role?: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (!me) return null;

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Mínimo ${MIN_PASSWORD} caracteres`);
    if (password !== confirm) return setError("Las contraseñas no coinciden");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error || "No se pudo cambiar la contraseña");
      setPassword("");
      setConfirm("");
      onShowToast("Contraseña actualizada. Vuelve a iniciar sesión con ella para entrar al panel admin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={card}>
      <span className="text-xs font-bold text-mint uppercase tracking-wider">Cuenta</span>
      <span className="text-[11px] text-slate-400 break-all">{me.email}</span>

      {me.role === "admin" && (
        <a
          href="/admin"
          className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-mint flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Panel de administración</span>
        </a>
      )}

      <form onSubmit={change} className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-mint" /> Cambiar contraseña
        </span>
        <input type="password" autoComplete="new-password" placeholder="Nueva contraseña (mín. 12)" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        <input type="password" autoComplete="new-password" placeholder="Repite la contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
        {error && (
          <p role="alert" className="text-[11px] text-rose-400">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !password} className="py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs font-semibold text-white disabled:opacity-50">
          {busy ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </section>
  );
}
