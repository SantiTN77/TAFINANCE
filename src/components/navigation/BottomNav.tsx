"use client";

import React from "react";
import { LayoutDashboard, Mic, Camera, PieChart, Plus } from "lucide-react";
import { clsx } from "clsx";

export type NavTab = "dashboard" | "voice" | "scan" | "analytics";

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onQuickAdd: () => void;
}

export function BottomNav({ activeTab, onTabChange, onQuickAdd }: BottomNavProps) {
  const tabs = [
    { id: "dashboard" as NavTab, label: "Inicio", icon: LayoutDashboard },
    { id: "analytics" as NavTab, label: "Métricas", icon: PieChart },
    { id: "voice" as NavTab, label: "Voz Live", icon: Mic, isVoice: true },
    { id: "scan" as NavTab, label: "Escanear", icon: Camera },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-2 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="glass-panel rounded-full px-3 py-2 flex items-center justify-between border-white/[0.1] shadow-2xl backdrop-blur-2xl bg-[#0D1322]/85">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            if (tab.isVoice) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange("voice")}
                  className="relative -top-4 mx-1 flex flex-col items-center group focus:outline-none"
                  aria-label="Asistente de Voz"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-[2px] shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-transform duration-200 group-hover:scale-105 active:scale-95">
                    <div className="w-full h-full rounded-full bg-[#070A11] flex items-center justify-center">
                      <Mic className="w-6 h-6 text-emerald-400 transition-colors" />
                    </div>
                  </div>
                  <span className="text-[10px] mt-1 font-medium text-emerald-400">
                    Voz Live
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
                <Icon className={clsx("w-5 h-5", isActive && "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]")} />
                <span className="text-[11px] mt-1">{tab.label}</span>
              </button>
            );
          })}

          {/* Quick Manual Add Button */}
          <button
            onClick={onQuickAdd}
            className="flex-1 flex flex-col items-center py-1 text-slate-400 hover:text-slate-200 focus:outline-none transition-colors"
            aria-label="Añadir transacción"
          >
            <div className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center hover:border-slate-400">
              <Plus className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <span className="text-[11px] mt-1">Manual</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
