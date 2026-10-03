"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Download,
  Smartphone,
  Wallet,
  Camera,
  TrendingUp,
  Cpu,
  Lock,
  Globe,
  Github,
  Check,
  Copy,
  Layers,
  Zap,
  Terminal,
  ChevronRight,
  Share2,
} from "lucide-react";
import { useApp } from "@/lib/context/AppContext";

export default function LandingPage() {
  const { theme, setTheme, language, setLanguage } = useApp();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);

  // Check existing session
  useEffect(() => {
    fetch("/api/auth/check")
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(data.authenticated))
      .catch(() => setIsAuthenticated(false));

    // PWA Install prompt listener
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowPwaModal(true);
    }
  };

  const copyMcpUrl = () => {
    navigator.clipboard.writeText("https://tafinance.vercel.app/api/mcp");
    setCopiedMcp(true);
    setTimeout(() => setCopiedMcp(false), 2500);
  };

  const isEs = language === "es";

  return (
    <div className="min-h-screen bg-[#070A11] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300 overflow-x-hidden">
      {/* Background Radial Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl opacity-60" />
        <div className="absolute top-1/3 -left-48 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-2/3 -right-48 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      {/* Navigation Header */}
      <header className="relative z-20 w-full border-b border-white/[0.06] backdrop-blur-xl bg-[#070A11]/80 sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-[1.5px] shadow-[0_0_15px_rgba(16,185,129,0.35)] group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#070A11] rounded-[10px] flex items-center justify-center">
                <span className="text-xs font-black text-white tracking-tighter">TA</span>
              </div>
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                TAFINANCE
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  v2.0 PRO
                </span>
              </span>
            </div>
          </Link>

          {/* Quick Settings & Navigation */}
          <div className="flex items-center gap-3">
            {/* Language Switch */}
            <button
              onClick={() => setLanguage(isEs ? "en" : "es")}
              className="px-2.5 py-1 rounded-xl bg-slate-900/80 border border-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
              title="Cambiar idioma / Switch language"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isEs ? "ES" : "EN"}</span>
            </button>

            {/* GitHub Repo */}
            <a
              href="https://github.com/SantiTN77/TAFINANCE"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-900/80 border border-white/[0.08] text-slate-400 hover:text-white transition-colors hidden sm:flex"
              title="Ver código fuente en GitHub"
            >
              <Github className="w-4 h-4" />
            </a>

            {/* Auth CTA */}
            <Link
              href="/app"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-xs font-bold text-slate-950 flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {isAuthenticated ? (isEs ? "Ir a mi Bóveda" : "Open Vault") : (isEs ? "Acceso Propietario" : "Owner Login")}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-12 pb-16 px-4 sm:px-6 max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Release Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold mb-6 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{isEs ? "Bóveda Privada Personal + Gemini 3.8 Flash + Supabase" : "Personal Financial Vault + Gemini 3.8 Flash + Supabase"}</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white max-w-3xl leading-[1.12]">
          {isEs ? (
            <>
              Inteligencia Financiera Personal con{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                IA Multimodal en Tiempo Real
              </span>
            </>
          ) : (
            <>
              Personal Financial Intelligence with{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Real-Time Multimodal AI
              </span>
            </>
          )}
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          {isEs
            ? "Tu centro de control financiero privado. Diseñado para alta precisión con bolsillos inteligentes, escaneo neuronal de facturas físicas con cámara, proyección matemática de liquidez a 30 días y servidor MCP para conectar tus agentes autónomos."
            : "Your private financial command center. Designed for precision with smart pockets, neural receipt camera scanning, 30-day mathematical cash flow projections, and an MCP server for autonomous agents."}
        </p>

        {/* Main CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full max-w-md">
          <Link
            href="/app"
            className="flex-1 sm:flex-initial px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 hover:opacity-95 transition-all group"
          >
            <span>{isEs ? "Entrar a mi Bóveda" : "Access Vault"}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <button
            onClick={handleInstallClick}
            className="flex-1 sm:flex-initial px-5 py-3.5 rounded-2xl bg-[#0D1322] border border-white/[0.12] hover:border-emerald-500/40 text-slate-200 hover:text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>{isInstalled ? (isEs ? "App Instalada" : "App Installed") : (isEs ? "Instalar PWA Móvil" : "Install Mobile PWA")}</span>
          </button>
        </div>

        {/* Sub-badge: Private & Secure */}
        <div className="mt-6 flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{isEs ? "Cifrado PBKDF2 + WebAuthn" : "PBKDF2 + WebAuthn Passkeys"}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>{isEs ? "PostgreSQL Supabase con RLS" : "Supabase PostgreSQL + RLS"}</span>
          </div>
        </div>

        {/* Interactive App Preview Showcase Card */}
        <div className="mt-12 w-full max-w-3xl rounded-3xl bg-[#0B101D] border border-white/[0.08] shadow-[0_0_50px_rgba(0,0,0,0.8)] p-4 sm:p-6 text-left relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar inside mockup */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-xs font-mono text-slate-400">tafinance-vault://live-dashboard</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {isEs ? "Modo Cero-Mock Activo" : "Zero-Mock Active"}
            </span>
          </div>

          {/* Mockup Body: 3-column preview */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Smart Forecast */}
            <div className="p-4 rounded-2xl bg-[#12192B] border border-white/[0.06] flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                  {isEs ? "Flujo Proyectado" : "Cash Flow Projection"}
                </span>
                <p className="text-xl font-black text-white mt-2">$0.00 COP</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isEs ? "Proyección a 30 días calculada en tiempo real según tu ritmo de gasto." : "30-day mathematical projection calculated live from spending pacing."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.04] text-[10px] text-teal-300 font-medium">
                {isEs ? "✓ 0% Burn-rate riesgo" : "✓ 0% Burn-rate risk"}
              </div>
            </div>

            {/* Card 2: Bolsillos / Smart Pockets */}
            <div className="p-4 rounded-2xl bg-[#12192B] border border-white/[0.06] flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  {isEs ? "Bolsillos Inteligentes" : "Smart Pockets"}
                </span>
                <p className="text-xl font-black text-white mt-2">{isEs ? "Ahorro Blindado" : "Shielded Savings"}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isEs ? "Separa fondos de emergencia, inversiones y gustos sin mezclarlos con el saldo corriente." : "Isolate emergency funds, investments, and goals safely from daily balance."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.04] text-[10px] text-emerald-400 font-medium">
                {isEs ? "✓ Piloto automático de metas" : "✓ Target autopilot enabled"}
              </div>
            </div>

            {/* Card 3: Gemini Copilot */}
            <div className="p-4 rounded-2xl bg-[#12192B] border border-white/[0.06] flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  {isEs ? "Copiloto Gemini 3.8" : "Gemini 3.8 Copilot"}
                </span>
                <p className="text-xl font-black text-white mt-2">{isEs ? "Dictado & Chat" : "Speech & Chat"}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isEs ? "«Registra almuerzo de $25.000 y descuéntalo del bolsillo de comida»" : "«Log lunch for $25.000 and deduct from food pocket»"}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.04] text-[10px] text-cyan-300 font-medium">
                {isEs ? "✓ Procesamiento semántico instantáneo" : "✓ Instant semantic understanding"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="relative z-10 py-16 px-4 sm:px-6 max-w-6xl mx-auto border-t border-white/[0.06]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            {isEs ? "Ingeniería de Grado Financiero" : "Financial-Grade Engineering"}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-400">
            {isEs
              ? "Diseñado sin plantillas ni componentes genéricos: arquitectura limpia, tipado estricto y cero dependencias innecesarias."
              : "Built without generic templates: clean architecture, strict typing, and zero bloated dependencies."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1: Copiloto Gemini */}
          <div className="p-6 rounded-3xl bg-[#0D1322] border border-white/[0.08] hover:border-emerald-500/30 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                {isEs ? "Copiloto IA con Gemini 3.8 Flash" : "AI Copilot with Gemini 3.8 Flash"}
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {isEs
                  ? "Dicta gastos en lenguaje cotidiano o conversa con tu asesor contable virtual. Interpreta montos, monedas, categorías y sugiere transferencias preventivas."
                  : "Dictate expenses in natural language or chat with your virtual accounting advisor. Extracts amounts, currencies, categories and suggests proactive transfers."}
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-white/[0.06] flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
              <span>{isEs ? "Dictado por voz nativo" : "Native speech dictation"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Feature 2: Bolsillos */}
          <div className="p-6 rounded-3xl bg-[#0D1322] border border-white/[0.08] hover:border-teal-500/30 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4 group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                {isEs ? "Bolsillos & Metas Blindadas" : "Smart Pockets & Goals"}
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {isEs
                  ? "Organiza tu dinero en compartimentos virtuales con barras de progreso y metas. Transfiere fondos entre tu balance general y tus bolsillos con un toque."
                  : "Organize your money in dedicated virtual buckets with progress bars and targets. Move funds between main balance and pockets with one tap."}
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-white/[0.06] flex items-center gap-1.5 text-[11px] text-teal-400 font-semibold">
              <span>{isEs ? "Ahorro en piloto automático" : "Autopilot savings target"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Feature 3: OCR Recibos */}
          <div className="p-6 rounded-3xl bg-[#0D1322] border border-white/[0.08] hover:border-cyan-500/30 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                {isEs ? "Escáner Láser de Recibos (OCR)" : "Laser Receipt Scanner (OCR)"}
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {isEs
                  ? "Toma foto a cualquier recibo o factura física. El modelo multimodal desglosa los ítems línea por línea y te permite asociar cada gasto a un bolsillo distinto."
                  : "Snap a photo of any receipt. Multimodal OCR parses line-items one by one and lets you assign individual items directly into distinct pockets."}
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-white/[0.06] flex items-center gap-1.5 text-[11px] text-cyan-400 font-semibold">
              <span>{isEs ? "División automática de ítems" : "Automated item splitting"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* Developer Architecture & Remote MCP Server Section */}
      <section className="relative z-10 py-16 px-4 sm:px-6 max-w-6xl mx-auto border-t border-white/[0.06]">
        <div className="p-6 sm:p-10 rounded-3xl bg-[#0B101D] border border-white/[0.08] relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-semibold mb-4">
                <Cpu className="w-3.5 h-3.5" />
                <span>{isEs ? "Conexión para Agentes IA (Google Spark & Claude)" : "AI Agent Connection (Google Spark & Claude)"}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {isEs ? "Servidor Remoto MCP Integrado" : "Built-In Remote MCP Server"}
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {isEs
                  ? "TAFINANCE implementa el estándar abierto Model Context Protocol (MCP) a través de Server-Sent Events (SSE) y JSON-RPC 2.0. Puedes conectar Google Spark, Cursor o Claude Desktop para consultar saldos, crear bolsillos y registrar transacciones sin abrir el navegador."
                  : "TAFINANCE implements the open Model Context Protocol (MCP) standard via SSE and JSON-RPC 2.0. Connect Google Spark, Cursor, or Claude Desktop to query balances, create pockets, and log expenses without opening a browser."}
              </p>

              {/* URL Box */}
              <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-2 p-2 rounded-2xl bg-[#070A11] border border-white/[0.1]">
                <div className="flex-1 px-3 py-2 text-xs font-mono text-emerald-400 truncate flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="truncate">https://tafinance.vercel.app/api/mcp</span>
                </div>
                <button
                  onClick={copyMcpUrl}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedMcp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMcp ? (isEs ? "¡Copiado!" : "Copied!") : (isEs ? "Copiar URL" : "Copy URL")}</span>
                </button>
              </div>
            </div>

            {/* Tech Stack List */}
            <div className="bg-[#12192B] p-6 rounded-2xl border border-white/[0.06] space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isEs ? "Stack Tecnológico de Grado de Producción" : "Production-Grade Tech Stack"}
              </h4>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60">
                  <span className="font-semibold text-white">Next.js 15 (App Router)</span>
                  <span className="text-[11px] text-emerald-400">React 19 + Turbopack</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60">
                  <span className="font-semibold text-white">Supabase PostgreSQL</span>
                  <span className="text-[11px] text-teal-400">Row Level Security (RLS)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60">
                  <span className="font-semibold text-white">Google Gemini 3.8 / 3.5</span>
                  <span className="text-[11px] text-cyan-400">SDK @google/genai</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60">
                  <span className="font-semibold text-white">WebAuthn Biometrics</span>
                  <span className="text-[11px] text-violet-400">Passkeys / Fingerprint</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60">
                  <span className="font-semibold text-white">PWA Standalone</span>
                  <span className="text-[11px] text-amber-400">Manifest + Offline Cache</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PWA Install Modal */}
      {showPwaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl bg-[#0D1322] border border-white/[0.1] p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
              <Download className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-white">
              {isEs ? "Cómo Instalar TAFINANCE" : "How to Install TAFINANCE"}
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {isEs
                ? "Para instalar la aplicación como una PWA nativa en tu dispositivo móvil:"
                : "To install this application as a native PWA on your mobile phone:"}
            </p>

            <div className="mt-4 w-full bg-slate-900/70 p-3.5 rounded-2xl text-left space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-400">iOS:</span>
                <span>Toca el botón <strong>Compartir</strong> (Share) y luego selecciona <strong>«Agregar a pantalla de inicio»</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-teal-400">Android:</span>
                <span>Toca el menú de tres puntos ⋮ en Chrome y presiona <strong>«Instalar aplicación»</strong>.</span>
              </div>
            </div>

            <button
              onClick={() => setShowPwaModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 transition-colors"
            >
              {isEs ? "Entendido" : "Got it"}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-white/[0.06] py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">TAFINANCE PRO</span>
            <span>—</span>
            <span>Desarrollado como proyecto personal por Santi Tafur</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <a
              href="https://github.com/SantiTN77/TAFINANCE"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <span>•</span>
            <Link href="/lock" className="hover:text-white transition-colors">
              {isEs ? "Bóveda" : "Vault"}
            </Link>
            <span>•</span>
            <Link href="/api/mcp" className="hover:text-white transition-colors">
              MCP API
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
