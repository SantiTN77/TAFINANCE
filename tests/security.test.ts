import { applyOps, sanitizeOp } from "../src/lib/supabase/data-ops";
import { getMasterPin, isAuthConfigured, signPayload, verifyPayload } from "../src/lib/auth/security";
import { AdminError, assertSafeChange, validateNewUser } from "../src/lib/admin/users";

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

  // applyOps: fuerza user_id, acota borrados al usuario y se detiene en el primer error
  const calls: string[] = [];
  const rows: any[] = [];
  const deletes: [string, string][][] = [];
  const fakeDb: any = {
    from: (table: string) => ({
      upsert: async (row: any, opts: any) => {
        calls.push(`${table}:${row.id}`);
        rows.push({ row, opts });
        return { error: row.id === "bad" ? { code: "23503", message: "fk" } : null };
      },
      delete: () => {
        const filters: [string, string][] = [];
        deletes.push(filters);
        const q: any = { eq: (c: string, v: string) => (filters.push([c, v]), q), then: (r: any) => r({ error: null }) };
        return q;
      },
    }),
  };
  const res = await applyOps(fakeDb, "user-1", [
    { table: "accounts", op: "upsert", row: { id: "a", user_id: "victima" } },
    { table: "transactions", op: "upsert", row: { id: "bad" } },
    { table: "transactions", op: "upsert", row: { id: "c" } },
  ]);
  check("applyOps para en el primer error", res.applied === 1 && res.error?.code === "23503" && calls.length === 2, res);
  check("applyOps pisa user_id del cliente con el de la sesión", rows[0].row.user_id === "user-1", rows[0]);
  check("upsert usa clave compuesta (user_id,id)", rows[0].opts?.onConflict === "user_id,id");
  await applyOps(fakeDb, "user-1", [{ table: "accounts", op: "delete", rowId: "x" }]);
  check(
    "borrado acotado a user_id e id",
    deletes[0]?.some(([c, v]) => c === "user_id" && v === "user-1") && deletes[0]?.some(([c, v]) => c === "id" && v === "x"),
    deletes
  );

  /* ---------- panel admin: reglas de seguridad ---------- */
  const throws = (fn: () => void) => {
    try {
      fn();
      return false;
    } catch (e) {
      return e instanceof AdminError;
    }
  };
  const admin = { id: "a1", email: "a@x.co", role: "admin" as const, status: "active" as const };
  const user = { id: "u1", email: "u@x.co", role: "user" as const, status: "active" as const };
  check("no deshabilita al último admin", throws(() => assertSafeChange({ actorId: "otro", target: admin, activeAdmins: 1, change: { status: "disabled" } })));
  check("no degrada al último admin", throws(() => assertSafeChange({ actorId: "otro", target: admin, activeAdmins: 1, change: { role: "user" } })));
  check("no borra al último admin", throws(() => assertSafeChange({ actorId: "otro", target: admin, activeAdmins: 1, change: { delete: true } })));
  check("nadie se cambia a sí mismo", throws(() => assertSafeChange({ actorId: "u1", target: user, activeAdmins: 3, change: { status: "disabled" } })));
  check("nadie se borra a sí mismo", throws(() => assertSafeChange({ actorId: "u1", target: user, activeAdmins: 3, change: { delete: true } })));
  check("permite deshabilitar un admin si hay otro", !throws(() => assertSafeChange({ actorId: "a2", target: admin, activeAdmins: 2, change: { status: "disabled" } })));
  check("permite deshabilitar un usuario normal", !throws(() => assertSafeChange({ actorId: "a1", target: user, activeAdmins: 1, change: { status: "disabled" } })));
  check("rechaza contraseña corta / correo inválido", throws(() => validateNewUser({ email: "a@x.co", password: "corta" })) && throws(() => validateNewUser({ email: "nope", password: "x".repeat(20) })));
  check("alta válida normaliza el correo", validateNewUser({ email: " A@X.co ", password: "x".repeat(12), role: "admin" }).email === "a@x.co");
  check("rol desconocido cae a user", validateNewUser({ email: "a@x.co", password: "x".repeat(12), role: "root" }).role === "user");

  /* ---------- security.ts: falla cerrado sin secretos ---------- */
  const saved = { NODE_ENV: env.NODE_ENV, S: env.TAFINANCE_SECRET, P: env.TAFINANCE_PIN };
  env.NODE_ENV = "production";
  delete env.TAFINANCE_SECRET;
  delete env.TAFINANCE_PIN;
  check("sin PIN en producción → null", getMasterPin() === null);
  check("sin secreto en producción → no configurado", !isAuthConfigured());
  let threw = false;
  try {
    await signPayload({ x: 1 }, 1000);
  } catch {
    threw = true;
  }
  check("no firma cookies sin secreto", threw);
  check("no valida cookies sin secreto", (await verifyPayload("a.b")) === null);

  env.TAFINANCE_SECRET = "corto";
  env.TAFINANCE_PIN = "123";
  check("secreto corto / PIN corto → no configurado", !isAuthConfigured() && getMasterPin() === null);

  env.TAFINANCE_SECRET = "x".repeat(40);
  env.TAFINANCE_PIN = "2468";
  const token = await signPayload({ x: 1 }, 60_000);
  check("con secretos válidos firma y verifica", isAuthConfigured() && !!(await verifyPayload(token)));
  env.TAFINANCE_SECRET = "y".repeat(40);
  check("cookie firmada con otro secreto se rechaza", (await verifyPayload(token)) === null);

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
