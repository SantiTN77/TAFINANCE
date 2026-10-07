/**
 * Pagar la tarjeta desde un bolsillo (store en modo local, sin Supabase).
 * Ejecuta: tsx tests/pocket-pay.test.ts
 */
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log("✅", name);
  else {
    failed++;
    console.error("❌", name, extra ?? "");
  }
}

async function main() {
  const { FinanceStore } = await import("../src/lib/storage/finance-store");
  const store = new FinanceStore();

  const bank = await store.addAccount({ name: "Banco", type: "checking", currency: "COP", balance: 1_000_000 } as any);
  const card = await store.addAccount({ name: "Visa", type: "credit", currency: "COP", balance: -300_000, cutoff_day: 10, due_day: 25 } as any);
  const pocket = await store.addPocket({ name: "Gastos mensuales", target_amount: 500_000, current_amount: 0, icon: "Wallet", color: "#4cd7f6", category: "Gastos" });
  await store.transferToPocket(pocket.id, 200_000, bank.id);

  const state = async () => {
    const accounts = await store.getAccounts();
    const pockets = await store.getPockets();
    const summary = await store.getSummary();
    return {
      bank: accounts.find((a) => a.id === bank.id)!.balance,
      card: accounts.find((a) => a.id === card.id)!.balance,
      pocket: pockets.find((p) => p.id === pocket.id)!.current_amount,
      total: summary.totalBalance,
      expenses: summary.monthlyExpenses,
    };
  };

  const before = await state();
  check("base: banco 800k, bolsillo 200k, deuda 300k", before.bank === 800_000 && before.pocket === 200_000 && before.card === -300_000, before);

  check("paga la tarjeta desde el bolsillo", await store.transferFromPocket(pocket.id, card.id, 150_000));
  const after = await state();
  check("la deuda baja y el bolsillo también", after.card === -150_000 && after.pocket === 50_000, after);
  check("el banco no se toca", after.bank === before.bank, after);
  check("patrimonio sin cambios (es traslado)", after.total === before.total, { before: before.total, after: after.total });
  check("no cuenta como gasto del mes", after.expenses === before.expenses, after);

  check("rechaza más de lo que tiene el bolsillo", !(await store.transferFromPocket(pocket.id, card.id, 50_001)));
  check("rechaza monto 0 o cuenta inexistente", !(await store.transferFromPocket(pocket.id, card.id, 0)) && !(await store.transferFromPocket(pocket.id, "nope", 1000)));
  check("lo rechazado no movió nada", (await state()).pocket === 50_000);

  const tx = (await store.getTransactions()).find((t) => t.pocket_id === pocket.id && t.to_account_id === card.id);
  check("el movimiento no ata un banco de origen", !!tx && !tx.account_id, tx);

  console.log(failed ? `\n${failed} fallos` : "\nPago desde bolsillo: todo OK");
  process.exit(failed ? 1 : 0);
}

void main();
