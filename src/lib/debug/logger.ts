
/**
 * Logger de depuración en vivo para el navegador.
 * - Escribe en consola con prefijo [TAF] y mantiene un buffer circular.
 * - El panel <DebugConsole /> se suscribe para mostrar los eventos en tiempo real.
 * - Se activa con ?debug=1, con localStorage.tafinance_debug="1" o desde Ajustes.
 * - Expone window.__taf (logs, dump(), clear()) para inspeccionar desde DevTools.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  scope: string;
  msg: string;
  data?: unknown;
}

const MAX_ENTRIES = 400;
const STORAGE_KEY = "tafinance_debug";

let counter = 0;
let buffer: LogEntry[] = [];
const listeners = new Set<() => void>();
let installed = false;

const isBrowser = () => typeof window !== "undefined";

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {}
  });
}

function safeData(data: unknown): unknown {
  if (data instanceof Error) return { name: data.name, message: data.message };
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return String(data);
  }
}

export function log(level: LogLevel, scope: string, msg: string, data?: unknown) {
  const entry: LogEntry = {
    id: ++counter,
    ts: Date.now(),
    level,
    scope,
    msg,
    data: data === undefined ? undefined : safeData(data),
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer = buffer.slice(-MAX_ENTRIES);

  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (level !== "debug" || isDebugEnabled()) {
    if (data === undefined) fn(`[TAF][${scope}] ${msg}`);
    else fn(`[TAF][${scope}] ${msg}`, data);
  }
  notify();
}

export const logger = {
  debug: (scope: string, msg: string, data?: unknown) => log("debug", scope, msg, data),
  info: (scope: string, msg: string, data?: unknown) => log("info", scope, msg, data),
  warn: (scope: string, msg: string, data?: unknown) => log("warn", scope, msg, data),
  error: (scope: string, msg: string, data?: unknown) => log("error", scope, msg, data),
};

export function getLogs(): LogEntry[] {
  return buffer;
}

export function clearLogs() {
  buffer = [];
  notify();
}

export function subscribeLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDebugEnabled(): boolean {
  if (!isBrowser()) return false;
  try {
    if (new URLSearchParams(window.location.search).get("debug") === "1") return true;
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDebugEnabled(on: boolean) {
  if (!isBrowser()) return;
  try {
    if (on) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent("tafinance:debug", { detail: on }));
}

/** Captura errores globales una sola vez y expone window.__taf. */
export function installGlobalLogging() {
  if (!isBrowser() || installed) return;
  installed = true;

  window.addEventListener("error", (e) => {
    log("error", "window", e.message || "error", {
      file: e.filename,
      line: e.lineno,
      col: e.colno,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    log("error", "promise", "Promesa rechazada sin capturar", e.reason);
  });
  window.addEventListener("online", () => log("info", "net", "Conexión recuperada"));
  window.addEventListener("offline", () => log("warn", "net", "Sin conexión"));

  (window as any).__taf = {
    get logs() {
      return buffer;
    },
    dump: () => console.table(buffer.map((l) => ({ t: new Date(l.ts).toLocaleTimeString(), level: l.level, scope: l.scope, msg: l.msg }))),
    clear: clearLogs,
    enable: () => setDebugEnabled(true),
    disable: () => setDebugEnabled(false),
  };

  log("info", "boot", "Logger iniciado", { ua: navigator.userAgent, online: navigator.onLine });
}
