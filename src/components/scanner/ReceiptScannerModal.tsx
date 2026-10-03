"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Camera, Check, Sparkles, Tag, ShoppingBag, Receipt, AlertCircle } from "lucide-react";
import { ScannedReceipt } from "@/types/finance";
import { financeStore } from "@/lib/storage/finance-store";

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptSaved: () => void;
}

export function ReceiptScannerModal({
  isOpen,
  onClose,
  onReceiptSaved,
}: ReceiptScannerModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<ScannedReceipt | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    setScannedResult(null);

    try {
      const response = await fetch("/api/ocr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      });

      if (!response.ok) {
        throw new Error("No se pudo escanear el recibo.");
      }

      const data: ScannedReceipt = await response.json();
      setScannedResult(data);
    } catch (err: any) {
      console.error("Error OCR:", err);
      setErrorMsg(err.message || "Error al procesar la imagen");
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!scannedResult) return;
    setIsSaving(true);
    try {
      const categories = await financeStore.getCategories();
      const accounts = await financeStore.getAccounts();

      const matchedCat = categories.find((c) => c.name.toLowerCase() === scannedResult.category.toLowerCase()) || categories[0];
      const matchedAcc = accounts[0];

      await financeStore.addTransaction({
        account_id: matchedAcc?.id,
        category_id: matchedCat?.id,
        type: "EXPENSE",
        amount: scannedResult.total,
        currency: scannedResult.currency || "COP",
        description: `Factura en ${scannedResult.merchant}`,
        merchant: scannedResult.merchant,
        receipt_url: imagePreview || undefined,
        raw_prompt: `Escaneo OCR: ${scannedResult.items.length} ítems en ${scannedResult.merchant}`,
        date: scannedResult.date || new Date().toISOString().split("T")[0],
      });

      onReceiptSaved();
      handleClose();
    } catch (err) {
      console.error("Error guardando factura:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setImagePreview(null);
    setScannedResult(null);
    setIsScanning(false);
    setErrorMsg(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="relative w-full max-w-md rounded-3xl bg-[#0B101D] border border-white/[0.1] shadow-2xl p-6 flex flex-col items-center max-h-[90vh] overflow-y-auto"
        >
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Escáner Inteligente de Facturas
              </span>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Upload Area */}
          {!imagePreview && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0E1527]/50 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-sm font-semibold text-white">Sube o toma foto de tu factura</p>
              <p className="text-xs text-slate-400 mt-1 text-center">
                Gemini extraerá comercio, fecha, ítems, IVA y clasificará el gasto automáticamente.
              </p>
            </div>
          )}

          {/* Image & Scanning Laser Effect */}
          {imagePreview && (
            <div className="relative w-full rounded-2xl overflow-hidden mb-4 border border-white/[0.1] bg-black/60 flex items-center justify-center max-h-56">
              <img
                src={imagePreview}
                alt="Factura"
                className="max-h-56 w-auto object-contain"
              />
              {isScanning && (
                <motion.div
                  initial={{ top: "0%" }}
                  animate={{ top: "100%" }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)] z-10"
                />
              )}
            </div>
          )}

          {/* Scanning Status */}
          {isScanning && (
            <div className="my-3 flex items-center gap-2 text-cyan-400 text-xs font-medium">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Analizando factura con Gemini 3.5 Multimodal...</span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Extracted Details */}
          {scannedResult && !isScanning && (
            <div className="w-full bg-[#12192B] rounded-2xl p-4 border border-emerald-500/30 mb-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5" />
                  Factura Extraída
                </span>
                <span className="text-xs text-slate-400">{scannedResult.date}</span>
              </div>

              <div className="mb-2">
                <h3 className="text-base font-bold text-white">{scannedResult.merchant}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Tag className="w-3 h-3 text-emerald-400" />
                  {scannedResult.category}
                </p>
              </div>

              {/* Items List */}
              {scannedResult.items.length > 0 && (
                <div className="my-3 border-t border-b border-white/[0.06] py-2 max-h-28 overflow-y-auto space-y-1">
                  {scannedResult.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-300">
                      <span className="truncate pr-2">
                        {item.quantity ? `${item.quantity}x ` : ""}
                        {item.name}
                      </span>
                      <span className="font-semibold text-slate-100 flex-shrink-0">
                        ${item.price.toLocaleString("es-CO")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs text-slate-400">Total a registrar:</span>
                <span className="text-lg font-black text-emerald-400">
                  ${scannedResult.total.toLocaleString("es-CO")} {scannedResult.currency}
                </span>
              </div>

              {/* Save / Retake Buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setImagePreview(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Repetir
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                  className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  {isSaving ? "Guardando..." : "Guardar en TAFINANCE"}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
