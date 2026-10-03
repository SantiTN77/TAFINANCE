import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: boolean;
  className?: string;
}

export function GlassCard({
  children,
  glow = false,
  className,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          "rounded-3xl border transition-all duration-300",
          glow
            ? "bg-[#0D1322]/80 backdrop-blur-2xl border-emerald-500/30 shadow-[0_0_30px_-5px_rgba(16,185,129,0.18)]"
            : "bg-[#0D1322]/60 backdrop-blur-xl border-white/[0.08] hover:border-white/[0.14] shadow-lg shadow-black/40",
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}
