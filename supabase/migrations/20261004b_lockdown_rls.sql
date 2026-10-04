-- ==============================================================================
-- TAFINANCE: cierra el acceso directo a la base de datos (paso 2 de 2)
--
-- Antes: políticas `using (true)` para anon → cualquiera con la clave anónima (que iba en
-- el bundle del navegador) podía leer y escribir todo, saltándose el PIN.
-- Después: RLS activo SIN políticas y sin privilegios para anon/authenticated. Solo
-- service_role (rutas de servidor tras el middleware, MCP con token, cron) accede.
--
-- APLICAR SOLO DESPUÉS de desplegar el código que usa /api/data y con
-- SUPABASE_SERVICE_ROLE_KEY definido en Vercel; si no, la app deja de sincronizar.
-- Reversible: recrear las políticas anteriores (ver 20261002/20261003).
-- ==============================================================================

do $$
declare
  t text;
  p record;
  tables text[] := array['accounts', 'categories', 'transactions', 'pockets', 'budgets',
                         'push_subscriptions', 'user_settings', 'auth_throttle'];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Tablas futuras en public: sin privilegios para anon/authenticated por defecto
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Realtime ya no se usa desde el navegador (y con RLS cerrado no emitiría nada a anon)
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'transactions', 'pockets', 'budgets'] loop
    if exists (select 1 from pg_publication_tables
               where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;
