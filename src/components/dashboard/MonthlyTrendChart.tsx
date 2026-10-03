"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { TrendingUp, Calendar } from "lucide-react";

interface MonthlyTrendChartProps {
  history: { date: string; balance: number }[];
}

export function MonthlyTrendChart({ history }: MonthlyTrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; balance: number } | null>(null);

  if (!history || history.length === 0) return null;

  const width = 340;
  const height = 140;
  const paddingX = 25;
  const paddingY = 20;

  const balances = history.map((h) => h.balance);
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);
  const range = maxBalance - minBalance || 1;

  // Compute SVG coordinates
  const points = history.map((item, index) => {
    const x = paddingX + (index / (history.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((item.balance - minBalance) / range) * (height - paddingY * 2);
    return { x, y, ...item };
  });

  // Generate smooth SVG curve path
  const pathD = points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const prev = arr[i - 1];
    const cpX = (prev.x + point.x) / 2;
    return `${acc} C ${cpX},${prev.y} ${cpX},${point.y} ${point.x},${point.y}`;
  }, "");

  // Generate filled area under curve
  const areaD = `${pathD} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

  return (
    <GlassCard className="p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Evolución del Patrimonio
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Calendar className="w-3 h-3" /> Últimos 7 días
        </span>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full flex justify-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#06B6D4" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#070A11" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill="url(#trendGradient)" />

          {/* Glowing Stroke Line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Data Points */}
          {points.map((p, idx) => (
            <g key={idx} className="cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#070A11"
                stroke="#10B981"
                strokeWidth="2.5"
                className="transition-all hover:scale-125"
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </g>
          ))}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-0 right-4 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-xs shadow-lg pointer-events-none">
            <span className="text-slate-400 text-[10px]">{hoveredPoint.date}: </span>
            <span className="font-bold text-emerald-300">
              ${hoveredPoint.balance.toLocaleString("es-CO")} COP
            </span>
          </div>
        )}
      </div>

      {/* Date Labels */}
      <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-2">
        {history.map((h, i) => (
          <span key={i}>{h.date}</span>
        ))}
      </div>
    </GlassCard>
  );
}
