"use client";

import React, { useState, useRef } from "react";
import {
  Camera,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  Tag,
  Check,
  Building2,
  AlertCircle,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { Pocket } from "@/types/finance";
import { useApp } from "@/lib/context/AppContext";
import { financeStore } from "@/lib/storage/finance-store";
import { matchCategory, todayStr } from "@/lib/finance/calc";

interface ScanItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  pocketName: string;
}

interface ScanViewProps {
  pockets: Pocket[];
  onReceiptProcessed: () => void;
  onShowToast: (msg: string) => void;
}

export const ScanView: React.FC<ScanViewProps> = ({
  pockets,
  onReceiptProcessed,
  onShowToast,
}) => {
  const { t, formatMoney } = useApp();

  const [scanMode, setScanMode] = useState<"camera" | "upload">("camera");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extracted Result
  const [merchant, setMerchant] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [total, setTotal] = useState<number>(0);
  const [category, setCategory] = useState<string>("Alimentación");
  const [items, setItems] = useState<ScanItem[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      processImage(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string, mimeType: string) => {
    setIsScanning(true);
    setErrorMsg(null);
    setIsConfirmed(false);

    try {
      const response = await fetch("/api/ocr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      });

      if (!response.ok) {
        throw new Error("No se pudo escanear el recibo con la IA.");
      }

      const data = await response.json();
      setMerchant(data.merchant || "Comercio no detectado");
      setDate(data.date || todayStr());
      setTotal(Number(data.total) || 0);
      setCategory(data.category || "Alimentación");

      const defaultPocketName = pockets[0]?.name || "General";
      const parsedItems: ScanItem[] = (data.items || []).map(
        (it: any, idx: number) => ({
          id: `item-${idx}`,
          name: it.name || `Ítem #${idx + 1}`,
          price: Number(it.price) || 0,
          quantity: it.quantity || 1,
          pocketName: defaultPocketName,
        })
      );
      setItems(parsedItems);
      onShowToast(`Factura escaneada: ${data.merchant} por ${formatMoney(data.total)}`);
    } catch (err: any) {
      console.error("Error OCR:", err);
      setErrorMsg(err.message || "Error procesando el recibo");
    } finally {
      setIsScanning(false);
    }
  };

  const handlePocketChange = (itemId: string, newPocketName: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, pocketName: newPocketName } : item
      )
    );
  };

  const handleConfirmAndSave = async () => {
    if (!merchant || total <= 0) return;
    setIsSaving(true);
    try {
      const categories = await financeStore.getCategories();
      const accounts = await financeStore.getAccounts();
      const matchedCat = matchCategory(categories, category, "EXPENSE", `${merchant} ${items.map((i) => i.name).join(" ")}`);
      const matchedAcc = accounts.find((a) => a.type !== "credit") || accounts[0];

      // Una transacción por bolsillo (el bolsillo paga hasta su saldo; el saldo se deriva del historial)
      // y otra por lo no asignado (impuestos, propinas, ítems sin bolsillo).
      const byPocket = new Map<string, number>();
      for (const item of items) {
        const targetPocket = pockets.find((p) => p.name === item.pocketName);
        if (targetPocket && item.price > 0) byPocket.set(targetPocket.id, (byPocket.get(targetPocket.id) || 0) + item.price);
      }
      let assigned = 0;
      const base = {
        account_id: matchedAcc?.id,
        category_id: matchedCat?.id,
        type: "EXPENSE" as const,
        currency: "COP",
        description: `Factura: ${merchant} (${items.length} ítems)`,
        merchant,
        raw_prompt: `Escaneo OCR: ${items.length} ítems en ${merchant}`,
        date,
      };
      for (const [pocketId, sum] of byPocket) {
        const amount = Math.min(sum, total - assigned);
        if (amount <= 0) continue;
        assigned += amount;
        await financeStore.addTransaction({ ...base, amount, pocket_id: pocketId });
      }
      const rest = Math.round((total - assigned) * 100) / 100;
      if (rest > 0) await financeStore.addTransaction({ ...base, amount: rest });

      setIsConfirmed(true);
      onShowToast(`¡Factura guardada y distribuida en bolsillos!`);
      onReceiptProcessed();
    } catch (err: any) {
      console.error("Error guardando recibo:", err);
      setErrorMsg("Error al registrar la transacción en la bóveda.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setMerchant("");
    setDate("");
    setTotal(0);
    setItems([]);
    setIsConfirmed(false);
    setErrorMsg(null);
  };

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* Mode Switcher */}
      <div className="grid grid-cols-2 p-1 bg-card rounded-full border border-white/[0.06] text-xs font-semibold">
        <button
          onClick={() => {
            setScanMode("camera");
            fileInputRef.current?.setAttribute("capture", "environment");
            fileInputRef.current?.click();
          }}
          className={`py-2 rounded-full flex items-center justify-center gap-1.5 transition-all ${
            scanMode === "camera"
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-on-accent shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Cámara AR / Foto</span>
        </button>

        <button
          onClick={() => {
            setScanMode("upload");
            fileInputRef.current?.removeAttribute("capture");
            fileInputRef.current?.click();
          }}
          className={`py-2 rounded-full flex items-center justify-center gap-1.5 transition-all ${
            scanMode === "upload"
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-on-accent shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Subir Archivo / PDF</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Viewfinder or Upload Area */}
      {!imagePreview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative w-full h-72 rounded-2xl overflow-hidden bg-card border-2 border-dashed border-slate-700/60 hover:border-emerald-500/50 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Camera className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            Captura tu factura o recibo
          </h3>
          <p className="text-xs text-slate-400 max-w-xs">
            IA multimodal extraerá automáticamente el total, desglose por ítems
            y asignará cada rubro a tus bolsillos correspondientes.
          </p>
          <span className="mt-4 px-3 py-1.5 rounded-full bg-slate-800/80 border border-white/[0.08] text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Toca para disparar cámara
          </span>
        </div>
      ) : (
        /* Image Preview with Laser Scanning Beam */
        <div className="relative w-full rounded-2xl overflow-hidden bg-inset border border-white/[0.08] shadow-2xl flex flex-col items-center">
          <div className="relative w-full h-64 bg-black/60 flex items-center justify-center overflow-hidden">
            <img
              src={imagePreview}
              alt="Recibo"
              className="max-h-64 w-auto object-contain"
            />
            {isScanning && (
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-cyan-500/10 animate-pulse pointer-events-none">
                <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-bounce" />
              </div>
            )}
          </div>

          {/* Quick Retake Floating Button */}
          <button
            onClick={handleReset}
            className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Repetir
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {isScanning && (
        <div className="flex items-center justify-center gap-2 py-3 text-emerald-400 text-xs font-medium">
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>Extrayendo ítems con OCR Neuronal Gemini...</span>
        </div>
      )}

      {/* Error state */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Extracted Details & Pocket Splitter */}
      {merchant && !isScanning && (
        <div className="flex flex-col gap-4">
          {/* Header Card */}
          <div className="p-4 rounded-2xl bg-card border border-white/[0.06] shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">
                  {merchant}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{date} • {category}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black text-emerald-400 tabular-nums">
                {formatMoney(total)}
              </span>
              <p className="text-[9px] font-semibold text-teal-300 uppercase tracking-wider">
                Total Factura
              </p>
            </div>
          </div>

          {/* Items & Pocket Assignment */}
          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Ítems Detectados ({items.length})
                </span>
                <span className="text-[10px] text-emerald-400">
                  Asigna cada ítem a un bolsillo
                </span>
              </div>

              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-card border border-white/[0.04] flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white truncate max-w-[200px]">
                        {item.quantity ? `${item.quantity}x ` : ""}
                        {item.name}
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        {formatMoney(item.price)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-emerald-400" />
                        <select
                          value={item.pocketName}
                          onChange={(e) =>
                            handlePocketChange(item.id, e.target.value)
                          }
                          className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none cursor-pointer border-b border-dashed border-white/20 pb-0.5"
                        >
                          <option value="General" className="bg-card">
                            General / Sin bolsillo
                          </option>
                          {pockets.map((p) => (
                            <option
                              key={p.id}
                              value={p.name}
                              className="bg-card"
                            >
                              Bolsillo: {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="text-[9px] font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                        OCR AI
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirm & Save Button */}
          <button
            onClick={handleConfirmAndSave}
            disabled={isSaving || isConfirmed}
            className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
              isConfirmed
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-gradient-to-r from-emerald-500 to-teal-500 text-on-accent hover:opacity-95 shadow-emerald-500/20"
            }`}
          >
            {isConfirmed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Factura Registrada con Éxito</span>
              </>
            ) : isSaving ? (
              <span>Guardando en la Bóveda...</span>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirmar y Guardar en Bóveda</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
