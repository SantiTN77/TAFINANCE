-- ==============================================================================
-- TAFINANCE multiusuario, paso 2 de 3: asignar los datos actuales (de una sola bóveda) al primer usuario
--
-- NO se ejecuta sola: define la función; el dueño la invoca UNA VEZ, después de crear su
-- usuario en Auth (panel de Supabase o /admin), con su id:
--
--     select public.taf_assign_legacy_data('<uuid del usuario en auth.users>');
--
-- Es idempotente (solo toca filas con user_id null) y marca a ese usuario como admin activo.
-- Devuelve cuántas filas asignó por tabla, para comprobar antes de aplicar el paso 3.
-- ==============================================================================

create or replace function public.taf_assign_legacy_data(p_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb := '{}'::jsonb;
  t text;
  n bigint;
begin
  if not exists (select 1 from auth.users u where u.id = p_owner) then
    raise exception 'taf_assign_legacy_data: el usuario % no existe en auth.users', p_owner;
  end if;

  -- El dueño pasa a admin activo (también en app_metadata, que viaja en el JWT)
  insert into public.profiles (id, email, role, status)
  select u.id, coalesce(u.email, ''), 'admin', 'active' from auth.users u where u.id = p_owner
  on conflict (id) do update set role = 'admin', status = 'active', updated_at = now();

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', 'admin', 'status', 'active', 'admin_created', true)
   where id = p_owner;

  foreach t in array array['accounts', 'categories', 'transactions', 'pockets', 'budgets',
                           'user_settings', 'push_subscriptions'] loop
    execute format('update public.%I set user_id = $1 where user_id is null', t) using p_owner;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(t, n);
  end loop;

  insert into public.admin_audit (actor, action, target, detail)
  values (p_owner, 'assign_legacy_data', p_owner, result);

  return result;
end;
$$;

revoke all on function public.taf_assign_legacy_data(uuid) from public, anon, authenticated;
grant execute on function public.taf_assign_legacy_data(uuid) to service_role;
