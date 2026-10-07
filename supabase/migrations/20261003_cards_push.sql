-- ==============================================================================
-- TAFINANCE v2.1: tarjetas de crédito, transferencias entre cuentas y notificaciones push
-- Migración ADITIVA (idempotente): no borra ni modifica datos existentes.
-- Nota: el esquema vivo usa ids de tipo text (no uuid); esta migración lo respeta.
-- ==============================================================================

-- Tarjetas de crédito: día de corte, día límite de pago, rentabilidad y aviso previo
alter table public.accounts add column if not exists cutoff_day int;
alter table public.accounts add column if not exists due_day int;
alter table public.accounts add column if not exists annual_yield numeric;
alter table public.accounts add column if not exists remind_days_before int default 1;

-- Transferencias entre cuentas (p. ej. pago de tarjeta): cuenta destino
alter table public.transactions add column if not exists to_account_id text;

-- Suscripciones Web Push (una fila por dispositivo) con sus recordatorios programados
create table if not exists public.push_subscriptions (
  id text primary key,                       -- hash del endpoint
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  reminders jsonb not null default '[]'::jsonb,   -- [{id,title,body,fireAt,url}]
  sent jsonb not null default '[]'::jsonb,        -- ids de recordatorios ya enviados
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Mismo criterio que el resto de tablas (uso personal). Para endurecer: define
-- SUPABASE_SERVICE_ROLE_KEY en el servidor y elimina esta política.
drop policy if exists "push_subscriptions_all" on public.push_subscriptions;
create policy "push_subscriptions_all" on public.push_subscriptions
  for all using (true) with check (true);

alter publication supabase_realtime add table public.accounts, public.transactions, public.pockets, public.budgets;
