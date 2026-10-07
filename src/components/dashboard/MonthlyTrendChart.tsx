"use client";

import React, { useMemo, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { TrendingUp } from "lucide-react";
import { buildHistory } from "@/lib/finance/calc";
import { Transaction } from "@/types/finance";
import { useApp } from "@/lib/context/AppContext";

interface MonthlyTrendChartProps {
  totalBalance: number;
  transactions: Transaction[];
}

const RANGES = [7, 30, 90] as const;

/** Evolución del patrimonio recalculada en vivo a partir de las transacciones. */
export function MonthlyTrendChart({ totalBalance, transactions }: MonthlyTrendChartProps) {
  const { formatMoney } = useApp();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const history = useMemo(() => buildHistory(totalBalance, transactions, range), [totalBalance, transactions, range]);

  const width = 340;
  const height = 150;
  const px = 14;
  const py = 18;

  const balances = history.map((h) => h.balance);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const spread = max - min || 1;

  const points = history.map((h, i) => ({
    x: px + (i / Math.max(1, history.length - 1)) * (width - px * 2),
    y: height - py - ((h.balance - min) / spread) * (height - py * 2),
    ...h,
  }));

  const pathD = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = arr[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }, "");
  const areaD = `${pathD} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

  const hasMovement = max !== min;
  const shown = active !== null ? points[active] : points[points.length - 1];
  const change = history[history.length - 1].balance - history[0].balance;

  const handleMove = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = (clientX - rect.left) / rect.width;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1)))));
  };

  return (
    <GlassCard className="p-4 w-full">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider truncate">Evolución del patrimonio</h3>
        </div>
        <div className="flex items-center bg-inset p-0.5 rounded-full border border-white/[0.06] shrink-0">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r);
                setActive(null);
              }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                range === r ? "bg-indigo-500 text-on-accent shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-1">
        <p className="text-lg font-black text-white tabular-nums">{formatMoney(shown.balance)}</p>
        <p className={`text-[11px] font-semibold ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {change >= 0 ? "+" : ""}
          {formatMoney(change)} en {range} días
        </p>
      </div>
      <p className="text-[10px] text-slate-500 mb-1">{shown.date}</p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none touch-pan-y"
        onPointerMove={(e) => handleMove(e.clientX)}
        onPointerLeave={() => setActive(null)}
        role="img"
        aria-label="Gráfica de evolución del patrimonio"
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="55%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={px} x2={width - px} y1={py + f * (height - py * 2)} y2={py + f * (height - py * 2)} stroke="rgb(var(--c-ink) / 0.06)" strokeDasharray="3 4" />
        ))}

        {hasMovement ? (
          <>
            <path d={areaD} fill="url(#trendGradient)" />
            <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : (
          <line x1={px} x2={width - px} y1={height / 2} y2={height / 2} stroke="url(#lineGradient)" strokeWidth="2.5" strokeLinecap="round" />
        )}

        {active !== null && (
          <>
            <line x1={shown.x} x2={shown.x} y1={py - 6} y2={height - py + 6} stroke="rgb(var(--c-ink) / 0.2)" />
            <circle cx={shown.x} cy={shown.y} r="5" fill="rgb(var(--c-app))" stroke="#10B981" strokeWidth="2.5" />
          </>
        )}
        {active === null && (
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4.5" fill="rgb(var(--c-app))" stroke="#10B981" strokeWidth="2.5" />
        )}
      </svg>

      <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
        <span>{history[0].date}</span>
        <span>hoy</span>
      </div>
    </GlassCard>
  );
}
