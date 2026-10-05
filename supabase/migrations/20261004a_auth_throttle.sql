-- ==============================================================================
-- TAFINANCE: limitador de intentos de PIN persistente (paso 1 de 2, ADITIVO)
-- Se puede aplicar antes de desplegar el código: no cambia el acceso actual.
-- Solo service_role puede usarlo (el servidor de la app).
-- ==============================================================================

create table if not exists public.auth_throttle (
  key text primary key,                 -- p. ej. 'pin:ip:1.2.3.4' o 'pin:global'
  fails int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.auth_throttle enable row level security;
revoke all on public.auth_throttle from anon, authenticated;

-- Registra un intento para cada clave de forma atómica (bloqueo de fila).
-- Devuelve los segundos de espera si alguna clave está bloqueada (sin contar el intento),
-- o 0 si el intento se permite. El bloqueo se fija al llegar a p_max y crece hasta x10.
-- Los contadores sin actividad en 24 h se reinician.
create or replace function public.taf_throttle_hit(p_keys text[], p_max int[], p_lock_seconds int[])
returns int
language plpgsql
set search_path = public
as $$
declare
  i int;
  r public.auth_throttle%rowtype;
  wait int := 0;
  n int;
begin
  if array_length(p_keys, 1) is null
     or array_length(p_keys, 1) <> array_length(p_max, 1)
     or array_length(p_keys, 1) <> array_length(p_lock_seconds, 1) then
    raise exception 'taf_throttle_hit: argumentos inconsistentes';
  end if;

  -- Orden estable de bloqueo para evitar interbloqueos entre peticiones concurrentes
  insert into public.auth_throttle (key) select unnest(p_keys) on conflict (key) do nothing;
  perform 1 from public.auth_throttle where key = any(p_keys) order by key for update;

  for i in 1 .. array_length(p_keys, 1) loop
    select * into r from public.auth_throttle where key = p_keys[i];
    if r.locked_until is not null and r.locked_until > now() then
      wait := greatest(wait, ceil(extract(epoch from (r.locked_until - now())))::int);
    end if;
  end loop;
  if wait > 0 then
    return wait;
  end if;

  for i in 1 .. array_length(p_keys, 1) loop
    select * into r from public.auth_throttle where key = p_keys[i];
    n := case when r.updated_at < now() - interval '24 hours' then 0 else r.fails end + 1;
    update public.auth_throttle
       set fails = n,
           locked_until = case when n >= p_max[i]
                               then now() + make_interval(secs => p_lock_seconds[i] * least(10, n - p_max[i] + 1))
                               else null end,
           updated_at = now()
     where key = p_keys[i];
  end loop;
  return 0;
end;
$$;

create or replace function public.taf_throttle_reset(p_keys text[])
returns void
language sql
set search_path = public
as $$
  delete from public.auth_throttle where key = any(p_keys);
$$;

revoke all on function public.taf_throttle_hit(text[], int[], int[]) from public, anon, authenticated;
revoke all on function public.taf_throttle_reset(text[]) from public, anon, authenticated;
grant execute on function public.taf_throttle_hit(text[], int[], int[]) to service_role;
grant execute on function public.taf_throttle_reset(text[]) to service_role;
grant all on public.auth_throttle to service_role;
