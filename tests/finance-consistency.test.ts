/**
 * Coherencia de cifras entre dashboard, cuentas, tarjetas y bolsillos.
 *
 * La segunda parte es una "prueba de usuario" aislada: usa el store real sin Supabase
 * (las variables NEXT_PUBLIC_SUPABASE_* se borran antes de importarlo), así nunca toca datos reales.
 */
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { Account, Pocket, Transaction } from "../src/types/finance";
import {
  accountTotals,
  buildSummary,
  cardStatus,
  computeLedger,
  isAdjustment,
  parseAmount,
} from "../src/lib/finance/calc";

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log("✅", name);
  else {
    failed++;
    console.error("❌", name, extra ?? "");
  }
}

let seq = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`,
  type: "EXPENSE",
  amount: 0,
  currency: "COP",
  description: "t",
  date: "2026-10-01",
  created_at: `2026-10-01T00:00:${String(seq).padStart(2, "0")}Z`,
  ...p,
});

/* ------------------------------ montos con formato colombiano ------------------------------ */

check("200.000 → 200000", parseAmount("200.000") === 200000);
check("1.250.000 → 1250000", parseAmount("1.250.000") === 1250000);
check("1.250.000,50 → 1250000.5", parseAmount("1.250.000,50") === 1250000.5);
check("200,000 → 200000", parseAmount("200,000") === 200000);
check("1,250,000.75 → 1250000.75", parseAmount("1,250,000.75") === 1250000.75);
check("$ 35.900 COP → 35900", parseAmount("$ 35.900 COP") === 35900);
check("12.5 → 12.5", parseAmount("12.5") === 12.5);
check("99,9 → 99.9", parseAmount("99,9") === 99.9);
check("200000 → 200000", parseAmount("200000") === 200000);
check("-50.000 → -50000", parseAmount("-50.000") === -50000);
check("vacío → NaN", Number.isNaN(parseAmount("")));

/* ------------------------------ caso reportado: deuda de tarjeta inflada ------------------------------ */
// Reproduce los datos reales: una billetera con nómina y gastos se convirtió en tarjeta y luego
// se "ajustó" la deuda. El ajuste antiguo (EXPENSE) metía ~2,49 M en "Gastos" del mes.
const accounts: Account[] = [
  { id: "bank", name: "Cuenta Principal", type: "bank", balance: 0, currency: "COP" },
  { id: "card", name: "Tarjeta", type: "credit", balance: 0, currency: "COP", cutoff_day: 15, due_day: 2 },
];
const legacy = [
  tx({ type: "INCOME", amount: 2300000, account_id: "card", category_id: "cat-salary", date: "2026-09-30" }),
  tx({ type: "EXPENSE", amount: 30500, account_id: "card", category_id: "cat-sub", date: "2026-09-29" }),
  tx({ type: "EXPENSE", amount: 20000, account_id: "card", category_id: "cat-sub", date: "2026-10-03" }),
  tx({ type: "EXPENSE", amount: 9500, account_id: "card", category_id: "cat-food", date: "2026-10-04" }),
  tx({ type: "EXPENSE", amount: 2494572, account_id: "card", description: "Ajuste de saldo", date: "2026-10-04" }),
];
const led = computeLedger(accounts, legacy);
const s = buildSummary(led.accounts, [], legacy, [], led.pockets, "2026-10");
check("ajuste antiguo detectado", isAdjustment(legacy[4]));
check("deuda de tarjeta = 254.572", s.creditDebt === 254572, s.creditDebt);
check("gastos de octubre sin el ajuste = 29.500", s.monthlyExpenses === 29500, s.monthlyExpenses);
check("tasa de ahorro no se distorsiona", s.savingsRate === 0);
check("el ajuste no cuenta como compra del ciclo", cardStatus(led.accounts[1], legacy, new Date(2026, 9, 5)).unbilled === 60000);

// Ajuste nuevo (ADJUSTMENT): deuda inicial de 200.000 en tarjeta nueva
const fresh = [tx({ type: "ADJUSTMENT", amount: 200000, account_id: "card", description: "Saldo inicial" })];
const ledFresh = computeLedger(accounts, fresh);
const sFresh = buildSummary(ledFresh.accounts, [], fresh, [], [], "2026-10");
check("deuda inicial 200.000 → deuda 200.000", sFresh.creditDebt === 200000, sFresh.creditDebt);
check("deuda inicial no suma a gastos", sFresh.monthlyExpenses === 0);
check("deuda inicial sí baja el patrimonio", sFresh.totalBalance === -200000);
const inflow = [tx({ type: "ADJUSTMENT", amount: 500000, account_id: "bank", to_account_id: "bank" })];
check("ajuste positivo sube saldo sin ser ingreso", (() => {
  const l = computeLedger(accounts, inflow);
  const sm = buildSummary(l.accounts, [], inflow, [], [], "2026-10");
  return l.accounts[0].balance === 500000 && sm.monthlyIncome === 0;
})());

/* ------------------------------ identidad entre vistas ------------------------------ */
const mixed: Account[] = [
  { id: "a", name: "A", type: "bank", balance: 1000000, currency: "COP" },
  { id: "c1", name: "C1", type: "credit", balance: -300000, currency: "COP" },
  { id: "c2", name: "C2", type: "credit", balance: 50000, currency: "COP" }, // saldo a favor
];
const pk: Pocket[] = [{ id: "p", name: "P", target_amount: 1, current_amount: 200000, icon: "", color: "", category: "" }];
const t = accountTotals(mixed);
const sm = buildSummary(mixed, [], [], [], pk, "2026-10");
check("saldo a favor de tarjeta cuenta como disponible", t.available === 1050000 && t.debt === 300000, t);
check(
  "patrimonio = disponible + bolsillos − deuda",
  sm.totalBalance === (sm.availableBalance ?? 0) + (sm.pocketsTotal ?? 0) - (sm.creditDebt ?? 0),
  sm
);

/* ------------------------------ bolsillos relacionales ------------------------------ */
const pockets: Pocket[] = [{ id: "p", name: "Mercado", target_amount: 500000, current_amount: 999, icon: "", color: "", category: "" }];
const ptx = [
  tx({ type: "INCOME", amount: 1000000, account_id: "bank", date: "2026-10-01" }),
  tx({ type: "TRANSFER", amount: 300000, account_id: "bank", pocket_id: "p", date: "2026-10-02" }),
  tx({ type: "EXPENSE", amount: 100000, account_id: "bank", pocket_id: "p", category_id: "cat-food", date: "2026-10-03" }),
];
const lp = computeLedger(accounts, ptx, pockets);
check("bolsillo = aportes − gastos pagados con él (ignora valor guardado)", lp.pockets[0].current_amount === 200000, lp.pockets);
check("gasto desde bolsillo no se descuenta dos veces de la cuenta", lp.accounts[0].balance === 700000, lp.accounts);
const sp = buildSummary(lp.accounts, [], ptx, [], lp.pockets, "2026-10");
check("patrimonio = ingresos − gastos", sp.totalBalance === 900000, sp.totalBalance);

// El bolsillo solo paga lo que tiene; el resto sale de la cuenta
const over = [...ptx, tx({ type: "EXPENSE", amount: 250000, account_id: "bank", pocket_id: "p", category_id: "cat-food", date: "2026-10-04" })];
const lo = computeLedger(accounts, over, pockets);
check("bolsillo no queda negativo", lo.pockets[0].current_amount === 0, lo.pockets);
check("excedente sale de la cuenta", lo.accounts[0].balance === 650000, lo.accounts);

// Retiro de bolsillo a cuenta
const wd = [...ptx, tx({ type: "TRANSFER", amount: 50000, account_id: "bank", to_account_id: "bank", pocket_id: "p", date: "2026-10-05" })];
const lw = computeLedger(accounts, wd, pockets);
check("retiro de bolsillo vuelve a la cuenta", lw.pockets[0].current_amount === 150000 && lw.accounts[0].balance === 750000, lw);

// Borrar el bolsillo devuelve su saldo a la cuenta (antes desaparecía del patrimonio)
const ld = computeLedger(accounts, ptx, []);
const sd = buildSummary(ld.accounts, [], ptx, [], ld.pockets, "2026-10");
check("borrar bolsillo conserva patrimonio", sd.totalBalance === 900000 && ld.accounts[0].balance === 900000, ld.accounts);

/* ------------------------------ prueba de usuario aislada (store real, sin Supabase) ------------------------------ */

async function userJourney() {
  const { financeStore } = await import("../src/lib/storage/finance-store");
  const bank = (await financeStore.getAccounts()).find((a) => a.type === "bank")!;

  await financeStore.addTransaction({ type: "INCOME", amount: parseAmount("2.300.000"), currency: "COP", description: "Nómina", account_id: bank.id, category_id: "cat-salary", date: "2026-10-01" });
  const card = await financeStore.addAccount({ name: "Tarjeta prueba", type: "credit", currency: "COP", balance: -parseAmount("200.000"), cutoff_day: 15, due_day: 2 });
  let sum = await financeStore.getSummary("2026-10");
  check("[usuario] tarjeta nueva con 200.000 → deuda 200.000 en dashboard", sum.creditDebt === 200000, sum.creditDebt);
  check("[usuario] la deuda inicial no aparece como gasto", sum.monthlyExpenses === 0, sum.monthlyExpenses);
  check("[usuario] ingresos = nómina", sum.monthlyIncome === 2300000, sum.monthlyIncome);

  await financeStore.addTransaction({ type: "EXPENSE", amount: 50000, currency: "COP", description: "Compra", account_id: card.id, category_id: "cat-food", date: "2026-10-03" });
  const pocket = await financeStore.addPocket({ name: "Viaje", target_amount: 1000000, current_amount: 0, icon: "", color: "", category: "" });
  await financeStore.transferToPocket(pocket.id, 400000, bank.id);
  sum = await financeStore.getSummary("2026-10");
  const accs = await financeStore.getAccounts();
  const pks = await financeStore.getPockets();
  check("[usuario] deuda tarjeta = 250.000", sum.creditDebt === 250000, sum.creditDebt);
  check("[usuario] bolsillo = 400.000", pks[0].current_amount === 400000, pks);
  check("[usuario] cuenta = 1.900.000", accs.find((a) => a.id === bank.id)!.balance === 1900000);
  check("[usuario] patrimonio = disponible + bolsillos − deuda", sum.totalBalance === (sum.availableBalance ?? 0) + (sum.pocketsTotal ?? 0) - (sum.creditDebt ?? 0), sum);
  check("[usuario] patrimonio = 2.300.000 − 200.000 − 50.000", sum.totalBalance === 2050000, sum.totalBalance);

  const blocked = await financeStore.updateAccount(bank.id, { type: "credit" });
  check("[usuario] no deja convertir cuenta con movimientos en tarjeta", blocked === null);
  const renamed = await financeStore.updateAccount(bank.id, { name: "Banco renombrado" });
  check("[usuario] editar nombre sigue funcionando", renamed?.name === "Banco renombrado");

  await financeStore.adjustBalance(card.id, -300000);
  sum = await financeStore.getSummary("2026-10");
  check("[usuario] ajustar deuda a 300.000 no infla gastos", sum.creditDebt === 300000 && sum.monthlyExpenses === 50000, sum);

  await financeStore.deletePocket(pocket.id);
  sum = await financeStore.getSummary("2026-10");
  check("[usuario] borrar bolsillo devuelve el dinero", sum.pocketsTotal === 0 && sum.totalBalance === 2000000, sum);
}

userJourney()
  .catch((e) => {
    failed++;
    console.error("❌ prueba de usuario lanzó error", e);
  })
  .finally(() => {
    if (failed) {
      console.error(`\n${failed} pruebas de coherencia fallaron`);
      process.exit(1);
    }
    console.log("\n🎉 Cifras coherentes entre vistas");
  });
