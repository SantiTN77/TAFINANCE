"use client";

import React from "react";
import {
  LayoutDashboard,
  Wallet,
  Sparkles,
  Camera,
  Settings,
  Plus,
} from "lucide-react";
import { clsx } from "clsx";
import { useApp } from "@/lib/context/AppContext";

export type NavTab = "dashboard" | "pockets" | "copilot" | "scan" | "settings";

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onQuickAdd?: () => void;
}

export function BottomNav({ activeTab, onTabChange, onQuickAdd }: BottomNavProps) {
  const { language } = useApp();
  const isEs = language === "es";

  const getLabel = (id: NavTab): string => {
    switch (id) {
      case "dashboard":
        return isEs ? "Inicio" : "Home";
      case "pockets":
        return isEs ? "Bolsillos" : "Pockets";
      case "copilot":
        return isEs ? "Copiloto" : "Copilot";
      case "scan":
        return isEs ? "Escanear" : "Scan";
      case "settings":
        return isEs ? "Ajustes" : "Settings";
    }
  };

  const tabs: { id: NavTab; icon: any }[] = [
    { id: "dashboard", icon: LayoutDashboard },
    { id: "pockets", icon: Wallet },
    { id: "copilot", icon: Sparkles },
    { id: "scan", icon: Camera },
    { id: "settings", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-5 pt-2 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="glass-panel rounded-full px-2 py-1.5 flex items-center justify-between border-white/[0.1] shadow-2xl backdrop-blur-2xl bg-card/95">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const label = getLabel(tab.id);
            const isCenter = tab.id === "copilot";

            if (isCenter) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange("copilot")}
                  className="relative -top-3.5 mx-1 flex flex-col items-center group focus:outline-none"
                  aria-label={label}
                >
                  <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-[2px] shadow-[0_0_18px_rgba(16,185,129,0.45)] transition-transform duration-200 group-hover:scale-105 active:scale-95">
                    <div className="w-full h-full rounded-full bg-app flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-emerald-400 transition-colors" />
                    </div>
                  </div>
                  <span className="text-[10px] mt-0.5 font-bold text-emerald-400">
                    {label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={clsx(
                  "flex-1 flex flex-col items-center py-1 transition-colors duration-200 focus:outline-none",
                  isActive
                    ? "text-emerald-400 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Icon
                  className={clsx(
                    "w-5 h-5",
                    isActive && "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  )}
                />
                <span className="text-[10px] mt-1 font-medium">{label}</span>
              </button>
            );
          })}

          {/* Quick Manual Add Button */}
          {onQuickAdd && (
            <button
              onClick={onQuickAdd}
              className="px-2 py-1 text-slate-400 hover:text-emerald-400 focus:outline-none transition-colors flex flex-col items-center"
              aria-label="Añadir movimiento manual"
              title="Registrar gasto o ingreso manual / recurrente"
            >
              <div className="w-5 h-5 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center hover:scale-105 transition-transform">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[9px] mt-1 text-emerald-400 font-medium">
                {isEs ? "+Nuevo" : "+Add"}
              </span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
