"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { financeStore } from "@/lib/storage/finance-store";
import { buildSummary, buildReminders, upcomingItems, monthKey } from "@/lib/finance/calc";

/**
 * Datos financieros en tiempo real: se recalculan en cada cambio emitido por el store
 * (nuevo movimiento, borrado, sincronización remota, otra pestaña…).
 */
export function useFinance(month: string = monthKey()) {
  const version = useSyncExternalStore(
    financeStore.subscribe,
    financeStore.getVersion,
    () => 0
  );

  // El servidor no conoce los datos del navegador: el primer render del cliente debe coincidir
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    financeStore.start();
  }, []);

  return useMemo(() => {
    const snap = mounted
      ? financeStore.snapshot()
      : { ...financeStore.snapshot(), transactions: [], pockets: [], budgets: [], hydrated: false, pending: 0, syncState: "idle" as const };
    const summary = buildSummary(
      snap.accounts,
      snap.categories,
      snap.transactions,
      snap.budgets,
      snap.pockets,
      month
    );
    return {
      ...snap,
      summary,
      upcoming: upcomingItems(snap.accounts, snap.transactions),
      reminders: buildReminders(snap.accounts, snap.transactions),
      version,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, month, mounted]);
}
