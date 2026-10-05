-- Aserciones del aislamiento multiusuario. Se ejecuta después de aplicar 20261005a, crear usuarios,
-- 20261005b y 20261005c. Cualquier fallo lanza una excepción (psql con ON_ERROR_STOP).
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  set local role authenticated;
end $$;

create or replace function pg_temp.expect_error(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'OK  % (%)', label, left(sqlerrm, 70);
    return;
  end;
  raise exception 'FALLO: se esperaba un error en: %', label;
end $$;

create or replace function pg_temp.expect_count(stmt text, want bigint, label text) returns void language plpgsql as $$
declare got bigint;
begin
  execute stmt into got;
  if got is distinct from want then
    raise exception 'FALLO: % → esperado %, obtenido %', label, want, got;
  end if;
  raise notice 'OK  % = %', label, got;
end $$;

do $$
declare
  owner_id uuid := (select id from auth.users where email = 'owner@test');
  bob uuid := (select id from auth.users where email = 'bob@test');
  eve uuid := (select id from auth.users where email = 'eve@test');       -- alta pública → pending
  dis uuid := (select id from auth.users where email = 'dis@test');       -- se deshabilita abajo
begin
  -- ===== el dueño ve sus datos migrados =====
  perform pg_temp.as_user(owner_id);
  perform pg_temp.expect_count('select count(*) from public.accounts', 3, 'owner ve sus 3 cuentas');
  perform pg_temp.expect_count('select count(*) from public.transactions', 2, 'owner ve sus 2 movimientos');
  perform pg_temp.expect_count('select count(*) from public.budgets', 1, 'owner ve su presupuesto');
  perform pg_temp.expect_count('select count(*) from public.push_subscriptions', 1, 'owner ve su suscripción push');
  reset role;

  -- ===== bob (activo) no ve nada del dueño =====
  perform pg_temp.as_user(bob);
  perform pg_temp.expect_count('select count(*) from public.accounts', 0, 'bob no ve cuentas del dueño');
  perform pg_temp.expect_count('select count(*) from public.transactions', 0, 'bob no ve movimientos del dueño');
  perform pg_temp.expect_count('select count(*) from public.push_subscriptions', 0, 'bob no ve suscripciones ajenas');

  -- mismos ids que el dueño: no chocan (PK compuesta)
  insert into public.categories (id, name, user_id) values ('cat-food', 'Comida de Bob', bob);
  insert into public.accounts (id, name, user_id) values ('acc-main', 'Cuenta de Bob', bob);
  perform pg_temp.expect_count('select count(*) from public.accounts', 1, 'bob crea acc-main sin chocar con el del dueño');

  -- default auth.uid(): insertar sin user_id lo asigna a bob
  insert into public.accounts (id, name) values ('acc-x', 'X');
  perform pg_temp.expect_count($q$select count(*) from public.accounts where user_id = auth.uid()$q$, 2, 'user_id por defecto = auth.uid()');

  -- no puede escribir filas a nombre del dueño
  perform pg_temp.expect_error(format($q$insert into public.accounts (id, name, user_id) values ('evil','x','%s')$q$, owner_id),
                               'bob no puede insertar con user_id del dueño');
  -- ni modificar ni borrar filas ajenas (0 filas afectadas: invisibles)
  update public.accounts set name = 'hack' where id = 'acc-cash';
  delete from public.transactions where id = 'tx-1';
  -- upsert sobre un id del dueño crea la fila de bob, no pisa la del dueño
  insert into public.accounts (id, name, user_id) values ('acc-cash', 'Efectivo de Bob', bob)
    on conflict (user_id, id) do update set name = excluded.name;
  -- una transacción no puede apuntar a una cuenta del dueño (FK compuesta)
  perform pg_temp.expect_error($q$insert into public.transactions (id, account_id, type, amount, description)
                                  values ('t-bob', 'acc-sav', 'EXPENSE', 1, 'x')$q$,
                               'bob no puede referenciar cuenta ajena (FK compuesta)');
  -- bob no puede cambiarse el rol ni el estado
  perform pg_temp.expect_error($q$update public.profiles set role = 'admin' where id = auth.uid()$q$, 'bob no puede escalar su rol');
  perform pg_temp.expect_count('select count(*) from public.profiles', 1, 'bob solo ve su propio perfil');
  perform pg_temp.expect_error('select * from public.admin_audit', 'bob no lee la auditoría');
  perform pg_temp.expect_error('select * from public.taf_admin_user_overview()', 'bob no llama al resumen de admin');
  reset role;

  -- ===== lo del dueño sigue intacto tras los ataques de bob =====
  perform pg_temp.as_user(owner_id);
  perform pg_temp.expect_count($q$select count(*) from public.accounts where name in ('hack','Efectivo de Bob')$q$, 0, 'cuentas del dueño sin alterar');
  perform pg_temp.expect_count('select count(*) from public.transactions', 2, 'movimientos del dueño sin borrar');
  perform pg_temp.expect_count('select count(*) from public.accounts', 3, 'el dueño sigue con 3 cuentas');
  reset role;

  -- ===== pending (alta pública) y disabled: sin acceso a datos =====
  perform pg_temp.as_user(eve);
  perform pg_temp.expect_count('select count(*) from public.accounts', 0, 'pending no ve datos');
  perform pg_temp.expect_error($q$insert into public.accounts (id, name) values ('e1','x')$q$, 'pending no puede escribir');
  reset role;

  update public.profiles set status = 'disabled' where id = dis;
  perform pg_temp.as_user(dis);
  perform pg_temp.expect_error($q$insert into public.accounts (id, name) values ('d1','x')$q$, 'disabled no puede escribir');
  reset role;
  -- deshabilitar corta de inmediato incluso a un usuario con datos
  update public.profiles set status = 'disabled' where id = bob;
  perform pg_temp.as_user(bob);
  perform pg_temp.expect_count('select count(*) from public.accounts', 0, 'bob deshabilitado deja de ver sus propios datos');
  reset role;
  update public.profiles set status = 'active' where id = bob;

  -- ===== anon: nada =====
  set local role anon;
  perform pg_temp.expect_error('select * from public.accounts', 'anon no lee cuentas');
  perform pg_temp.expect_error('select * from public.profiles', 'anon no lee perfiles');
  perform pg_temp.expect_error('select public.taf_is_active()', 'anon no ejecuta taf_is_active');
  reset role;

  -- ===== borrar una cuenta pone account_id en null sin tocar user_id =====
  perform pg_temp.as_user(owner_id);
  delete from public.accounts where id = 'acc-main';
  perform pg_temp.expect_count($q$select count(*) from public.transactions where id = 'tx-1' and account_id is null and user_id = auth.uid()$q$, 1,
                               'borrar cuenta deja el movimiento con account_id null y mismo dueño');
  reset role;

  -- ===== service_role (admin API) =====
  set local role service_role;
  perform pg_temp.expect_count('select count(*) from public.taf_admin_user_overview()', 4, 'resumen admin lista los 4 perfiles');
  perform pg_temp.expect_count($q$select count(*) from public.profiles where role = 'admin'$q$, 1, 'solo el dueño es admin');
  reset role;

  -- ===== borrar un usuario de Auth elimina sus datos en cascada =====
  delete from auth.users where id = bob;
  perform pg_temp.expect_count($q$select count(*) from public.accounts where user_id is not null and user_id = '$q$ || bob || $q$'$q$, 0, 'borrar usuario borra sus cuentas');
  perform pg_temp.expect_count($q$select count(*) from public.profiles where id = '$q$ || bob || $q$'$q$, 0, 'borrar usuario borra su perfil');
  raise notice 'TODAS LAS ASERCIONES PASARON';
end $$;
