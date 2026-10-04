"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Ancho máximo en escritorio (clase Tailwind), por defecto max-w-md */
  maxWidth?: string;
}

/** Hoja modal: se ancla abajo en móvil (con safe-area) y se centra en pantallas grandes. */
export function Sheet({ open, onClose, title, children, maxWidth = "max-w-md" }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-md"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`relative w-full ${maxWidth} rounded-t-3xl sm:rounded-3xl bg-card border border-white/[0.1] shadow-2xl p-5 sm:p-6 flex flex-col max-h-[94dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
      >
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 min-w-0">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 shrink-0 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl bg-inset border border-white/[0.08] text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50";
export const labelCls = "text-[11px] font-semibold text-slate-300 block mb-1";
