/**
 * Edición y borrado de movimientos: reglas puras + store en modo local (sin Supabase).
 * Ejecuta: tsx tests/tx-edit.test.ts
 */
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { Transaction } from "../src/types/finance";
import { TxValidationError, applyTxPatch, pocketDeltas, sanitizeTxUpdates } from "../src/lib/finance/tx-edit";

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log("✅", name);
  else {
    failed++;
    console.error("❌", name, extra ?? "");
  }
}
function throws(name: string, fn: () => unknown) {
  try {
    fn();
    check(name, false, "no lanzó error");
  } catch (e) {
    check(name, e instanceof TxValidationError, e);
  }
}
async function rejects(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false, "no lanzó error");
  } catch (e) {
    check(name, e instanceof TxValidationError, e);
  }
}

const base: Transaction = {
  id: "t1",
  type: "EXPENSE",
  amount: 50000,
  currency: "COP",
  description: "Mercado",
  merchant: "Éxito",
  category_id: "cat-food",
  account_id: "acc-main",
  date: "2026-10-01",
  created_at: "2026-10-01T10:00:00Z",
};

/* ------------------------------ reglas puras ------------------------------ */

{
  const { patch, cleared } = sanitizeTxUpdates(base, {
    amount: "75000.456",
    description: "  Mercado grande ",
    id: "hack",
    created_at: "x",
    currency: "USD",
  });
  check("normaliza monto y descripción", patch.amount === 75000.46 && patch.description === "Mercado grande", patch);
  check("ignora campos no editables", !("id" in patch) && !("created_at" in patch) && !("currency" in patch), patch);
  check("sin vaciados", cleared.length === 0);
}

{
  const p = sanitizeTxUpdates(base, { merchant: "", category_id: null });
  check("vaciar comercio y categoría", p.cleared.includes("merchant") && p.cleared.includes("category_id"), p);
  const { next, remote } = applyTxPatch(base, p);
  check("local sin el campo", next.merchant === undefined && !("merchant" in next));
  check("remoto con null", remote.merchant === null && remote.category_id === null, remote);
}

check("gasto → ingreso permitido", sanitizeTxUpdates(base, { type: "INCOME" }).patch.type === "INCOME");
throws("gasto → transferencia rechazado", () => sanitizeTxUpdates(base, { type: "TRANSFER" }));
throws("transferencia → gasto rechazado", () => sanitizeTxUpdates({ ...base, type: "TRANSFER" }, { type: "EXPENSE" }));
throws("monto 0 rechazado", () => sanitizeTxUpdates(base, { amount: 0 }));
throws("monto negativo rechazado", () => sanitizeTxUpdates(base, { amount: -5 }));
throws("monto NaN rechazado", () => sanitizeTxUpdates(base, { amount: "abc" }));
throws("descripción vacía rechazada", () => sanitizeTxUpdates(base, { description: "   " }));
throws("fecha imposible rechazada", () => sanitizeTxUpdates(base, { date: "2026-02-30" }));
throws("fecha mal formada rechazada", () => sanitizeTxUpdates(base, { date: "01/10/2026" }));
throws("periodicidad inválida rechazada", () => sanitizeTxUpdates(base, { recurrence_interval: "DAILY" }));
throws("cuenta destino en gasto rechazada", () => sanitizeTxUpdates(base, { to_account_id: "acc-cash" }));
throws("transferencia a la misma cuenta rechazada", () =>
  sanitizeTxUpdates({ ...base, type: "TRANSFER", to_account_id: "acc-cash" }, { account_id: "acc-cash" })
);

{
  const aporte: Transaction = { ...base, type: "TRANSFER", pocket_id: "p1", amount: 100 };
  check("delta al subir un aporte", pocketDeltas(aporte, { ...aporte, amount: 150 }).get("p1") === 50);
  const moved = pocketDeltas(aporte, { ...aporte, pocket_id: "p2" });
  check("delta al cambiar de bolsillo", moved.get("p1") === -100 && moved.get("p2") === 100, moved);
  check("delta al borrar", pocketDeltas(aporte, null).get("p1") === -100);
  check("gasto con bolsillo no mueve el bolsillo", pocketDeltas({ ...base, pocket_id: "p1" }, null).size === 0);
  check("sin cambio de monto no hay delta", pocketDeltas(aporte, { ...aporte, description: "x" }).size === 0);
}

/* ------------------------------ store (local) ------------------------------ */

async function storeTests() {
  const { financeStore } = await import("../src/lib/storage/finance-store");
  const balanceOf = async (id: string) => (await financeStore.getAccounts()).find((a) => a.id === id)!.balance;
  const totalOf = async () => (await financeStore.getSummary()).totalBalance;

  const income = await financeStore.addTransaction({
    type: "INCOME", amount: 1_000_000, currency: "COP", description: "Salario", account_id: "acc-main", date: "2026-10-01",
  });
  const expense = await financeStore.addTransaction({
    type: "EXPENSE", amount: 200_000, currency: "COP", description: "Mercado", account_id: "acc-main", date: "2026-10-02",
  });
  check("saldo inicial 800.000", (await balanceOf("acc-main")) === 800_000, await balanceOf("acc-main"));

  await financeStore.updateTransaction(expense.id, { amount: 250_000 });
  check("editar monto recalcula saldo", (await balanceOf("acc-main")) === 750_000, await balanceOf("acc-main"));

  await financeStore.updateTransaction(expense.id, { type: "INCOME" });
  check("gasto → ingreso recalcula saldo", (await balanceOf("acc-main")) === 1_250_000, await balanceOf("acc-main"));
  await financeStore.updateTransaction(expense.id, { type: "EXPENSE" });

  await financeStore.updateTransaction(expense.id, { account_id: "acc-cash" });
  check(
    "mover a otra cuenta ajusta ambas",
    (await balanceOf("acc-main")) === 1_000_000 && (await balanceOf("acc-cash")) === -250_000
  );
  check("total coherente tras mover", (await totalOf()) === 750_000, await totalOf());

  await rejects("cuenta inexistente rechazada", () => financeStore.updateTransaction(expense.id, { account_id: "nope" }));
  await rejects("monto inválido rechazado en store", () => financeStore.updateTransaction(expense.id, { amount: -1 }));
  check("edición rechazada no cambia nada", (await financeStore.getTransaction(expense.id))!.amount === 250_000);
  check("editar id inexistente → null", (await financeStore.updateTransaction("nope", { amount: 1 })) === null);

  // Aportes a bolsillo
  const pocket = await financeStore.addPocket({
    name: "Viaje", target_amount: 1_000_000, current_amount: 0, icon: "Plane", color: "#fff", category: "viaje",
  });
  await financeStore.transferToPocket(pocket.id, 100_000, "acc-main");
  const aporte = (await financeStore.getTransactions()).find((t) => t.pocket_id === pocket.id)!;
  const pocketAmount = async () => (await financeStore.getPockets()).find((p) => p.id === pocket.id)!.current_amount;
  const totalBefore = await totalOf();

  await financeStore.updateTransaction(aporte.id, { amount: 150_000 });
  check("editar aporte ajusta el bolsillo", (await pocketAmount()) === 150_000, await pocketAmount());
  check("editar aporte baja la cuenta", (await balanceOf("acc-main")) === 850_000, await balanceOf("acc-main"));
  check("patrimonio igual tras editar aporte", (await totalOf()) === totalBefore, { antes: totalBefore, ahora: await totalOf() });
  await rejects("aporte no puede volverse gasto", () => financeStore.updateTransaction(aporte.id, { type: "EXPENSE" }));

  check("borrar aporte", await financeStore.deleteTransaction(aporte.id));
  check("borrar aporte revierte bolsillo", (await pocketAmount()) === 0, await pocketAmount());
  check("borrar aporte devuelve el dinero", (await balanceOf("acc-main")) === 1_000_000);

  check("borrar gasto", await financeStore.deleteTransaction(expense.id));
  check("borrar gasto recalcula saldo", (await balanceOf("acc-cash")) === 0);
  check("borrar inexistente → false", !(await financeStore.deleteTransaction("nope")));

  // Recurrente: la edición no rompe executeRecurring
  await financeStore.updateTransaction(income.id, { is_recurring: true, recurrence_interval: "MONTHLY" });
  const next = await financeStore.executeRecurring(income.id);
  check("executeRecurring sigue funcionando", !!next?.is_recurring && !(await financeStore.getTransaction(income.id))!.is_recurring);
}

storeTests()
  .catch((e) => {
    failed++;
    console.error("❌ store", e);
  })
  .finally(() => {
    if (failed) {
      console.error(`\n${failed} prueba(s) fallaron`);
      process.exit(1);
    }
    console.log("\nEdición de movimientos: todo OK");
  });
