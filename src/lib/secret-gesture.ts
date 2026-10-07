"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Acceso secreto sobre el logo (sin botones visibles):
 *   1) 7 toques rápidos
 *   2) mantener presionado 3 segundos
 *   3) 10 toques rápidos más
 * Cualquier error reinicia la secuencia sin ninguna pista visual.
 */

const TAPS_BEFORE = 7;
const HOLD_MS = 3000;
const TAPS_AFTER = 10;
const TAP_MAX_MS = 600; // un "toque" dura menos que esto
const TAP_GAP_MS = 2000; // pausa máxima entre toques
const HOLD_START_WINDOW_MS = 4000; // tiempo para empezar a mantener tras el 7º toque
const AFTER_HOLD_WINDOW_MS = 5000; // tiempo para el primer toque tras soltar

type Phase = "before" | "hold" | "after";

export function useSecretGesture(onSuccess: () => void) {
  const phase = useRef<Phase>("before");
  const count = useRef(0);
  const lastEvent = useRef(0);
  const downAt = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdReached = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const reset = useCallback(() => {
    phase.current = "before";
    count.current = 0;
    holdReached.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }, []);

  useEffect(() => () => reset(), [reset]);

  const onPointerDown = useCallback(() => {
    const now = Date.now();
    downAt.current = now;
    if (phase.current === "hold") {
      if (now - lastEvent.current > HOLD_START_WINDOW_MS) {
        reset();
        return;
      }
      holdReached.current = false;
      holdTimer.current = setTimeout(() => {
        holdReached.current = true;
        try {
          navigator.vibrate?.(25); // confirmación táctil discreta
        } catch {}
      }, HOLD_MS);
    }
  }, [reset]);

  const onPointerUp = useCallback(() => {
    const now = Date.now();
    const pressed = now - downAt.current;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    if (phase.current === "hold") {
      if (holdReached.current && pressed >= HOLD_MS) {
        phase.current = "after";
        count.current = 0;
        lastEvent.current = now;
      } else {
        reset();
      }
      return;
    }

    // Fase de toques (antes o después de la pulsación larga)
    if (pressed > TAP_MAX_MS) {
      reset();
      return;
    }
    const limit = phase.current === "after" && count.current === 0 ? AFTER_HOLD_WINDOW_MS : TAP_GAP_MS;
    if (lastEvent.current && now - lastEvent.current > limit && count.current > 0) {
      // pausa demasiado larga: este toque empieza de nuevo
      reset();
    } else if (phase.current === "after" && count.current === 0 && now - lastEvent.current > AFTER_HOLD_WINDOW_MS) {
      reset();
    }
    count.current += 1;
    lastEvent.current = now;

    if (phase.current === "before" && count.current >= TAPS_BEFORE) {
      phase.current = "hold";
    } else if (phase.current === "after" && count.current >= TAPS_AFTER) {
      reset();
      onSuccessRef.current();
    }
  }, [reset]);

  const onPointerCancel = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (phase.current === "hold") reset();
  }, [reset]);

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  };
}
