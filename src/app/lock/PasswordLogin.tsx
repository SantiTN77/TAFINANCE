"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

/** Acceso con correo y contraseña (Supabase Auth). El PIN queda como desbloqueo rápido del dueño. */
export function PasswordLogin({ onUsePin }: { onUsePin: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  // Solo rutas internas: evita redirecciones abiertas
  const rawRedirect = params.get("redirect") || "/app";
  const redirectPath = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        router.push(redirectPath);
        router.refresh();
        return;
      }
      setError(data.error || "No se pudo iniciar sesión");
      setPassword("");
    } catch {
      setError("Error de red conectando con la bóveda");
    } finally {
      setLoading(false);
    }
  };

  const input =
    "w-full rounded-xl bg-inset border border-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60";

  return (
    <div className="min-h-screen bg-app text-white flex flex-col items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-xs font-semibold tracking-wider text-slate-300">TAFINANCE</span>
        </div>
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>
        <input
          type="email"
          autoComplete="username"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={input}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={input}
        />
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-500 text-on-accent font-semibold py-3 disabled:opacity-60"
        >
          {loading ? "Verificando…" : "Entrar"}
        </button>
        <button type="button" onClick={onUsePin} className="block mx-auto text-xs text-slate-400 hover:text-emerald-400 underline underline-offset-4">
          Desbloqueo rápido del dueño (PIN / huella)
        </button>
      </form>
    </div>
  );
}
