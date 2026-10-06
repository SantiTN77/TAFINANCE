-- ==============================================================================
-- TAFINANCE multiusuario, paso 3 de 3: aislamiento por usuario (RLS con auth.uid())
--
-- REQUISITO: haber ejecutado el paso 2 (todas las filas con user_id). Si queda alguna fila
-- sin propietario, esta migración se aborta ENTERA (transacción) y no cambia nada.
--
-- Efectos:
--   * user_id NOT NULL con default auth.uid().
--   * Claves primarias compuestas (user_id, id): dos usuarios pueden tener 'cat-food' o
--     'acc-main' sin chocar, y nadie puede pisar filas ajenas con un upsert.
--   * Claves foráneas compuestas: una transacción solo puede apuntar a cuentas/categorías/
--     bolsillos del mismo usuario.
--   * Políticas: solo el dueño y solo si su perfil está 'active' (se evalúa en cada consulta).
--   * El rol admin NO tiene acceso a datos financieros ajenos (solo conteos vía
--     taf_admin_user_overview, con service_role en el servidor).
-- Reversión: ver el final del archivo.
-- ==============================================================================

begin;

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'pockets', 'budgets',
                           'user_settings', 'push_subscriptions'] loop
    execute format('select count(*) from public.%I where user_id is null', t) into n;
    if n > 0 then
      raise exception 'Hay % filas sin propietario en %: ejecuta antes taf_assign_legacy_data()', n, t;
    end if;
  end loop;
end $$;

-- 1) Las FKs simples dependen de las PKs simples: se retiran primero
alter table public.transactions drop constraint if exists transactions_account_id_fkey;
alter table public.transactions drop constraint if exists transactions_category_id_fkey;
alter table public.transactions drop constraint if exists transactions_pocket_id_fkey;
alter table public.budgets      drop constraint if exists budgets_category_id_fkey;

-- 2) PKs compuestas + user_id obligatorio
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'pockets', 'budgets',
                           'user_settings', 'push_subscriptions'] loop
    execute format('alter table public.%I alter column user_id set not null', t);
    execute format('alter table public.%I alter column user_id set default auth.uid()', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_pkey');
    execute format('alter table public.%I add primary key (user_id, id)', t);
  end loop;
end $$;

-- 3) FKs compuestas (SET NULL solo sobre la columna hija: user_id no puede ser nulo)
alter table public.transactions
  add constraint transactions_account_fk  foreign key (user_id, account_id)  references public.accounts (user_id, id)   on delete set null (account_id),
  add constraint transactions_category_fk foreign key (user_id, category_id) references public.categories (user_id, id) on delete set null (category_id),
  add constraint transactions_pocket_fk   foreign key (user_id, pocket_id)   references public.pockets (user_id, id)    on delete set null (pocket_id);

alter table public.budgets
  add constraint budgets_category_fk foreign key (user_id, category_id) references public.categories (user_id, id) on delete cascade;

-- 4) RLS: dueño + perfil activo. Sin política para anon: sigue sin acceso.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'pockets', 'budgets',
                           'user_settings', 'push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (user_id = (select auth.uid()) and public.taf_is_active()) '
      'with check (user_id = (select auth.uid()) and public.taf_is_active())',
      t || '_owner_all', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

commit;

-- ------------------------------------------------------------------------------
-- REVERSIÓN (solo si algo sale mal; vuelve a un esquema de una sola bóveda):
--   drop policy ... "<tabla>_owner_all" en las 7 tablas;
--   alter table ... drop constraint transactions_*_fk, budgets_category_fk;
--   alter table ... drop constraint <tabla>_pkey; add primary key (id)  [user_settings: (id)];
--   recrear las FKs simples (account_id→accounts, category_id→categories, pocket_id→pockets,
--   budgets.category_id→categories on delete cascade);
--   revoke all ... from authenticated;
-- Los datos no se pierden: user_id queda como columna normal.
-- ------------------------------------------------------------------------------
