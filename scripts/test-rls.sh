#!/usr/bin/env bash
# Prueba el aislamiento multiusuario (RLS) en un Postgres LOCAL y VACÍO. No toca Supabase.
#   TEST_DATABASE_URL=postgresql:///tafmt ./scripts/test-rls.sh
# Requiere psql y permisos para crear roles (anon/authenticated/service_role) en esa instancia.
set -euo pipefail
: "${TEST_DATABASE_URL:?Define TEST_DATABASE_URL apuntando a una base vacía}"
cd "$(dirname "$0")/.."
M=supabase/migrations
T=supabase/tests
run() { psql "$TEST_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

echo "→ esquema tipo producción + datos de la bóveda actual"
run -f "$T/00_prod_like_schema.sql"

echo "→ 20261005a (aditiva)"
run -f "$M/20261005a_multitenant_schema.sql"
run -f "$M/20261005b_assign_legacy_data.sql"

echo "→ usuarios: dueño (alta manual → pending), bob (panel admin), eve (registro público), dis (panel admin)"
run <<'SQL'
insert into auth.users (email, raw_app_meta_data) values
  ('owner@test', '{}'),
  ('bob@test', '{"admin_created": true, "role": "user"}'),
  ('eve@test', '{}'),
  ('dis@test', '{"admin_created": true}');
do $$ begin
  if (select status from public.profiles where email = 'owner@test') <> 'pending' then raise exception 'owner debería nacer pending'; end if;
  if (select status from public.profiles where email = 'eve@test') <> 'pending' then raise exception 'eve debería nacer pending'; end if;
  if (select status from public.profiles where email = 'bob@test') <> 'active' then raise exception 'bob debería nacer active'; end if;
  if (select role from public.profiles where email = 'bob@test') <> 'user' then raise exception 'bob debería ser user'; end if;
end $$;
SQL

echo "→ el paso 3 debe ABORTAR ENTERO si quedan filas sin propietario (sin ON_ERROR_STOP: como el editor SQL)"
psql "$TEST_DATABASE_URL" -X -q -f "$M/20261005c_multitenant_rls.sql" >/dev/null 2>&1 || true
left=$(psql "$TEST_DATABASE_URL" -X -tA -c "select count(*) from pg_constraint where conname in ('transactions_account_fk','transactions_pocket_fk','budgets_category_fk') or (conrelid = 'public.accounts'::regclass and contype = 'p' and array_length(conkey,1) = 2)")
simple=$(psql "$TEST_DATABASE_URL" -X -tA -c "select count(*) from pg_constraint where conname in ('transactions_account_id_fkey','transactions_category_id_fkey','transactions_pocket_id_fkey','budgets_category_id_fkey','accounts_pkey')")
if [ "$left" != "0" ] || [ "$simple" != "5" ]; then
  echo "FALLO: el paso 3 dejó cambios a medias (compuestas=$left, simples=$simple de 5)" >&2; exit 1
fi
echo "OK  abortó sin dejar cambios a medias"

echo "→ paso 2: asignar la bóveda al dueño (dos veces: idempotente)"
run -c "select public.taf_assign_legacy_data((select id from auth.users where email = 'owner@test'));" -t
run -c "select public.taf_assign_legacy_data((select id from auth.users where email = 'owner@test'));" -t

echo "→ paso 3: aislamiento"
run -f "$M/20261005c_multitenant_rls.sql"

echo "→ aserciones"
run -f "$T/10_multitenant_assertions.sql" 2>&1 | grep -E "NOTICE|ERROR|FALLO" | sed 's/^psql:[^ ]* //' 
