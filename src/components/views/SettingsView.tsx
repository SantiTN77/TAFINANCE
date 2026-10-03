"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Moon,
  Sun,
  Smartphone,
  Fingerprint,
  Check,
  Shield,
  Database,
  Download,
  Trash2,
  Lock,
  Globe,
  Sparkles,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { useApp, ThemeMode, CurrencyCode } from "@/lib/context/AppContext";
import { Language } from "@/lib/i18n/translations";
import { isBiometricSupported, hasRegisteredBiometrics, registerBiometricCredential } from "@/lib/auth/webauthn";
import { isSupabaseConfigured } from "@/lib/supabase/client";

interface SettingsViewProps {
  onClearAllData: () => Promise<void>;
  onExportBackup: () => void;
  onLockSession: () => void;
  onShowToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onClearAllData,
  onExportBackup,
  onLockSession,
  onShowToast,
}) => {
  const { theme, setTheme, language, setLanguage, currency, setCurrency, t } = useApp();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [registeringBio, setRegisteringBio] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    isBiometricSupported().then(setBiometricsAvailable);
    setHasBiometrics(hasRegisteredBiometrics());
  }, []);

  const handleEnrollBiometrics = async () => {
    setRegisteringBio(true);
    try {
      const ok = await registerBiometricCredential();
      if (ok) {
        setHasBiometrics(true);
        onShowToast("¡Huella digital vinculada exitosamente a este dispositivo!");
      } else {
        onShowToast("No se pudo completar el registro biométrico");
      }
    } finally {
      setRegisteringBio(false);
    }
  };

  const handleConfirmClear = async () => {
    await onClearAllData();
    setShowClearConfirm(false);
    onShowToast("Todos los datos han sido reiniciados a cero");
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl bg-[#141923] border border-white/[0.06] p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8083ff] to-[#4cd7f6] flex items-center justify-center text-white shadow-md">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              {t("settingsTitle")}
            </h2>
            <p className="text-xs text-slate-400">
              {t("settingsSubtitle")}
            </p>
          </div>
        </div>
      </section>

      {/* 1. Appearance & Theme */}
      <section className="flex flex-col gap-3 rounded-2xl bg-[#141923] border border-white/[0.06] p-5 shadow-xl">
        <span className="text-xs font-bold text-[#8083ff] uppercase tracking-wider">
          {t("appearanceSection")}
        </span>

        {/* Theme Segmented Control */}
        <div className="flex flex-col gap-2 pt-1">
          <label className="text-xs text-slate-400">{t("themeLabel")}</label>
          <div className="grid grid-cols-3 gap-2 bg-[#0a0e16] p-1 rounded-xl border border-white/[0.06]">
            {(
              [
                { id: "dark", label: t("themeDark"), icon: Moon },
                { id: "light", label: t("themeLight"), icon: Sun },
                { id: "oled", label: t("themeOled"), icon: Smartphone },
              ] as const
            ).map((th) => {
              const Icon = th.icon;
              return (
                <button
                  key={th.id}
                  onClick={() => setTheme(th.id as ThemeMode)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    theme === th.id
                      ? "bg-[#8083ff] text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{th.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Globe className="w-4 h-4 text-[#4cd7f6]" />
            <span>{t("languageLabel")}</span>
          </div>
          <div className="flex items-center bg-[#0a0e16] p-0.5 rounded-lg border border-white/[0.06]">
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l as Language)}
                className={`px-3 py-1 rounded-md text-xs font-semibold uppercase transition-all ${
                  language === l
                    ? "bg-[#8083ff] text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Currency Selector */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <DollarSign className="w-4 h-4 text-[#4edea3]" />
            <span>{t("currencyLabel")}</span>
          </div>
          <div className="flex items-center bg-[#0a0e16] p-0.5 rounded-lg border border-white/[0.06]">
            {(["COP", "USD", "EUR"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c as CurrencyCode)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  currency === c
                    ? "bg-[#8083ff] text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Security & Biometrics */}
      <section className="flex flex-col gap-3 rounded-2xl bg-[#141923] border border-white/[0.06] p-5 shadow-xl">
        <span className="text-xs font-bold text-[#4cd7f6] uppercase tracking-wider">
          {t("securitySection")}
        </span>

        {/* Biometrics Card */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0a0e16] border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                hasBiometrics
                  ? "bg-[#4edea3]/15 text-[#4edea3]"
                  : "bg-white/[0.04] text-slate-400"
              }`}
            >
              <Fingerprint className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">
                {hasBiometrics ? t("biometricsActive") : t("biometricsInactive")}
              </span>
              <span className="text-[10px] text-slate-400 max-w-[200px]">
                {t("biometricsDesc")}
              </span>
            </div>
          </div>

          <button
            onClick={handleEnrollBiometrics}
            disabled={registeringBio}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              hasBiometrics
                ? "bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/30"
                : "bg-gradient-to-r from-[#494bd6] to-[#8083ff] text-white shadow-sm active:scale-95"
            }`}
          >
            {hasBiometrics ? "Activo" : registeringBio ? "Escaneando..." : "Vincular"}
          </button>
        </div>

        {/* Lock Bóveda */}
        <button
          onClick={onLockSession}
          className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 text-xs font-semibold text-slate-300 border border-white/[0.06] flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <Lock className="w-4 h-4 text-rose-400" />
          <span>{t("lockSessionBtn")}</span>
        </button>
      </section>

      {/* 3. Data & Backup */}
      <section className="flex flex-col gap-3 rounded-2xl bg-[#141923] border border-white/[0.06] p-5 shadow-xl">
        <span className="text-xs font-bold text-[#4edea3] uppercase tracking-wider">
          {t("dataSection")}
        </span>

        {/* Database Status */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0e16] border border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-[#4edea3]" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">
                {t("databaseStatus")}
              </span>
              <span className="text-[10px] text-slate-400">
                {isSupabaseConfigured() ? t("databaseConnected") : t("databaseLocal")}
              </span>
            </div>
          </div>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4edea3]"></span>
          </span>
        </div>

        {/* Export JSON */}
        <button
          onClick={onExportBackup}
          className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white border border-white/[0.06] flex items-center justify-center gap-2 transition-colors active:scale-98"
        >
          <Download className="w-4 h-4 text-[#4cd7f6]" />
          <span>{t("exportData")}</span>
        </button>

        {/* Clear Data Reset */}
        <button
          onClick={() => setShowClearConfirm(true)}
          className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-400 border border-rose-500/20 flex items-center justify-center gap-2 transition-colors active:scale-98"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t("clearAllData")}</span>
        </button>
      </section>

      {/* MODAL: Confirmation for Reset */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#141923] border border-rose-500/30 p-5 shadow-2xl flex flex-col gap-3.5">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">¿Reiniciar todos los datos?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t("clearDataConfirm")}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-xs font-semibold text-slate-300 hover:text-white"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleConfirmClear}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-xs font-bold text-white shadow-md active:scale-95 transition-all"
              >
                Sí, Reiniciar a Cero
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
