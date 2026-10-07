"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PieChart, Utensils, Car, Sparkles, Zap, ShoppingBag, HeartPulse, Circle, ShoppingCart, Home, Laptop, Coffee, Briefcase, TrendingUp } from "lucide-react";

interface CategoryBreakdownChartProps {
  categories: {
    categoryId: string;
    categoryName: string;
    color: string;
    icon: string;
    total: number;
    percentage: number;
  }[];
}

const ICON_MAP: Record<string, any> = {
  Utensils,
  Car,
  Sparkles,
  Zap,
  ShoppingBag,
  HeartPulse,
  ShoppingCart,
  Home,
  Laptop,
  Coffee,
  Briefcase,
  TrendingUp,
};

export function CategoryBreakdownChart({ categories }: CategoryBreakdownChartProps) {
  if (!categories || categories.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <PieChart className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-xs text-slate-400">Aún no hay gastos registrados en este mes.</p>
      </GlassCard>
    );
  }

  // Calculate SVG donut segments
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <GlassCard className="p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <PieChart className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Distribución de Gastos
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">Por Categoría</span>
      </div>

      <div className="flex flex-col items-center sm:flex-row sm:justify-around gap-4">
        {/* SVG Donut */}
        <div className="relative flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgb(var(--c-ink) / 0.07)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {categories.map((cat, i) => {
              const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += cat.percentage;

              return (
                <circle
                  key={cat.categoryId || i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={cat.color || "#10B981"}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="butt"
                  fill="transparent"
                  className="transition-all duration-500 hover:opacity-80"
                />
              );
            })}
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-xs font-bold text-white">{categories.length}</span>
            <span className="text-[9px] text-slate-400 uppercase">Rubros</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex-1 w-full space-y-2 mt-2 sm:mt-0">
          {categories.map((cat) => {
            const IconComponent = ICON_MAP[cat.icon] || Circle;
            return (
              <div key={cat.categoryId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: `${cat.color}25`, border: `1px solid ${cat.color}50` }}
                  >
                    <IconComponent className="w-3 h-3" style={{ color: cat.color }} />
                  </div>
                  <span className="text-slate-300 truncate max-w-[130px] sm:max-w-[170px]">{cat.categoryName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">
                    ${cat.total.toLocaleString("es-CO")}
                  </span>
                  <span className="text-[10px] text-slate-400 w-8 text-right">
                    {cat.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
