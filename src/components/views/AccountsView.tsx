"use client";

import React, { useMemo, useState } from "react";
import {
  CreditCard,
  Landmark,
  Banknote,
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  CalendarClock,
  Scissors,
  TrendingUp,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { Account, Transaction } from "@/types/finance";
import { financeStore } from "@/lib/storage/finance-store";
import { cardStatus } from "@/lib/finance/calc";
import { useApp } from "@/lib/context/AppContext";
import { Sheet, inputCls, labelCls } from "@/components/ui/Sheet";
import { GlassCard } from "@/components/ui/GlassCard";

interface AccountsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  onShowToast: (msg: string) => void;
}

const TYPE_META: Record<Account["type"], { label: string; icon: any; tone: string }> = {
  bank: { label: "Cuenta bancaria", icon: Landmark, tone: "text-sky2 bg-sky2/10 border-sky2/25" },
  cash: { label: "Efectivo", icon: Banknote, tone: "text-mint bg-mint/10 border-mint/25" },
  savings: { label: "Ahorros", icon: PiggyBank, tone: "text-teal-400 bg-teal-500/10 border-teal-500/25" },
  credit: { label: "Tarjeta de crédito", icon: CreditCard, tone: "text-violet-400 bg-violet-500/10 border-violet-500/25" },
};

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "—";

const daysText = (n: number | null) =>
  n === null ? "" : n === 0 ? "hoy" : n === 1 ? "mañana" : n < 0 ? `hace ${-n} d` : `en ${n} d`;

export function AccountsView({ accounts, transactions, onShowToast }: AccountsViewProps) {
  const { formatMoney } = useApp();
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [paying, setPaying] = useState<Account | null>(null);
  const [adjusting, setAdjusting] = useState<Account | null>(null);

  const available = accounts.filter((a) => a.type !== "credit").reduce((s, a) => s + a.balance, 0);
  const debt = accounts.filter((a) => a.type === "credit").reduce((s, a) => s + Math.max(0, -a.balance), 0);

  const statuses = useMemo(() => {
    const map = new Map<string, ReturnType<typeof cardStatus>>();
    accounts.filter((a) => a.type === "credit").forEach((a) => map.set(a.id, cardStatus(a, transactions)));
    return map;
  }, [accounts, transactions]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4">
          <p className="text-[11px] text-slate-400">Disponible en cuentas</p>
          <p className={`text-lg font-black tabular-nums ${available < 0 ? "text-rose-400" : "text-white"}`}>
            {formatMoney(available)}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[11px] text-slate-400">Deuda en tarjetas</p>
          <p className={`text-lg font-black tabular-nums ${debt > 0 ? "text-violet-400" : "text-white"}`}>
            {formatMoney(debt)}
          </p>
        </GlassCard>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cuentas y tarjetas</h3>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#494bd6] to-[#8083ff] text-on-accent text-xs font-semibold shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {accounts.map((a) => {
          const meta = TYPE_META[a.type];
          const Icon = meta.icon;
          const st = statuses.get(a.id);
          const isCard = a.type === "credit";
          return (
            <GlassCard key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${meta.tone}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{a.name}</p>
                    <p className="text-[11px] text-slate-400">{meta.label}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-base font-black tabular-nums ${a.balance < 0 ? "text-rose-400" : "text-white"}`}>
                    {formatMoney(isCard ? -a.balance : a.balance)}
                  </p>
                  {isCard && <p className="text-[10px] text-slate-400">{a.balance < 0 ? "deuda actual" : "saldo a favor"}</p>}
                </div>
              </div>

              {isCard && st && (
                <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2.5">
                  {(a.cutoff_day || a.due_day) ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-inset border border-white/[0.06]">
                        <p className="text-slate-400 flex items-center gap-1"><Scissors className="w-3 h-3" /> Próximo corte</p>
                        <p className="font-bold text-white mt-0.5">
                          {fmtDate(st.nextCutoff)} <span className="font-medium text-slate-400">{daysText(st.daysToCutoff)}</span>
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-inset border border-white/[0.06]">
                        <p className="text-slate-400 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Pagar antes del</p>
                        <p className={`font-bold mt-0.5 ${st.daysToDue !== null && st.daysToDue <= (a.remind_days_before ?? 1) ? "text-amber-400" : "text-white"}`}>
                          {fmtDate(st.nextDue)} <span className="font-medium text-slate-400">{daysText(st.daysToDue)}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-400">Configura el día de corte y de pago para activar los recordatorios.</p>
                  )}

                  {st.debt > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>Extracto cerrado: <b className="text-white">{formatMoney(st.billed)}</b></span>
                      <span>Por facturar: <b className="text-white">{formatMoney(st.unbilled)}</b></span>
                    </div>
                  )}

                  {st.floatYield > 0 && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                      <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        Pagando en la fecha límite, tus compras te dan ~<b>{st.avgFloatDays} días</b> de financiación. Con tu dinero
                        invertido al {a.annual_yield}% E.A. ganarías aprox. <b>{formatMoney(st.floatYield)}</b>.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                {isCard && a.balance < 0 && (
                  <button
                    onClick={() => setPaying(a)}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold active:scale-95 transition-transform"
                  >
                    Pagar tarjeta
                  </button>
                )}
                <button
                  onClick={() => setAdjusting(a)}
                  className="flex-1 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Ajustar saldo
                </button>
                <button
                  onClick={() => setEditing(a)}
                  aria-label={`Editar ${a.name}`}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <AccountForm
        key={editing === "new" ? "new" : editing?.id || "none"}
        open={editing !== null}
        account={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onToast={onShowToast}
        canDelete={accounts.length > 1}
      />
      <PayCardSheet
        card={paying}
        accounts={accounts}
        transactions={transactions}
        onClose={() => setPaying(null)}
        onToast={onShowToast}
      />
      <AdjustSheet account={adjusting} onClose={() => setAdjusting(null)} onToast={onShowToast} />
    </div>
  );
}

/* ------------------------------ formulario cuenta / tarjeta ------------------------------ */

function AccountForm({
  open,
  account,
  onClose,
  onToast,
  canDelete,
}: {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onToast: (m: string) => void;
  canDelete: boolean;
}) {
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState<Account["type"]>(account?.type || "bank");
  const [initial, setInitial] = useState("");
  const [cutoff, setCutoff] = useState(String(account?.cutoff_day || ""));
  const [due, setDue] = useState(String(account?.due_day || ""));
  const [yieldPct, setYieldPct] = useState(String(account?.annual_yield ?? 9));
  const [remind, setRemind] = useState(String(account?.remind_days_before ?? 1));
  const [busy, setBusy] = useState(false);
  const isCard = type === "credit";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const day = (v: string) => {
      const n = parseInt(v, 10);
      return n >= 1 && n <= 31 ? n : null;
    };
    setBusy(true);
    try {
      const extra = isCard
        ? {
            cutoff_day: day(cutoff),
            due_day: day(due),
            annual_yield: parseFloat(yieldPct) || 0,
            remind_days_before: Math.max(0, parseInt(remind, 10) || 0),
          }
        : { cutoff_day: null, due_day: null, annual_yield: null, remind_days_before: null };
      if (account) {
        await financeStore.updateAccount(account.id, { name: name.trim(), type, ...extra });
        onToast("Cuenta actualizada");
      } else {
        const init = parseFloat(initial.replace(/[^0-9.-]/g, "")) || 0;
        await financeStore.addAccount({
          name: name.trim(),
          type,
          currency: "COP",
          balance: isCard ? -Math.abs(init) : init,
          ...extra,
        });
        onToast(isCard ? "Tarjeta agregada" : "Cuenta agregada");
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!account) return;
    const ok = await financeStore.deleteAccount(account.id);
    onToast(ok ? "Cuenta eliminada" : "No se puede eliminar: tiene movimientos asociados");
    if (ok) onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={account ? "Editar cuenta" : "Nueva cuenta o tarjeta"}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TYPE_META) as Account["type"][]).map((t) => {
            const M = TYPE_META[t];
            const Icon = M.icon;
            return (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                  type === t ? "bg-indigo2/15 border-indigo2/50 text-white" : "bg-inset border-white/[0.06] text-slate-400"
                }`}
              >
                <Icon className="w-4 h-4" /> {M.label}
              </button>
            );
          })}
        </div>

        <div>
          <label className={labelCls}>Nombre</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={isCard ? "Ej. Visa Bancolombia" : "Ej. Nequi, Ahorros Bancolombia"} required />
        </div>

        {!account && (
          <div>
            <label className={labelCls}>{isCard ? "Deuda actual (opcional)" : "Saldo inicial (opcional)"}</label>
            <input className={inputCls} inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0" />
          </div>
        )}

        {isCard && (
          <div className="p-3.5 rounded-2xl bg-inset border border-white/[0.08] space-y-3">
            <p className="text-[11px] text-slate-400">
              Con estas fechas te avisamos del corte y del pago, y calculamos los días extra para que tu dinero rinda.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Día de corte</label>
                <input className={inputCls} inputMode="numeric" value={cutoff} onChange={(e) => setCutoff(e.target.value)} placeholder="Ej. 15" />
              </div>
              <div>
                <label className={labelCls}>Día límite de pago</label>
                <input className={inputCls} inputMode="numeric" value={due} onChange={(e) => setDue(e.target.value)} placeholder="Ej. 2" />
              </div>
              <div>
                <label className={labelCls}>Avisar (días antes)</label>
                <input className={inputCls} inputMode="numeric" value={remind} onChange={(e) => setRemind(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Tu rentabilidad E.A. %</label>
                <input className={inputCls} inputMode="decimal" value={yieldPct} onChange={(e) => setYieldPct(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Check className="w-4 h-4 stroke-[3]" /> Guardar
        </button>
        {account && canDelete && (
          <button type="button" onClick={remove} className="w-full py-2.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 flex items-center justify-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar cuenta
          </button>
        )}
      </form>
    </Sheet>
  );
}

/* ------------------------------ pagar tarjeta ------------------------------ */

function PayCardSheet({
  card,
  accounts,
  transactions,
  onClose,
  onToast,
}: {
  card: Account | null;
  accounts: Account[];
  transactions: Transaction[];
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const { formatMoney } = useApp();
  const sources = accounts.filter((a) => a.type !== "credit");
  const [from, setFrom] = useState("");
  const [amount, setAmount] = useState("");
  const st = card ? cardStatus(card, transactions) : null;

  React.useEffect(() => {
    if (card && st) {
      setFrom(sources.find((s) => s.balance > 0)?.id || sources[0]?.id || "");
      setAmount(String(Math.round(st.billed > 0 ? st.billed : st.debt)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;
    const n = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!n || !from) return;
    const tx = await financeStore.transferBetweenAccounts(from, card.id, n, `Pago de tarjeta ${card.name}`);
    onToast(tx ? `Pago de ${formatMoney(n)} registrado` : "No se pudo registrar el pago");
    if (tx) onClose();
  };

  return (
    <Sheet open={!!card} onClose={onClose} title={`Pagar ${card?.name || ""}`}>
      {card && st && (
        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button type="button" onClick={() => setAmount(String(Math.round(st.billed || st.debt)))} className="p-2.5 rounded-xl bg-inset border border-white/[0.06] text-left">
              <span className="text-slate-400 block">Extracto cerrado</span>
              <b className="text-white">{formatMoney(st.billed)}</b>
            </button>
            <button type="button" onClick={() => setAmount(String(Math.round(st.debt)))} className="p-2.5 rounded-xl bg-inset border border-white/[0.06] text-left">
              <span className="text-slate-400 block">Deuda total</span>
              <b className="text-white">{formatMoney(st.debt)}</b>
            </button>
          </div>
          <div>
            <label className={labelCls}>Pagar desde</label>
            <select className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)}>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {formatMoney(s.balance)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Monto</label>
            <input className={inputCls} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <button type="submit" className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold">
            Registrar pago
          </button>
        </form>
      )}
    </Sheet>
  );
}

/* ------------------------------ ajustar saldo ------------------------------ */

function AdjustSheet({ account, onClose, onToast }: { account: Account | null; onClose: () => void; onToast: (m: string) => void }) {
  const [value, setValue] = useState("");
  React.useEffect(() => {
    if (account) setValue(String(account.type === "credit" ? Math.max(0, -account.balance) : account.balance));
  }, [account]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    const n = parseFloat(value.replace(/[^0-9.-]/g, ""));
    if (isNaN(n)) return;
    const target = account.type === "credit" ? -Math.abs(n) : n;
    await financeStore.adjustBalance(account.id, target);
    onToast("Saldo ajustado");
    onClose();
  };

  return (
    <Sheet open={!!account} onClose={onClose} title={`Ajustar saldo · ${account?.name || ""}`}>
      <form onSubmit={submit} className="space-y-3.5">
        <p className="text-[11px] text-slate-400">
          Se registra un movimiento de ajuste por la diferencia, así el historial siempre cuadra con el saldo real.
        </p>
        <div>
          <label className={labelCls}>{account?.type === "credit" ? "Deuda real actual" : "Saldo real actual"}</label>
          <input className={inputCls} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </div>
        <button type="submit" className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold">
          Aplicar ajuste
        </button>
      </form>
    </Sheet>
  );
}
