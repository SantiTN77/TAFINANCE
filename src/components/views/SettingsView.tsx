"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Moon,
  Sun,
  Smartphone,
  Fingerprint,
  Database,
  Download,
  Trash2,
  Lock,
  Globe,
  DollarSign,
  AlertCircle,
  BellRing,
  Bug,
  RefreshCw,
  Share,
} from "lucide-react";
import { useApp, ThemeMode, CurrencyCode } from "@/lib/context/AppContext";
import { Language } from "@/lib/i18n/translations";
import { isBiometricSupported, hasRegisteredBiometrics, registerBiometricCredential } from "@/lib/auth/webauthn";
import { usePwa } from "@/lib/pwa/PwaProvider";
import { financeStore } from "@/lib/storage/finance-store";
import { isDebugEnabled, setDebugEnabled } from "@/lib/debug/logger";
import { Sheet } from "@/components/ui/Sheet";
import { AccountSection } from "@/components/settings/AccountSection";

interface SettingsViewProps {
  onClearAllData: () => Promise<void>;
  onExportBackup: () => void;
  onLockSession: () => void;
  onShowToast: (msg: string) => void;
  syncState?: string;
  pending?: number;
}

const card = "flex flex-col gap-3 rounded-2xl bg-card border border-white/[0.06] p-5 shadow-xl";

export const SettingsView: React.FC<SettingsViewProps> = ({
  onClearAllData,
  onExportBackup,
  onLockSession,
  onShowToast,
  syncState,
  pending = 0,
}) => {
  const { theme, setTheme, language, setLanguage, currency, setCurrency, t } = useApp();
  const pwa = usePwa();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [registeringBio, setRegisteringBio] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [debug, setDebug] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    isBiometricSupported().then(setBiometricsAvailable);
    setHasBiometrics(hasRegisteredBiometrics());
    setDebug(isDebugEnabled());
  }, []);

  const handleEnrollBiometrics = async () => {
    setRegisteringBio(true);
    try {
      const ok = await registerBiometricCredential();
      if (ok) {
        setHasBiometrics(true);
        onShowToast("¡Huella vinculada a este dispositivo!");
      } else {
        onShowToast("No se pudo completar el registro biométrico");
      }
    } finally {
      setRegisteringBio(false);
    }
  };

  const toggleDebug = () => {
    const next = !debug;
    setDebug(next);
    setDebugEnabled(next);
    onShowToast(next ? "Consola de depuración activada" : "Consola de depuración desactivada");
  };

  const handleInstall = async () => {
    if (pwa.isIOS) return setIosHelp(true);
    const res = await pwa.install();
    if (res === "unavailable") onShowToast("Usa el menú del navegador → «Instalar app» / «Añadir a pantalla de inicio»");
  };

  const handlePush = async () => {
    if (pwa.pushStatus === "subscribed") {
      await pwa.disablePush();
      onShowToast("Notificaciones desactivadas");
      return;
    }
    const res = await pwa.enablePush();
    onShowToast(res.message);
  };

  const pushLabel =
    pwa.pushStatus === "subscribed"
      ? "Activadas en este dispositivo"
      : pwa.pushStatus === "denied"
      ? "Bloqueadas en el navegador"
      : pwa.pushStatus === "unsupported"
      ? "No soportadas en este navegador"
      : "Desactivadas";

  const segmented = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
      active ? "bg-indigo-500 text-on-accent shadow-sm" : "text-slate-400 hover:text-white"
    }`;

  return (
    <div className="flex flex-col gap-5 pb-28">
      <section className="relative overflow-hidden rounded-2xl bg-card border border-white/[0.06] p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-on-accent shadow-md">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">{t("settingsTitle")}</h2>
            <p className="text-xs text-slate-400">{t("settingsSubtitle")}</p>
          </div>
        </div>
      </section>

      {/* Apariencia */}
      <section className={card}>
        <span className="text-xs font-bold text-indigo2 uppercase tracking-wider">{t("appearanceSection")}</span>

        <div className="flex flex-col gap-2 pt-1">
          <label className="text-xs text-slate-400">{t("themeLabel")}</label>
          <div className="grid grid-cols-3 gap-2 bg-inset p-1 rounded-xl border border-white/[0.06]">
            {([
              { id: "dark", label: t("themeDark"), icon: Moon },
              { id: "light", label: t("themeLight"), icon: Sun },
              { id: "oled", label: t("themeOled"), icon: Smartphone },
            ] as const).map((th) => {
              const Icon = th.icon;
              return (
                <button
                  key={th.id}
                  onClick={() => setTheme(th.id as ThemeMode)}
                  aria-pressed={theme === th.id}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    theme === th.id ? "bg-indigo-500 text-on-accent shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{th.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Globe className="w-4 h-4 text-sky2" />
            <span>{t("languageLabel")}</span>
          </div>
          <div className="flex items-center bg-inset p-0.5 rounded-lg border border-white/[0.06]">
            {(["es", "en"] as const).map((l) => (
              <button key={l} onClick={() => setLanguage(l as Language)} className={`${segmented(language === l)} uppercase`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <DollarSign className="w-4 h-4 text-mint" />
            <span>{t("currencyLabel")}</span>
          </div>
          <div className="flex items-center bg-inset p-0.5 rounded-lg border border-white/[0.06]">
            {(["COP", "USD", "EUR"] as const).map((c) => (
              <button key={c} onClick={() => setCurrency(c as CurrencyCode)} className={segmented(currency === c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* App y notificaciones */}
      <section className={card}>
        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">App y notificaciones</span>

        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-inset border border-white/[0.06]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">Avisos de pagos y cortes</p>
              <p className="text-[10px] text-slate-400">{pushLabel}</p>
            </div>
          </div>
          <button
            onClick={handlePush}
            disabled={pwa.pushBusy || pwa.pushStatus === "unsupported" || pwa.pushStatus === "denied"}
            className={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 disabled:opacity-50 ${
              pwa.pushStatus === "subscribed"
                ? "bg-white/[0.06] text-slate-300 border border-white/[0.08]"
                : "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950"
            }`}
          >
            {pwa.pushBusy ? "…" : pwa.pushStatus === "subscribed" ? "Desactivar" : "Activar"}
          </button>
        </div>
        {pwa.pushStatus === "subscribed" && (
          <button
            onClick={async () => onShowToast((await pwa.sendTestPush()).message)}
            className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200 border border-white/[0.06]"
          >
            Enviar notificación de prueba
          </button>
        )}
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Recibes avisos aunque la app esté cerrada: día de corte, vencimiento de tarjetas (según los días de anticipación que fijes en cada
          tarjeta) y compromisos fijos.
        </p>

        {!pwa.installed && (
          <button
            onClick={handleInstall}
            className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white border border-white/[0.06] flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-sky2" />
            Instalar app en este dispositivo
          </button>
        )}
        {pwa.installed && <p className="text-[11px] text-mint font-semibold">✓ App instalada</p>}
      </section>

      {/* Seguridad */}
      <section className={card}>
        <span className="text-xs font-bold text-sky2 uppercase tracking-wider">{t("securitySection")}</span>

        {biometricsAvailable && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-inset border border-white/[0.06]">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  hasBiometrics ? "bg-emerald-500/15 text-mint" : "bg-white/[0.04] text-slate-400"
                }`}
              >
                <Fingerprint className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">
                  {hasBiometrics ? t("biometricsActive") : t("biometricsInactive")}
                </span>
                <span className="text-[10px] text-slate-400">{t("biometricsDesc")}</span>
              </div>
            </div>
            <button
              onClick={handleEnrollBiometrics}
              disabled={registeringBio}
              className={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 ${
                hasBiometrics
                  ? "bg-emerald-500/20 text-mint border border-emerald-500/30"
                  : "bg-gradient-to-r from-indigo-600 to-indigo-400 text-on-accent shadow-sm active:scale-95"
              }`}
            >
              {registeringBio ? "Escaneando…" : hasBiometrics ? "Renovar" : "Vincular"}
            </button>
          </div>
        )}

        <button
          onClick={onLockSession}
          className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 text-xs font-semibold text-slate-300 border border-white/[0.06] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Lock className="w-4 h-4 text-rose-400" />
          <span>{t("lockSessionBtn")}</span>
        </button>
      </section>

      <AccountSection onShowToast={onShowToast} />

      {/* Datos */}
      <section className={card}>
        <span className="text-xs font-bold text-mint uppercase tracking-wider">{t("dataSection")}</span>

        <div className="flex items-center justify-between p-3 rounded-xl bg-inset border border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-mint" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">{t("databaseStatus")}</span>
              <span className="text-[10px] text-slate-400">
                {syncState !== "local" ? t("databaseConnected") : t("databaseLocal")}
                {pending > 0 ? ` · ${pending} cambios por enviar` : ""}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              void financeStore.sync().then(() => onShowToast("Sincronizado"));
            }}
            aria-label="Sincronizar ahora"
            className="p-2 rounded-lg bg-white/[0.05] text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${syncState === "syncing" ? "animate-spin" : ""}`} />
          </button>
        </div>

        <button
          onClick={onExportBackup}
          className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white border border-white/[0.06] flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4 text-sky2" />
          <span>{t("exportData")}</span>
        </button>

        <button
          onClick={() => setShowClearConfirm(true)}
          className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-400 border border-rose-500/20 flex items-center justify-center gap-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t("clearAllData")}</span>
        </button>
      </section>

      {/* Depuración */}
      <section className={card}>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Depuración</span>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bug className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-white">Consola de logs en vivo</p>
              <p className="text-[10px] text-slate-400">Muestra voz, sincronización, notificaciones y errores. También con ?debug=1</p>
            </div>
          </div>
          <button
            onClick={toggleDebug}
            role="switch"
            aria-checked={debug}
            aria-label="Consola de depuración"
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${debug ? "bg-emerald-500" : "bg-slate-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${debug ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </section>

      <Sheet open={showClearConfirm} onClose={() => setShowClearConfirm(false)} title={<><AlertCircle className="w-5 h-5 text-rose-400" /> ¿Reiniciar todos los datos?</>}>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">{t("clearDataConfirm")}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-xs font-semibold text-slate-300 hover:text-white">
            {t("cancel")}
          </button>
          <button
            onClick={async () => {
              await onClearAllData();
              setShowClearConfirm(false);
              onShowToast("Todos los datos han sido reiniciados");
            }}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 text-xs font-bold text-on-accent shadow-md active:scale-95 transition-all"
          >
            Sí, reiniciar
          </button>
        </div>
      </Sheet>

      <Sheet open={iosHelp} onClose={() => setIosHelp(false)} title="Instalar en iPhone">
        <ol className="text-xs text-slate-300 space-y-3 list-decimal pl-4">
          <li>Abre esta página en <b>Safari</b>.</li>
          <li>Toca el botón <b>Compartir</b> <Share className="inline w-3.5 h-3.5 -mt-0.5" />.</li>
          <li>Elige <b>«Añadir a pantalla de inicio»</b>.</li>
          <li>Abre la app desde el icono y activa las notificaciones aquí en Ajustes.</li>
        </ol>
      </Sheet>
    </div>
  );
};
