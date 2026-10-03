-- ==============================================================================
-- TAFINANCE: Esquema Contable y de Finanzas Personales
-- Base de datos: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- 2. Cuentas (Efectivo, Bancos, Tarjetas, Ahorros)
create table if not exists public.accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('bank', 'cash', 'credit', 'savings')),
  balance numeric(14,2) not null default 0.00,
  currency text not null default 'COP',
  created_at timestamptz not null default now()
);

-- 3. Categorías de Gastos e Ingresos
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  icon text not null,
  color text not null,
  type text not null check (type in ('EXPENSE', 'INCOME')),
  created_at timestamptz not null default now()
);

-- 4. Transacciones
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('EXPENSE', 'INCOME', 'TRANSFER')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'COP',
  description text not null,
  merchant text,
  receipt_url text,
  raw_prompt text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- 5. Presupuestos Mensuales
create table if not exists public.budgets (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.categories(id) on delete cascade,
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  month text not null, -- formato YYYY-MM
  created_at timestamptz not null default now(),
  constraint unique_category_month unique (category_id, month)
);

-- 6. Políticas de Seguridad RLS
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- Políticas permisivas por defecto para uso personal
create policy "Allow all operations on accounts for authenticated/anon" 
  on public.accounts for all using (true) with check (true);

create policy "Allow all operations on categories for authenticated/anon" 
  on public.categories for all using (true) with check (true);

create policy "Allow all operations on transactions for authenticated/anon" 
  on public.transactions for all using (true) with check (true);

create policy "Allow all operations on budgets for authenticated/anon" 
  on public.budgets for all using (true) with check (true);

-- 7. Datos Iniciales (Seed Data)
insert into public.categories (name, icon, color, type) values
  ('Alimentación & Restaurantes', 'Utensils', '#10B981', 'EXPENSE'),
  ('Transporte & Gasolina', 'Car', '#06B6D4', 'EXPENSE'),
  ('Suscripciones & Ocio', 'Sparkles', '#8B5CF6', 'EXPENSE'),
  ('Servicios Públicos & Hogar', 'Zap', '#F59E0B', 'EXPENSE'),
  ('Compras & Ropa', 'ShoppingBag', '#EC4899', 'EXPENSE'),
  ('Salud & Cuidado', 'HeartPulse', '#EF4444', 'EXPENSE'),
  ('Salario & Nómina', 'Briefcase', '#10B981', 'INCOME'),
  ('Ingresos Extra & Freelance', 'TrendingUp', '#06B6D4', 'INCOME')
on conflict (name) do nothing;

insert into public.accounts (name, type, balance, currency) values
  ('Cuenta Principal', 'bank', 2450000.00, 'COP'),
  ('Billetera Efectivo', 'cash', 120000.00, 'COP'),
  ('Fondo de Emergencia', 'savings', 1500000.00, 'COP')
on conflict do nothing;
