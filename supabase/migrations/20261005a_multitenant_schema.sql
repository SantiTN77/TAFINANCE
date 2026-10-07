-- ==============================================================================
-- TAFINANCE multiusuario, paso 1 de 3: esquema base (ADITIVO, seguro de aplicar en cualquier momento)
--
-- Añade perfiles (rol/estado), auditoría de admin y la columna user_id (aún nullable).
-- No cambia el acceso a los datos actuales: sigue cerrado a anon y abierto solo a service_role.
-- Orden: 20261005a → crear el primer usuario (Auth) → 20261005b → 20261005c.
-- ==============================================================================

-- Perfil por usuario de Auth. Fuente de verdad de rol y estado.
--   role:   'user' | 'admin'
--   status: 'active' | 'disabled' | 'pending'  (pending = alta sin pasar por el panel admin)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'pending' check (status in ('active', 'disabled', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_idx on public.profiles (lower(email));

-- Auditoría de acciones del panel admin (solo service_role)
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  actor uuid,                      -- sin FK: el rastro sobrevive al borrado del usuario
  action text not null,            -- 'create_user' | 'set_status' | 'set_role' | 'reset_password' | 'delete_user' ...
  target uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.admin_audit enable row level security;
revoke all on public.profiles, public.admin_audit from anon, authenticated;
grant all on public.profiles, public.admin_audit to service_role;
grant usage, select on sequence public.admin_audit_id_seq to service_role;

-- Cada usuario puede leer SOLO su propio perfil (el rol/estado nunca se escriben desde el cliente)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
grant select on public.profiles to authenticated;

-- Perfil automático al crear un usuario en Auth.
-- Solo queda 'active' si lo creó el panel admin (app_metadata.admin_created = true, que un
-- registro público NO puede fijar). Un alta pública queda 'pending': sin acceso a datos.
create or replace function public.taf_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  created_by_admin boolean := coalesce((new.raw_app_meta_data ->> 'admin_created')::boolean, false);
  wanted_role text := coalesce(new.raw_app_meta_data ->> 'role', 'user');
begin
  insert into public.profiles (id, email, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    case when created_by_admin and wanted_role in ('user', 'admin') then wanted_role else 'user' end,
    case when created_by_admin then 'active' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists taf_on_auth_user_created on auth.users;
create trigger taf_on_auth_user_created
  after insert on auth.users
  for each row execute function public.taf_handle_new_user();

-- Mantiene el email del perfil al cambiar en Auth
create or replace function public.taf_sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = coalesce(new.email, ''), updated_at = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists taf_on_auth_user_email on auth.users;
create trigger taf_on_auth_user_email
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.taf_sync_user_email();

-- ¿El usuario autenticado está activo? Se evalúa en CADA consulta (cortes inmediatos al
-- deshabilitar: no hay que esperar a que caduque el token de acceso).
create or replace function public.taf_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

revoke all on function public.taf_is_active() from public, anon;
grant execute on function public.taf_is_active() to authenticated, service_role;

-- Columna de propietario (nullable hasta el paso 3; se rellena en el paso 2)
alter table public.accounts           add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.categories         add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.transactions       add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.pockets            add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.budgets            add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_settings      add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.push_subscriptions add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists accounts_user_idx           on public.accounts (user_id);
create index if not exists categories_user_idx         on public.categories (user_id);
create index if not exists transactions_user_date_idx  on public.transactions (user_id, date desc);
create index if not exists pockets_user_idx            on public.pockets (user_id);
create index if not exists budgets_user_idx            on public.budgets (user_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Resumen por usuario para el panel admin: SOLO conteos, nunca contenido financiero.
create or replace function public.taf_admin_user_overview()
returns table (
  user_id uuid, email text, role text, status text, created_at timestamptz,
  accounts bigint, transactions bigint, pockets bigint, last_activity timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.role, p.status, p.created_at,
         (select count(*) from public.accounts a where a.user_id = p.id),
         (select count(*) from public.transactions t where t.user_id = p.id),
         (select count(*) from public.pockets k where k.user_id = p.id),
         (select max(t.created_at) from public.transactions t where t.user_id = p.id)
  from public.profiles p
  order by p.created_at;
$$;

revoke all on function public.taf_admin_user_overview() from public, anon, authenticated;
grant execute on function public.taf_admin_user_overview() to service_role;
