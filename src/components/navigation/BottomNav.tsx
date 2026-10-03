"use client";

import React from "react";
import {
  LayoutDashboard,
  Wallet,
  Sparkles,
  Camera,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";
import { useApp } from "@/lib/context/AppContext";

export type NavTab = "dashboard" | "pockets" | "copilot" | "scan" | "settings";

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onQuickAdd?: () => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useApp();

  const tabs = [
    { id: "dashboard" as NavTab, label: t("nav.dashboard") || "Inicio", icon: LayoutDashboard },
    { id: "pockets" as NavTab, label: t("nav.pockets") || "Bolsillos", icon: Wallet },
    { id: "copilot" as NavTab, label: t("nav.copilot") || "Copiloto", icon: Sparkles, isCenter: true },
    { id: "scan" as NavTab, label: t("nav.scan") || "Escanear", icon: Camera },
    { id: "settings" as NavTab, label: t("nav.settings") || "Ajustes", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-5 pt-2 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="glass-panel rounded-full px-2 py-1.5 flex items-center justify-between border-white/[0.1] shadow-2xl backdrop-blur-2xl bg-[#0D1322]/90">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            if (tab.isCenter) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange("copilot")}
                  className="relative -top-3 mx-1 flex flex-col items-center group focus:outline-none"
                  aria-label="Copiloto IA"
                >
                  <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-[2px] shadow-[0_0_18px_rgba(16,185,129,0.45)] transition-transform duration-200 group-hover:scale-105 active:scale-95">
                    <div className="w-full h-full rounded-full bg-[#070A11] flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-emerald-400 transition-colors" />
                    </div>
                  </div>
                  <span className="text-[10px] mt-0.5 font-bold text-emerald-400">
                    {tab.label}
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
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
