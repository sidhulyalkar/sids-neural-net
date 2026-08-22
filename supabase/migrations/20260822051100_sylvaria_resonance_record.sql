-- Sylvaria v0.11 Resonance & Record
-- Server-authoritative replay leaderboard. Public clients never write these tables directly.

create extension if not exists pgcrypto;

create table if not exists public.sylvaria_engine_versions (
  engine_version text not null,
  engine_hash text not null check (engine_hash ~ '^[a-f0-9]{64}$'),
  build_sha text not null,
  official_seed bigint not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (engine_version, engine_hash)
);

create unique index if not exists sylvaria_one_active_engine
  on public.sylvaria_engine_versions ((active))
  where active;

create table if not exists public.sylvaria_players (
  id uuid primary key default gen_random_uuid(),
  auth_subject text unique,
  display_name text not null check (char_length(display_name) between 1 and 24),
  created_at timestamptz not null default now()
);

create table if not exists public.sylvaria_run_tickets (
  nonce uuid primary key,
  engine_version text not null,
  engine_hash text not null,
  seed bigint not null,
  build_sha text not null,
  request_fingerprint text,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (engine_version, engine_hash)
    references public.sylvaria_engine_versions(engine_version, engine_hash),
  check (expires_at > issued_at)
);

create index if not exists sylvaria_ticket_rate_limit_idx
  on public.sylvaria_run_tickets (request_fingerprint, issued_at desc)
  where request_fingerprint is not null;

create table if not exists public.sylvaria_verified_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.sylvaria_players(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 24),
  engine_version text not null,
  engine_hash text not null,
  build_sha text not null,
  seed bigint not null,
  ticket_nonce uuid not null unique references public.sylvaria_run_tickets(nonce),
  replay_schema integer not null,
  replay_bytes bytea not null,
  replay_sha256 text not null check (replay_sha256 ~ '^[a-f0-9]{64}$'),
  score bigint not null check (score >= 0),
  world_depth integer not null check (world_depth >= 1),
  duration_ticks integer not null check (duration_ticks >= 1),
  final_state_sha256 text not null check (final_state_sha256 ~ '^[a-f0-9]{64}$'),
  verification_proof text not null check (verification_proof ~ '^[a-f0-9]{64}$'),
  verified_at timestamptz not null default now(),
  foreign key (engine_version, engine_hash)
    references public.sylvaria_engine_versions(engine_version, engine_hash),
  unique (engine_version, engine_hash, seed, replay_sha256)
);

create index if not exists sylvaria_leaderboard_rank_idx
  on public.sylvaria_verified_runs
  (engine_version, engine_hash, seed, score desc, verified_at asc);

alter table public.sylvaria_engine_versions enable row level security;
alter table public.sylvaria_players enable row level security;
alter table public.sylvaria_run_tickets enable row level security;
alter table public.sylvaria_verified_runs enable row level security;

revoke all on public.sylvaria_engine_versions from anon, authenticated;
revoke all on public.sylvaria_players from anon, authenticated;
revoke all on public.sylvaria_run_tickets from anon, authenticated;
revoke all on public.sylvaria_verified_runs from anon, authenticated;

-- Register/update the exact deployed engine before ticket issuance.
create or replace function public.register_sylvaria_engine(
  p_engine_version text,
  p_engine_hash text,
  p_build_sha text,
  p_official_seed bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sylvaria_engine_versions set active = false where active;
  insert into public.sylvaria_engine_versions (
    engine_version, engine_hash, build_sha, official_seed, active
  ) values (
    p_engine_version, p_engine_hash, p_build_sha, p_official_seed, true
  )
  on conflict (engine_version, engine_hash) do update
    set build_sha = excluded.build_sha,
        official_seed = excluded.official_seed,
        active = true;
end;
$$;

-- Ticket issuance is rate-limited by an HMAC-derived request fingerprint.
-- No raw IP address is persisted.
create or replace function public.issue_sylvaria_run_ticket(
  p_nonce uuid,
  p_engine_version text,
  p_engine_hash text,
  p_seed bigint,
  p_build_sha text,
  p_request_fingerprint text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(p_request_fingerprint, p_nonce::text))::bigint);

  if not exists (
    select 1 from public.sylvaria_engine_versions
    where engine_version = p_engine_version
      and engine_hash = p_engine_hash
      and build_sha = p_build_sha
      and official_seed = p_seed
      and active
  ) then
    raise exception 'inactive Sylvaria engine';
  end if;

  if p_request_fingerprint is not null then
    select count(*) into recent_count
      from public.sylvaria_run_tickets
     where request_fingerprint = p_request_fingerprint
       and issued_at >= p_issued_at - interval '10 minutes';
    if recent_count >= 8 then
      raise exception 'Sylvaria ticket rate limit exceeded';
    end if;
  end if;

  insert into public.sylvaria_run_tickets (
    nonce, engine_version, engine_hash, seed, build_sha,
    request_fingerprint, issued_at, expires_at
  ) values (
    p_nonce, p_engine_version, p_engine_hash, p_seed, p_build_sha,
    p_request_fingerprint, p_issued_at, p_expires_at
  );
end;
$$;

-- Atomic single-use claim. Concurrent submitters cannot both acquire a ticket.
create or replace function public.claim_sylvaria_run_ticket(
  p_nonce uuid,
  p_now timestamptz
) returns setof public.sylvaria_run_tickets
language sql
security definer
set search_path = public
as $$
  update public.sylvaria_run_tickets
     set used_at = p_now
   where nonce = p_nonce
     and used_at is null
     and expires_at >= p_now
  returning *;
$$;

revoke all on function public.register_sylvaria_engine(text,text,text,bigint) from public;
revoke all on function public.issue_sylvaria_run_ticket(uuid,text,text,bigint,text,text,timestamptz,timestamptz) from public;
revoke all on function public.claim_sylvaria_run_ticket(uuid,timestamptz) from public;

grant execute on function public.register_sylvaria_engine(text,text,text,bigint) to service_role;
grant execute on function public.issue_sylvaria_run_ticket(uuid,text,text,bigint,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.claim_sylvaria_run_ticket(uuid,timestamptz) to service_role;
