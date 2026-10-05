import { applyOps, sanitizeOp } from "../src/lib/supabase/data-ops";
import { createSessionToken, getMasterPin, isAuthConfigured, verifySessionToken } from "../src/lib/auth/security";

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log("✅", name);
  else {
    failed++;
    console.error("❌", name, extra ?? "");
  }
}

const env = process.env as Record<string, string | undefined>;

async function main() {
  /* ---------- /api/data: lista blanca de tablas y columnas ---------- */
  check("rechaza tabla fuera de lista", sanitizeOp({ table: "push_subscriptions", op: "delete", rowId: "x" }) === null);
  check("rechaza op desconocida", sanitizeOp({ table: "accounts", op: "truncate" }) === null);
  check("rechaza delete sin id", sanitizeOp({ table: "accounts", op: "delete" }) === null);
  check("rechaza upsert sin id", sanitizeOp({ table: "accounts", op: "upsert", row: { name: "x" } }) === null);
  const up = sanitizeOp({ table: "accounts", op: "upsert", row: { id: "a1", name: "Banco", evil: "drop", balance: 5 } });
  check("descarta columnas desconocidas", !!up && !("evil" in (up.row || {})) && up.row?.name === "Banco", up);

  // applyOps se detiene en el primer error y reporta cuántas entraron
  const calls: string[] = [];
  const fakeDb: any = {
    from: (table: string) => ({
      upsert: async (row: any) => {
        calls.push(`${table}:${row.id}`);
        return { error: row.id === "bad" ? { code: "23503", message: "fk" } : null };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  const res = await applyOps(fakeDb, [
    { table: "accounts", op: "upsert", row: { id: "a" } },
    { table: "transactions", op: "upsert", row: { id: "bad" } },
    { table: "transactions", op: "upsert", row: { id: "c" } },
  ]);
  check("applyOps para en el primer error", res.applied === 1 && res.error?.code === "23503" && calls.length === 2, res);

  /* ---------- security.ts: falla cerrado sin secretos ---------- */
  const saved = { NODE_ENV: env.NODE_ENV, S: env.TAFINANCE_SECRET, P: env.TAFINANCE_PIN };
  env.NODE_ENV = "production";
  delete env.TAFINANCE_SECRET;
  delete env.TAFINANCE_PIN;
  check("sin PIN en producción → null", getMasterPin() === null);
  check("sin secreto en producción → no configurado", !isAuthConfigured());
  let threw = false;
  try {
    await createSessionToken(1);
  } catch {
    threw = true;
  }
  check("no emite sesiones sin secreto", threw);
  check("no valida sesiones sin secreto", (await verifySessionToken("a.b")) === false);

  env.TAFINANCE_SECRET = "corto";
  env.TAFINANCE_PIN = "123";
  check("secreto corto / PIN corto → no configurado", !isAuthConfigured() && getMasterPin() === null);

  env.TAFINANCE_SECRET = "x".repeat(40);
  env.TAFINANCE_PIN = "2468";
  const token = await createSessionToken(1);
  check("con secretos válidos firma y verifica", isAuthConfigured() && (await verifySessionToken(token)));
  env.TAFINANCE_SECRET = "y".repeat(40);
  check("token firmado con otro secreto se rechaza", (await verifySessionToken(token)) === false);

  env.NODE_ENV = "development";
  delete env.TAFINANCE_SECRET;
  delete env.TAFINANCE_PIN;
  check("en desarrollo hay PIN local", getMasterPin() !== null && isAuthConfigured());

  env.NODE_ENV = saved.NODE_ENV;
  env.TAFINANCE_SECRET = saved.S;
  env.TAFINANCE_PIN = saved.P;

  console.log(failed ? `\n${failed} fallos` : "\nTodo OK");
  process.exit(failed ? 1 : 0);
}

void main();
