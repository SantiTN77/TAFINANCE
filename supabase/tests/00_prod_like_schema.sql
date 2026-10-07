-- Esquema que imita producción DESPUÉS de 20261004a/b (cerrado a anon) para probar el multiusuario
-- en un Postgres local. NO se aplica en Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table public.accounts (
  id text primary key, name text not null, type text not null default 'bank', balance numeric not null default 0,
  currency text not null default 'COP', created_at timestamptz default now(), cutoff_day int, due_day int,
  annual_yield numeric, remind_days_before int default 1);
create table public.categories (
  id text primary key, name text not null, icon text not null default 'Tag', color text not null default '#8083ff',
  type text not null default 'EXPENSE', created_at timestamptz default now());
create table public.pockets (
  id text primary key, name text not null, target_amount numeric not null default 0, current_amount numeric not null default 0,
  icon text not null default 'Wallet', color text not null default '#4cd7f6', category text not null default 'Ahorro',
  auto_save_percentage numeric default 0, created_at timestamptz default now());
create table public.transactions (
  id text primary key,
  account_id text references public.accounts(id) on delete set null,
  category_id text references public.categories(id) on delete set null,
  pocket_id text references public.pockets(id) on delete set null,
  type text not null, amount numeric not null default 0, currency text not null default 'COP', description text not null,
  merchant text, receipt_url text, raw_prompt text, date date not null default current_date,
  created_at timestamptz default now(), is_recurring boolean default false, recurrence_interval text, to_account_id text);
create table public.budgets (
  id text primary key, category_id text references public.categories(id) on delete cascade,
  monthly_limit numeric not null default 0, month text not null, created_at timestamptz default now());
create table public.user_settings (
  id text primary key default 'primary', theme text not null default 'dark', language text not null default 'es',
  currency text not null default 'COP', pure_black_oled boolean not null default false, auto_pilot boolean not null default true,
  updated_at timestamptz default now());
create table public.push_subscriptions (
  id text primary key, endpoint text not null, p256dh text not null, auth text not null,
  reminders jsonb not null default '[]', sent jsonb not null default '[]', user_agent text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

-- Estado tras 20261004b: RLS activo, sin políticas, solo service_role
do $$ declare t text; begin
  foreach t in array array['accounts','categories','pockets','transactions','budgets','user_settings','push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop; end $$;

-- Datos de la bóveda actual
insert into public.accounts (id, name) values ('acc-main','Cuenta Principal'), ('acc-cash','Efectivo'), ('acc-sav','Ahorros');
insert into public.categories (id, name) values ('cat-food','Alimentación'), ('cat-home','Vivienda');
insert into public.pockets (id, name) values ('pk-1','Viaje');
insert into public.transactions (id, account_id, category_id, pocket_id, type, amount, description)
  values ('tx-1','acc-main','cat-food',null,'EXPENSE',100,'Mercado'), ('tx-2','acc-cash','cat-home','pk-1','EXPENSE',50,'Luz');
insert into public.budgets (id, category_id, month) values ('bg-1','cat-food','2026-10');
insert into public.push_subscriptions (id, endpoint, p256dh, auth) values ('sub-1','https://push.example/1','k','a');
