import {
  Account,
  Category,
  Pocket,
  Transaction,
} from "../src/types/finance";
import {
  buildHistory,
  buildReminders,
  buildSummary,
  cardStatus,
  computeBalances,
  floatDaysFor,
  matchCategory,
  upcomingRecurring,
} from "../src/lib/finance/calc";
import { parseLocally, parseSpanishNumberWords } from "../src/lib/ai/gemini-client";

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log("✅", name);
  else {
    failed++;
    console.error("❌", name, extra ?? "");
  }
}

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  type: "EXPENSE",
  amount: 0,
  currency: "COP",
  description: "t",
  date: "2026-10-01",
  created_at: "",
  ...p,
});

const accounts: Account[] = [
  { id: "bank", name: "Banco", type: "bank", balance: 0, currency: "COP" },
  { id: "cash", name: "Efectivo", type: "cash", balance: 0, currency: "COP" },
  { id: "visa", name: "Visa", type: "credit", balance: 0, currency: "COP", cutoff_day: 15, due_day: 2, annual_yield: 10, remind_days_before: 1 },
];
const categories: Category[] = [
  { id: "cat-food", name: "Alimentación & Supermercado", icon: "x", color: "#fff", type: "EXPENSE" },
  { id: "cat-subscriptions", name: "Suscripciones & Digital", icon: "x", color: "#fff", type: "EXPENSE" },
  { id: "cat-home", name: "Vivienda & Servicios", icon: "x", color: "#fff", type: "EXPENSE" },
  { id: "cat-leisure", name: "Ocio & Restaurantes", icon: "x", color: "#fff", type: "EXPENSE" },
  { id: "cat-salary", name: "Salario & Nómina", icon: "x", color: "#fff", type: "INCOME" },
];

// 1. Ingreso después de egresos: los saldos se derivan del historial
const flow = [
  tx({ type: "EXPENSE", amount: 20000, account_id: "bank", date: "2026-10-01" }),
  tx({ type: "EXPENSE", amount: 10000, account_id: "bank", date: "2026-10-02" }),
  tx({ type: "INCOME", amount: 500000, account_id: "bank", date: "2026-10-03" }),
  tx({ type: "EXPENSE", amount: 5000, account_id: "cash", date: "2026-10-03" }),
];
const bal = computeBalances(accounts, flow);
check("saldo banco = ingreso - egresos", bal.find((a) => a.id === "bank")!.balance === 470000);
check("saldo efectivo", bal.find((a) => a.id === "cash")!.balance === -5000);

// 2. Resumen mensual y patrimonio
const pockets: Pocket[] = [{ id: "p", name: "P", target_amount: 100, current_amount: 0, icon: "", color: "", category: "" }];
const sum = buildSummary(bal, categories, flow, [], pockets, "2026-10");
check("ingresos del mes", sum.monthlyIncome === 500000);
check("gastos del mes", sum.monthlyExpenses === 35000);
check("patrimonio total", sum.totalBalance === 465000, sum.totalBalance);
check("apertura + flujo = cierre", (sum.openingBalance ?? 0) + (sum.netFlow ?? 0) === sum.closingBalance, sum);

// 3. Transferencia a bolsillo no cambia el patrimonio
const withPocket = [...flow, tx({ type: "TRANSFER", amount: 100000, account_id: "bank", pocket_id: "p" })];
const bal2 = computeBalances(accounts, withPocket);
const sum2 = buildSummary(bal2, categories, withPocket, [], [{ ...pockets[0], current_amount: 100000 }], "2026-10");
check("aporte a bolsillo conserva patrimonio", sum2.totalBalance === 465000, sum2.totalBalance);

// 4. Historial diario termina en el patrimonio actual
const hist = buildHistory(465000, flow, 7);
check("historial 7 puntos", hist.length === 7);
check("historial termina en total actual", hist[hist.length - 1].balance === 465000 || hist[hist.length - 1].balance === 465000 - 0, hist);

// 5. Tarjeta de crédito: compra, deuda, corte, pago
const cardTxs = [
  tx({ type: "EXPENSE", amount: 200000, account_id: "visa", date: "2026-10-10" }), // antes del corte del 15
  tx({ type: "EXPENSE", amount: 50000, account_id: "visa", date: "2026-10-20" }), // después del corte → no facturado
];
let withCard = computeBalances(accounts, cardTxs);
const visa = withCard.find((a) => a.id === "visa")!;
check("deuda de tarjeta negativa", visa.balance === -250000);
const now = new Date(2026, 9, 22); // 22-oct-2026
const st = cardStatus(visa, cardTxs, now);
check("deuda 250k", st.debt === 250000);
check("no facturado = compras tras corte", st.unbilled === 50000, st.unbilled);
check("facturado = deuda - no facturado", st.billed === 200000, st.billed);
check("próximo corte 15-nov", st.nextCutoff?.getMonth() === 10 && st.nextCutoff?.getDate() === 15);
check("pago del extracto cerrado el 2-nov", st.nextDue?.getMonth() === 10 && st.nextDue?.getDate() === 2, st.nextDue);
check("días de float > 0 con rendimiento", st.floatYield > 0 && st.avgFloatDays > 0, st);
check("float de compra el día del corte", floatDaysFor(visa, new Date(2026, 9, 15)) === 18, floatDaysFor(visa, new Date(2026, 9, 15)));

// pago de tarjeta reduce deuda
const paid = [...cardTxs, tx({ type: "TRANSFER", amount: 200000, account_id: "bank", to_account_id: "visa", date: "2026-10-25" })];
const balPaid = computeBalances(accounts, paid);
check("pago reduce deuda", balPaid.find((a) => a.id === "visa")!.balance === -50000);
check("pago descuenta del banco", balPaid.find((a) => a.id === "bank")!.balance === -200000);

// 6. Recordatorios: aviso un día antes del pago y en el corte
const rem = buildReminders(withCard, cardTxs, 45, now);
const due = rem.find((r) => r.kind === "card_due");
const cut = rem.find((r) => r.kind === "card_cutoff");
check("recordatorio de pago existe", !!due);
check("aviso un día antes (1-nov)", !!due && due.fireAt.startsWith(new Date(2026, 10, 1, 8).toISOString().slice(0, 10)), due?.fireAt);
check("recordatorio de corte el 15-nov", !!cut && cut.dueDate === "2026-11-15", cut?.dueDate);

// 7. Recurrentes
const rec = [tx({ is_recurring: true, recurrence_interval: "MONTHLY", amount: 30000, description: "Spotify", date: "2026-10-04" })];
const up = upcomingRecurring(rec, new Date(2026, 9, 22));
check("próxima ocurrencia mensual", up[0].dueDate === "2026-11-04", up[0]);
check("avisa el día anterior", buildReminders(accounts, rec, 45, new Date(2026, 9, 22)).some((r) => r.kind === "recurring" && r.dueDate === "2026-11-04"));

// 8. Categorías: la IA sugiere nombres propios; deben mapear a las reales
check("Spotify → Suscripciones", matchCategory(categories, "Suscripciones & Ocio", "EXPENSE", "Spotify")?.id === "cat-subscriptions");
check("Alimentación & Restaurantes → Alimentación", matchCategory(categories, "Alimentación & Restaurantes", "EXPENSE", "mercado")?.id === "cat-food");
check("Servicios Públicos & Hogar → Vivienda", matchCategory(categories, "Servicios Públicos & Hogar", "EXPENSE", "luz y agua")?.id === "cat-home");
check("Ingreso nunca cae en categoría de gasto", matchCategory(categories, "Salario & Nómina", "INCOME", "")?.type === "INCOME");

// 9. Parser de voz
check("palabras → número", parseSpanishNumberWords("treinta y cinco mil quinientos") === 35500);
check("un millón doscientos mil", parseSpanishNumberWords("un millón doscientos mil") === 1200000);
check("1.5 millones", parseLocally("recibí 1.5 millones de nómina").amount === 1500000);
check("45 mil", parseLocally("Gasté 45 mil en comida amigos").amount === 45000);
check("1.500.000", parseLocally("pagué 1.500.000 de arriendo").amount === 1500000);
check("dos millones (palabras)", parseLocally("me pagaron dos millones").amount === 2000000);
check("ayer", parseLocally("gasté 10 mil ayer", "2026-10-03").date === "2026-10-02");

if (failed) {
  console.error(`\n${failed} pruebas fallaron`);
  process.exit(1);
}
console.log("\n🎉 Todas las pruebas de cálculo pasaron");
