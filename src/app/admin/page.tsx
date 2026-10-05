"use client";

import React, { useCallback, useEffect, useState } from "react";

interface AdminUser {
  user_id: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "disabled" | "pending";
  created_at: string;
  accounts: number;
  transactions: number;
  pockets: number;
  last_activity: string | null;
}

const STATUS_STYLE: Record<AdminUser["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  disabled: "bg-red-500/15 text-red-400 border-red-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

/**
 * Panel de administración de usuarios. Gestiona CUENTAS (alta, estado, rol, contraseña, borrado);
 * nunca muestra datos financieros: solo conteos. El servidor exige rol admin + sesión con contraseña.
 */
export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [me, setMe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "user" });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUsers(null);
      setError(body.error || `Error ${res.status}`);
      return;
    }
    setError(null);
    setUsers(body.users);
    setMe(body.me);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const call = async (url: string, method: string, payload: object, okMsg: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setNotice(`✗ ${body.error || res.status}`);
      else {
        setNotice(`✓ ${okMsg}`);
        await load();
      }
      return res.ok;
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call("/api/admin/users", "POST", form, `Usuario ${form.email} creado`)) {
      setForm({ email: "", password: "", role: "user" });
    }
  };

  const resetPassword = (u: AdminUser) => {
    const password = window.prompt(`Nueva contraseña para ${u.email} (mín. 12 caracteres):`);
    if (password) void call(`/api/admin/users/${u.user_id}`, "PATCH", { password }, "Contraseña restablecida");
  };

  const remove = (u: AdminUser) => {
    const confirmEmail = window.prompt(
      `Esto borra la cuenta y TODOS sus datos. Escribe el correo (${u.email}) para confirmar:`
    );
    if (confirmEmail) void call(`/api/admin/users/${u.user_id}`, "DELETE", { confirmEmail }, "Usuario borrado");
  };

  const input = "rounded-lg bg-inset border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500";
  const btn = "rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-500/60 disabled:opacity-50";

  return (
    <main className="min-h-screen bg-app text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Administración de usuarios</h1>
          <a href="/app" className="text-xs text-slate-400 underline underline-offset-4">
            Volver a la app
          </a>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}{" "}
            <a href="/lock" className="underline">
              Iniciar sesión con contraseña
            </a>
          </div>
        )}
        {notice && <p role="status" className="text-sm text-slate-300">{notice}</p>}

        {users && (
          <>
            <form onSubmit={create} className="rounded-xl bg-card border border-slate-800 p-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input className={input} type="email" placeholder="correo" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className={input} type="password" placeholder="contraseña (mín. 12)" required minLength={12} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">Usuario</option>
                <option value="admin">Admin</option>
              </select>
              <button disabled={busy} className="rounded-lg bg-emerald-500 text-on-accent font-semibold px-4 py-2 text-sm disabled:opacity-60">
                Crear
              </button>
            </form>

            <div className="rounded-xl bg-card border border-slate-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-400">
                  <tr>
                    <th className="p-3">Usuario</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Uso</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const self = u.user_id === me;
                    return (
                      <tr key={u.user_id} className="border-t border-slate-800 align-top">
                        <td className="p-3">
                          <div className="font-medium">{u.email}{self && <span className="text-slate-500"> (tú)</span>}</div>
                          <div className="text-xs text-slate-500">{u.role === "admin" ? "Admin" : "Usuario"} · alta {new Date(u.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[u.status]}`}>{u.status}</span>
                        </td>
                        <td className="p-3 text-xs text-slate-400">
                          {u.accounts} cuentas · {u.transactions} mov. · {u.pockets} bolsillos
                          <div>{u.last_activity ? `activo ${new Date(u.last_activity).toLocaleDateString()}` : "sin actividad"}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {!self && (
                              <>
                                <button disabled={busy} className={btn} onClick={() => call(`/api/admin/users/${u.user_id}`, "PATCH", { status: u.status === "active" ? "disabled" : "active" }, u.status === "active" ? "Usuario deshabilitado" : "Usuario activado")}>
                                  {u.status === "active" ? "Deshabilitar" : "Activar"}
                                </button>
                                <button disabled={busy} className={btn} onClick={() => call(`/api/admin/users/${u.user_id}`, "PATCH", { role: u.role === "admin" ? "user" : "admin" }, "Rol actualizado")}>
                                  {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
                                </button>
                              </>
                            )}
                            <button disabled={busy} className={btn} onClick={() => resetPassword(u)}>Contraseña</button>
                            {!self && (
                              <button disabled={busy} className={`${btn} text-red-300`} onClick={() => remove(u)}>Borrar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
