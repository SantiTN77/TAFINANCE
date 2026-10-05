"use client";

import React, { useState } from "react";
import {
  Wallet,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Shield,
  Sparkles,
  Plane,
  Home,
  Laptop,
  Heart,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { Pocket } from "@/types/finance";
import { useApp } from "@/lib/context/AppContext";
import { parseAmount } from "@/lib/finance/calc";

interface PocketsViewProps {
  pockets: Pocket[];
  onAddPocket: (p: Omit<Pocket, "id" | "created_at">) => Promise<void>;
  onDeletePocket: (id: string) => Promise<void>;
  onTransferToPocket: (pocketId: string, amount: number) => Promise<boolean>;
  onShowToast: (msg: string) => void;
}

export const PocketsView: React.FC<PocketsViewProps> = ({
  pockets,
  onAddPocket,
  onDeletePocket,
  onTransferToPocket,
  onShowToast,
}) => {
  const { t, formatMoney } = useApp();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedPocketForTransfer, setSelectedPocketForTransfer] = useState<Pocket | null>(null);
  const [transferAmount, setTransferAmount] = useState("");

  // New Pocket Form State
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [category, setCategory] = useState("Ahorro");
  const [color, setColor] = useState("#4cd7f6");

  const [autoPilot, setAutoPilot] = useState(true);

  const handleCreatePocket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount) return;

    await onAddPocket({
      name,
      target_amount: parseAmount(targetAmount) || 0,
      current_amount: 0,
      category,
      color,
      icon: "Wallet",
    });

    onShowToast(`Bolsillo "${name}" creado exitosamente`);
    setName("");
    setTargetAmount("");
    setIsNewModalOpen(false);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPocketForTransfer || !transferAmount) return;

    const amountNum = parseAmount(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const success = await onTransferToPocket(selectedPocketForTransfer.id, amountNum);
    if (success) {
      onShowToast(`Se transfirieron ${formatMoney(amountNum)} a ${selectedPocketForTransfer.name}`);
      setSelectedPocketForTransfer(null);
      setTransferAmount("");
    } else {
      onShowToast("Fondos insuficientes o error en la cuenta");
    }
  };

  const totalSaved = pockets.reduce((sum, p) => sum + Number(p.current_amount), 0);
  const totalTarget = pockets.reduce((sum, p) => sum + Number(p.target_amount), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-card border border-white/[0.06] p-5 shadow-xl">
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#4cd7f6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#4cd7f6]/15 text-sky2 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">
                  {t("pocketsTitle")}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {t("pocketsSubtitle")}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#494bd6] to-[#8083ff] text-on-accent text-xs font-semibold shadow-md active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("newPocketBtn")}</span>
            </button>
          </div>

          {/* Consolidated Pockets Progress */}
          <div className="flex items-baseline justify-between pt-2">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400">Total en Bolsillos</span>
              <span className="text-2xl font-black text-white tabular-nums tracking-tight">
                {formatMoney(totalSaved)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[11px] text-slate-400">Objetivo Global</span>
              <span className="text-xs font-bold text-slate-300 tabular-nums">
                {formatMoney(totalTarget)}
              </span>
            </div>
          </div>

          <div className="w-full bg-inset h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8083ff] to-[#4cd7f6] rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
            />
          </div>

          {/* Auto-Pilot Toggle */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-mint" />
              {t("autoPilotLabel")}
            </span>
            <button
              onClick={() => {
                const next = !autoPilot;
                setAutoPilot(next);
                onShowToast(next ? "Piloto automático activado" : "Piloto automático pausado");
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                autoPilot
                  ? "bg-[#4edea3]/15 text-mint border border-[#4edea3]/30"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {autoPilot ? t("autoPilotOn") : t("autoPilotOff")}
            </button>
          </div>
        </div>
      </section>

      {/* Pockets List */}
      {pockets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-card/60 border border-white/[0.04] text-center my-4">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-400 mb-3">
            <Wallet className="w-6 h-6 text-sky2" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            Empieza a ahorrar con Bolsillos
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mb-5">
            {t("noPocketsYet")}
          </p>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#494bd6] to-[#8083ff] text-on-accent text-xs font-bold shadow-lg hover:opacity-95 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Crear mi primer bolsillo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {pockets.map((pkt) => {
            const progress =
              pkt.target_amount > 0
                ? Math.min(100, (pkt.current_amount / pkt.target_amount) * 100)
                : 0;

            return (
              <div
                key={pkt.id}
                className="relative overflow-hidden rounded-2xl bg-card border border-white/[0.06] p-4 flex flex-col justify-between gap-3 shadow-lg hover:border-white/[0.12] transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: `${pkt.color}25`, borderColor: `${pkt.color}50` }}
                    >
                      <Wallet className="w-5 h-5" style={{ color: pkt.color }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{pkt.name}</h4>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {pkt.category}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeletePocket(pkt.id)}
                    title="Eliminar bolsillo"
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Amounts & Progress */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-black text-white tabular-nums tracking-tight">
                      {formatMoney(pkt.current_amount)}
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      de {formatMoney(pkt.target_amount)}
                    </span>
                  </div>

                  <div className="w-full bg-inset h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: pkt.color || "#4cd7f6",
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>{progress.toFixed(0)}% financiado</span>
                    <span>Resta {formatMoney(Math.max(0, pkt.target_amount - pkt.current_amount))}</span>
                  </div>
                </div>

                {/* Quick Action Button */}
                <button
                  onClick={() => setSelectedPocketForTransfer(pkt)}
                  className="w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white border border-white/[0.06] flex items-center justify-center gap-1.5 transition-colors active:scale-98"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-sky2" />
                  <span>Aportar Fondos</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Create New Pocket */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-white/[0.1] p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Nuevo Bolsillo de Ahorro</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePocket} className="flex flex-col gap-3.5">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre de la Meta</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Fondo de Emergencia, Vacaciones..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-inset border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#8083ff]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Monto Objetivo (Meta)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="Ej. 1.000.000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full rounded-xl bg-inset border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#8083ff]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl bg-inset border border-white/[0.08] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#8083ff]"
                >
                  <option value="Ahorro">Ahorro General</option>
                  <option value="Emergencia">Fondo de Emergencia</option>
                  <option value="Viajes">Viajes & Vacaciones</option>
                  <option value="Inversión">Inversión</option>
                  <option value="Tecnología">Tecnología & Caprichos</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Color del Bolsillo</label>
                <div className="flex items-center gap-2">
                  {["#4cd7f6", "#8083ff", "#4edea3", "#f59e0b", "#ec4899"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        color === c ? "scale-125 ring-2 ring-white" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#494bd6] to-[#8083ff] text-xs font-bold text-on-accent shadow-md active:scale-95 transition-all"
                >
                  Guardar Bolsillo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Deposit Funds to Pocket */}
      {selectedPocketForTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-white/[0.1] p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Aportar a: {selectedPocketForTransfer.name}
              </h3>
              <button
                onClick={() => setSelectedPocketForTransfer(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="flex flex-col gap-3.5">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Monto a Aportar</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  required
                  placeholder="Ej. 50.000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full rounded-xl bg-inset border border-white/[0.08] px-3.5 py-2.5 text-base text-white placeholder-slate-500 focus:outline-none focus:border-[#4cd7f6]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPocketForTransfer(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#03b5d3] to-[#4cd7f6] text-xs font-bold text-black shadow-md active:scale-95 transition-all"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
