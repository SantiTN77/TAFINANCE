"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles, Check, AlertCircle } from "lucide-react";

export type OrbState = "idle" | "listening" | "processing" | "success" | "error";

interface VoiceOrbProps {
  state: OrbState;
  volume?: number; // 0 to 1
  onClick?: () => void;
  size?: number;
  className?: string;
}

export function VoiceOrb({
  state,
  volume = 0,
  onClick,
  size = 180,
  className = "",
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canvas wave animations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let step = 0;

    const render = () => {
      step += 0.04;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = size * 0.35;

      // Dynamic reactive radius
      const currentRadius =
        state === "listening"
          ? baseRadius + volume * 35 + Math.sin(step * 3) * 6
          : state === "processing"
          ? baseRadius + Math.sin(step * 5) * 8
          : baseRadius + Math.sin(step) * 4;

      // Outer halo rings
      if (state === "listening" || state === "processing") {
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          const ringRadius = currentRadius + i * 16 + Math.sin(step * 2 + i) * 8;
          ctx.arc(centerX, centerY, Math.max(10, ringRadius), 0, Math.PI * 2);
          ctx.strokeStyle =
            state === "listening"
              ? `rgba(16, 185, 129, ${0.4 / i})`
              : `rgba(139, 92, 246, ${0.4 / i})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }

      // Main core gradient
      const gradient = ctx.createRadialGradient(
        centerX - currentRadius * 0.2,
        centerY - currentRadius * 0.2,
        currentRadius * 0.1,
        centerX,
        centerY,
        currentRadius
      );

      if (state === "error") {
        gradient.addColorStop(0, "#FB7185");
        gradient.addColorStop(0.5, "#E11D48");
        gradient.addColorStop(1, "#881337");
      } else if (state === "success") {
        gradient.addColorStop(0, "#34D399");
        gradient.addColorStop(0.5, "#059669");
        gradient.addColorStop(1, "#064E3B");
      } else if (state === "processing") {
        gradient.addColorStop(0, "#C084FC");
        gradient.addColorStop(0.4, "#8B5CF6");
        gradient.addColorStop(0.8, "#3B82F6");
        gradient.addColorStop(1, "#1E1B4B");
      } else if (state === "listening") {
        gradient.addColorStop(0, "#6EE7B7");
        gradient.addColorStop(0.4, "#10B981");
        gradient.addColorStop(0.8, "#06B6D4");
        gradient.addColorStop(1, "#0F172A");
      } else {
        // Idle MoneAI luxury palette
        gradient.addColorStop(0, "#A7F3D0");
        gradient.addColorStop(0.3, "#059669");
        gradient.addColorStop(0.7, "#0284C7");
        gradient.addColorStop(1, "#030712");
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.shadowColor =
        state === "error"
          ? "rgba(225, 29, 72, 0.7)"
          : state === "processing"
          ? "rgba(139, 92, 246, 0.8)"
          : "rgba(16, 185, 129, 0.7)";
      ctx.shadowBlur = state === "listening" ? 35 : 22;
      ctx.fill();

      // Atmospheric specular highlight
      ctx.beginPath();
      ctx.arc(
        centerX - currentRadius * 0.3,
        centerY - currentRadius * 0.35,
        currentRadius * 0.28,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.shadowBlur = 0;
      ctx.fill();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [state, volume, size]);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center cursor-pointer select-none ${className}`}
      style={{ width: size, height: size }}
      role="button"
      tabIndex={0}
      aria-label="Asistente de Voz"
    >
      {/* Background glow circle */}
      <motion.div
        animate={{
          scale: state === "listening" ? [1, 1.25, 1] : state === "processing" ? [1, 1.15, 1] : [1, 1.05, 1],
          opacity: state === "listening" ? [0.4, 0.7, 0.4] : 0.3,
        }}
        transition={{
          repeat: Infinity,
          duration: state === "listening" ? 1.5 : 3.5,
          ease: "easeInOut",
        }}
        className={`absolute inset-0 rounded-full blur-3xl pointer-events-none ${
          state === "error"
            ? "bg-rose-600/40"
            : state === "processing"
            ? "bg-violet-600/50"
            : "bg-emerald-500/40"
        }`}
      />

      {/* Canvas rendering */}
      <canvas
        ref={canvasRef}
        width={size * 1.6}
        height={size * 1.6}
        className="absolute pointer-events-none"
        style={{ width: size * 1.6, height: size * 1.6 }}
      />

      {/* Center Icon Indicator */}
      <div className="relative z-10 flex items-center justify-center text-white drop-shadow-md">
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
            >
              <Mic className="w-8 h-8 text-white/90" />
            </motion.div>
          )}

          {state === "listening" && (
            <motion.div
              key="listening"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.15, 1], opacity: 1 }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Mic className="w-9 h-9 text-emerald-100" />
            </motion.div>
          )}

          {state === "processing" && (
            <motion.div
              key="processing"
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            >
              <Sparkles className="w-8 h-8 text-violet-200" />
            </motion.div>
          )}

          {state === "success" && (
            <motion.div
              key="success"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
            >
              <Check className="w-9 h-9 text-emerald-200" strokeWidth={3} />
            </motion.div>
          )}

          {state === "error" && (
            <motion.div
              key="error"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <AlertCircle className="w-8 h-8 text-rose-200" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
