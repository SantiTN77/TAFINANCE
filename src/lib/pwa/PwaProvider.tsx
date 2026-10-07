"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { logger, installGlobalLogging } from "@/lib/debug/logger";
import { financeStore } from "@/lib/storage/finance-store";
import { buildReminders } from "@/lib/finance/calc";
import { Reminder } from "@/types/finance";

type PushStatus = "unsupported" | "default" | "denied" | "granted" | "subscribed";

interface PwaContextType {
  /** El navegador ofrece instalación nativa (Android/Chrome/Edge). */
  canInstall: boolean;
  installed: boolean;
  isIOS: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
  pushStatus: PushStatus;
  pushBusy: boolean;
  enablePush: () => Promise<{ ok: boolean; message: string }>;
  disablePush: () => Promise<void>;
  sendTestPush: () => Promise<{ ok: boolean; message: string }>;
  online: boolean;
}

const PwaContext = createContext<PwaContextType | null>(null);

const NOTIFIED_KEY = "tafinance_notified";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  /* ------------------------------ arranque ------------------------------ */
  useEffect(() => {
    installGlobalLogging();
    setOnline(navigator.onLine);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true
    );

    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      logger.info("pwa", "Instalación disponible");
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      logger.info("pwa", "App instalada");
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          regRef.current = reg;
          logger.info("pwa", "Service worker registrado", { scope: reg.scope });
          await refreshPushStatus(reg);
        })
        .catch((e) => logger.error("pwa", "No se pudo registrar el service worker", e));
    } else {
      setPushStatus("unsupported");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshPushStatus = useCallback(async (reg?: ServiceWorkerRegistration | null) => {
    if (!("Notification" in window) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") return setPushStatus("denied");
    const r = reg || regRef.current || (await navigator.serviceWorker.getRegistration());
    const sub = await r?.pushManager.getSubscription();
    if (sub) setPushStatus("subscribed");
    else setPushStatus(Notification.permission === "granted" ? "granted" : "default");
  }, []);

  /* ------------------------------ recordatorios ------------------------------ */

  const syncReminders = useCallback(async (reminders: Reminder[]) => {
    const reg = regRef.current || (await navigator.serviceWorker?.getRegistration());
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    try {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          reminders: reminders.map((r) => ({ id: r.id, title: r.title, body: r.body, fireAt: r.fireAt })),
          userAgent: navigator.userAgent,
        }),
      });
      logger.debug("push", "Recordatorios sincronizados", { count: reminders.length });
    } catch (e) {
      logger.warn("push", "No se pudieron sincronizar recordatorios", e);
    }
  }, []);

  /** Notificaciones locales para lo que ya venció mientras la app estaba cerrada o abierta. */
  const showDueLocally = useCallback(async (reminders: Reminder[]) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = regRef.current || (await navigator.serviceWorker?.getRegistration());
    if (!reg) return;
    let notified: string[] = [];
    try {
      notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]");
    } catch {}
    const now = Date.now();
    const due = reminders.filter((r) => {
      const t = Date.parse(r.fireAt);
      return t <= now && now - t < 2 * 86400000 && !notified.includes(r.id);
    });
    for (const r of due) {
      await reg.showNotification(r.title, {
        body: r.body,
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag: r.id,
        data: { url: "/app" },
      });
      notified.push(r.id);
      logger.info("push", "Notificación local", { title: r.title });
    }
    if (due.length) {
      try {
        localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified.slice(-200)));
      } catch {}
    }
  }, []);

  // Recalcula recordatorios en cada cambio de datos (con debounce) y los envía al servidor
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      const snap = financeStore.snapshot();
      const reminders = buildReminders(snap.accounts, snap.transactions);
      void showDueLocally(reminders);
      if (pushStatus === "subscribed") void syncReminders(reminders);
    };
    const unsub = financeStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 1500);
    });
    timer = setTimeout(run, 2500);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [pushStatus, showDueLocally, syncReminders]);

  /* ------------------------------ acciones ------------------------------ */

  const install = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") setInstalled(true);
    logger.info("pwa", "Resultado de instalación", choice.outcome);
    return choice.outcome as "accepted" | "dismissed";
  }, [deferredPrompt]);

  const enablePush = useCallback(async () => {
    setPushBusy(true);
    try {
      if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
        return {
          ok: false,
          message: isIOS && !installed
            ? "En iPhone primero instala la app (Compartir → Añadir a pantalla de inicio) y vuelve a activar."
            : "Este navegador no soporta notificaciones push.",
        };
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        await refreshPushStatus();
        return { ok: false, message: "Permiso de notificaciones denegado. Actívalo en los ajustes del navegador." };
      }
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) return { ok: false, message: "Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en el servidor." };

      const reg = regRef.current || (await navigator.serviceWorker.ready);
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      }
      const snap = financeStore.snapshot();
      const reminders = buildReminders(snap.accounts, snap.transactions);
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          reminders: reminders.map((r) => ({ id: r.id, title: r.title, body: r.body, fireAt: r.fireAt })),
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, message: data.error || "No se pudo registrar el dispositivo." };
      }
      setPushStatus("subscribed");
      logger.info("push", "Push activado", { reminders: reminders.length });
      return { ok: true, message: "Notificaciones activadas en este dispositivo." };
    } catch (e: any) {
      logger.error("push", "Fallo al activar push", e);
      return { ok: false, message: e?.message || "No se pudieron activar las notificaciones." };
    } finally {
      setPushBusy(false);
    }
  }, [installed, isIOS, refreshPushStatus]);

  const disablePush = useCallback(async () => {
    setPushBusy(true);
    try {
      const reg = regRef.current || (await navigator.serviceWorker.getRegistration());
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      await refreshPushStatus();
    } finally {
      setPushBusy(false);
    }
  }, [refreshPushStatus]);

  const sendTestPush = useCallback(async () => {
    const reg = regRef.current || (await navigator.serviceWorker.getRegistration());
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return { ok: false, message: "Activa primero las notificaciones." };
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok
      ? { ok: true, message: "Notificación de prueba enviada." }
      : { ok: false, message: data.error || `El servicio push respondió ${data.status || res.status}.` };
  }, []);

  const value = useMemo<PwaContextType>(
    () => ({
      canInstall: !!deferredPrompt,
      installed,
      isIOS,
      install,
      pushStatus,
      pushBusy,
      enablePush,
      disablePush,
      sendTestPush,
      online,
    }),
    [deferredPrompt, installed, isIOS, install, pushStatus, pushBusy, enablePush, disablePush, sendTestPush, online]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa(): PwaContextType {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa debe usarse dentro de PwaProvider");
  return ctx;
}
