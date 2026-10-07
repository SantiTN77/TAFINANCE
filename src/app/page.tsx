"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Camera,
  Wallet,
  CreditCard,
  LineChart,
  BellRing,
  ShieldCheck,
  WifiOff,
  Globe,
  Moon,
  Sun,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { useSecretGesture } from "@/lib/secret-gesture";

export default function LandingPage() {
  const router = useRouter();
  const { theme, setTheme, language, setLanguage } = useApp();
  const isEs = language === "es";

  // El logo es el único acceso: 7 toques → mantener 3 s → 10 toques
  const gesture = useSecretGesture(() => router.push("/lock"));

  const features = [
    {
      icon: Mic,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      title: isEs ? "Dilo y listo" : "Just say it",
      text: isEs
        ? "«Gasté 45 mil en almuerzo». La app entiende monto, categoría y fecha, y lo registra por ti."
        : "“Spent 45k on lunch”. The app understands amount, category and date and logs it for you.",
    },
    {
      icon: Camera,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      title: isEs ? "Escanea tus facturas" : "Scan your receipts",
      text: isEs
        ? "Toma una foto del recibo y se extraen comercio, total e ítems automáticamente."
        : "Snap a receipt and the merchant, total and items are extracted automatically.",
    },
    {
      icon: Wallet,
      color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      title: isEs ? "Bolsillos de ahorro" : "Savings pockets",
      text: isEs
        ? "Separa dinero para metas y emergencias sin mezclarlo con tu saldo del día a día."
        : "Set money aside for goals and emergencies without mixing it with your daily balance.",
    },
    {
      icon: CreditCard,
      color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
      title: isEs ? "Tarjetas bajo control" : "Cards under control",
      text: isEs
        ? "Recordatorios de corte y de pago para que no se te pase una fecha y aproveches los días de financiación."
        : "Cut-off and payment reminders so you never miss a date and make the most of the grace days.",
    },
    {
      icon: LineChart,
      color: "text-indigo2 bg-indigo2/10 border-indigo2/20",
      title: isEs ? "Estadísticas en tiempo real" : "Real-time stats",
      text: isEs
        ? "Cada ingreso o gasto actualiza al instante tus totales, gráficas y el cierre del mes."
        : "Every income or expense instantly updates your totals, charts and month-end summary.",
    },
    {
      icon: BellRing,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      title: isEs ? "Avisos en tu móvil" : "Mobile alerts",
      text: isEs
        ? "Notificaciones aunque la app esté cerrada: pagos próximos, cortes y compromisos."
        : "Notifications even when the app is closed: upcoming payments, cut-offs and commitments.",
    },
  ];

  const steps = [
    { n: "1", t: isEs ? "Registra" : "Log", d: isEs ? "Con voz, texto, foto o a mano." : "By voice, text, photo or by hand." },
    { n: "2", t: isEs ? "Organiza" : "Organize", d: isEs ? "Categorías, bolsillos y tarjetas." : "Categories, pockets and cards." },
    { n: "3", t: isEs ? "Decide" : "Decide", d: isEs ? "Mira cuánto tienes y cuánto te queda." : "See what you have and what's left." },
  ];

  return (
    <div className="min-h-screen bg-app text-white flex flex-col overflow-x-hidden selection:bg-emerald-500/30">
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] max-w-full h-[450px] bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-1/3 -left-48 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-2/3 -right-48 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 w-full border-b border-white/[0.06] backdrop-blur-xl bg-app/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between pt-[env(safe-area-inset-top)]">
          {/* Logo = acceso secreto (sin ningún indicio visual) */}
          <div
            {...gesture}
            style={{ touchAction: "none" }}
            className="flex items-center gap-2.5 no-select cursor-default"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-[1.5px] shadow-[0_0_15px_rgba(16,185,129,0.35)]">
              <div className="w-full h-full bg-app rounded-[10px] flex items-center justify-center">
                <span className="text-xs font-black text-white tracking-tighter">TA</span>
              </div>
            </div>
            <span className="text-base font-bold tracking-tight text-white">TAFINANCE</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={isEs ? "Cambiar tema" : "Toggle theme"}
              className="w-9 h-9 rounded-xl bg-slate-900/80 border border-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setLanguage(isEs ? "en" : "es")}
              className="h-9 px-3 rounded-xl bg-slate-900/80 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
              aria-label={isEs ? "Cambiar idioma" : "Switch language"}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              {isEs ? "ES" : "EN"}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="px-4 sm:px-6 pt-14 sm:pt-20 pb-12 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            {isEs ? "Finanzas personales con voz e IA" : "Personal finance with voice & AI"}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.1]">
            {isEs ? "Tu plata, " : "Your money, "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              {isEs ? "clara y sin esfuerzo" : "clear and effortless"}
            </span>
          </h1>
          <p className="mt-5 text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            {isEs
              ? "Registra lo que gastas con tu voz, organiza tus ahorros y tarjetas, y recibe avisos antes de cada pago. Todo en una app privada que funciona también sin conexión."
              : "Log what you spend with your voice, organize your savings and cards, and get alerts before every payment. All in a private app that also works offline."}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {isEs ? "Acceso privado" : "Private access"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <WifiOff className="w-4 h-4 text-cyan-400" />
              {isEs ? "Funciona sin conexión" : "Works offline"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-amber-400" />
              {isEs ? "Avisos en el móvil" : "Mobile alerts"}
            </span>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 sm:px-6 py-10 max-w-5xl mx-auto border-t border-white/[0.06]">
          <h2 className="text-xl sm:text-2xl font-black text-white text-center mb-8">
            {isEs ? "Todo lo que necesitas" : "Everything you need"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <article key={f.title} className="p-5 rounded-3xl bg-card/80 border border-white/[0.08]">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center mb-4 ${f.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{f.title}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{f.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 sm:px-6 py-10 max-w-3xl mx-auto border-t border-white/[0.06]">
          <h2 className="text-xl sm:text-2xl font-black text-white text-center mb-8">
            {isEs ? "Cómo funciona" : "How it works"}
          </h2>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {steps.map((s) => (
              <li key={s.n} className="p-5 rounded-3xl bg-card/80 border border-white/[0.08] text-center">
                <span className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-400 text-slate-950 font-black text-sm inline-flex items-center justify-center">
                  {s.n}
                </span>
                <h3 className="mt-3 text-sm font-bold text-white">{s.t}</h3>
                <p className="text-xs text-slate-400 mt-1">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-6 px-4 text-center text-xs text-slate-500 safe-bottom">
        © {new Date().getFullYear()} TAFINANCE
      </footer>
    </div>
  );
}
