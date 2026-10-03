"use client";

import React, { useState } from "react";
import { Header } from "@/components/header/Header";
import { BottomNav, NavTab } from "@/components/navigation/BottomNav";
import { VoiceOrb, OrbState } from "@/components/voice/VoiceOrb";
import { GlassCard } from "@/components/ui/GlassCard";

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [orbState, setOrbState] = useState<OrbState>("idle");

  const cycleOrbState = () => {
    const states: OrbState[] = ["idle", "listening", "processing", "success", "error"];
    const nextIndex = (states.indexOf(orbState) + 1) % states.length;
    setOrbState(states[nextIndex]);
  };

  return (
    <div className="min-h-screen bg-[#070A11] flex flex-col pb-24">
      <Header onOpenVoice={() => setActiveTab("voice")} />

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {/* Quick Orb Showcase */}
        <GlassCard glow className="p-6 flex flex-col items-center justify-center text-center">
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-2">
            Orbe Interactivo Live
          </p>
          <VoiceOrb state={orbState} onClick={cycleOrbState} size={160} />
          <p className="mt-4 text-xs text-slate-400">
            Estado actual: <span className="text-white font-medium capitalize">{orbState}</span> (Toca para alternar)
          </p>
        </GlassCard>
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickAdd={() => {}}
      />
    </div>
  );
}
