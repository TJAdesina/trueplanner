-- =====================================================================
-- TruePlanner database schema
-- Run this once in your Supabase project's SQL editor (Database ->
-- SQL Editor -> New query -> paste this whole file -> Run).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type task_status as enum (
    'not_started', 'in_progress', 'paused', 'completed',
    'shrunk', 'moved', 'cut', 'overdue', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type checkin_trigger as enum ('overrun', 'drift', 'accumulation', 'repeated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type checkin_status as enum ('pending', 'actioned', 'dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type checkin_action as enum ('cut', 'shrink', 'move');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles: one row per user, holds all settings/preferences
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  timezone text not null default 'UTC',
  -- notification settings
  notifications_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  checkin_sensitivity text not null default 'balanced', -- 'gentle' | 'balanced' | 'proactive'
  trigger_overrun_enabled boolean not null default true,
  trigger_drift_enabled boolean not null default true,
  trigger_accumulation_enabled boolean not null default true,
  trigger_repeated_enabled boolean not null default true,
  -- productivity preferences
  working_hours_start time not null default '09:00',
  working_hours_end time not null default '17:30',
  typical_task_minutes int not null default 45,
  default_priority task_priority not null default 'medium',
  default_recovery_behavior checkin_action not null default 'shrink',
  show_completed_tasks boolean not null default true,
  auto_suggest_shrink boolean not null default true,
  -- appearance
  theme text not null default 'system', -- 'light' | 'dark' | 'system'
  reduced_motion boolean not null default false,
  -- privacy / AI
  ai_processing_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists timezone text not null default 'UTC';

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  priority task_priority not null default 'medium',
  category text,
  project text,
  estimated_minutes int,
  deadline timestamptz,
  notes text,
  status task_status not null default 'not_started',
  move_count int not null default 0,
  original_scope text, -- captures the pre-shrink description, for honest history
  parent_task_id uuid references public.tasks(id) on delete set null,
  last_checkin_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_user_start_idx on public.tasks (user_id, start_time);
create index if not exists tasks_status_idx on public.tasks (status);

-- ---------------------------------------------------------------------
-- task_events: an honest history log for every task
-- ---------------------------------------------------------------------
create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, -- created | started | paused | completed | shrunk | moved | cut | edited | reopened
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists task_events_task_idx on public.task_events (task_id);
create index if not exists task_events_user_day_idx on public.task_events (user_id, created_at);

-- ---------------------------------------------------------------------
-- checkins: AI / rule-generated recovery prompts
-- ---------------------------------------------------------------------
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  trigger_type checkin_trigger not null,
  headline text not null,
  message text not null,
  status checkin_status not null default 'pending',
  resolved_action checkin_action,
  source text not null default 'template', -- 'template' | 'gemini'
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists checkins_user_idx on public.checkins (user_id, created_at desc);
create index if not exists checkins_user_status_idx on public.checkins (user_id, status);

create or replace function public.create_checkin_if_available(
  p_checkin_id uuid,
  p_user_id uuid,
  p_task_id uuid,
  p_trigger_type checkin_trigger,
  p_headline text,
  p_message text,
  p_source text,
  p_cooldown_minutes int default 0
)
returns setof public.checkins
language plpgsql
set search_path = public
as $$
declare
  pending_checkin public.checkins%rowtype;
begin
  if auth.uid() is distinct from p_user_id and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized to create a check-in for this user';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into pending_checkin
  from public.checkins
  where user_id = p_user_id and status = 'pending'
  order by created_at desc
  limit 1;

  if found then
    return next pending_checkin;
    return;
  end if;

  if p_cooldown_minutes > 0 and exists (
    select 1 from public.checkins
    where user_id = p_user_id
      and created_at >= now() - make_interval(mins => p_cooldown_minutes)
  ) then
    return;
  end if;

  return query
  insert into public.checkins (
    id, user_id, task_id, trigger_type, headline, message, source
  ) values (
    p_checkin_id, p_user_id, p_task_id, p_trigger_type, p_headline, p_message, p_source
  )
  returning *;
end;
$$;

revoke all on function public.create_checkin_if_available(uuid, uuid, uuid, checkin_trigger, text, text, text, int) from public, anon;
grant execute on function public.create_checkin_if_available(uuid, uuid, uuid, checkin_trigger, text, text, text, int) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- push_subscriptions: browser endpoints for Web Push delivery
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------
-- updated_at helper trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_tasks on public.tasks;
create trigger set_updated_at_tasks before update on public.tasks
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.checkins enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "tasks_all_own" on public.tasks;
create policy "tasks_all_own" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "task_events_all_own" on public.task_events;
create policy "task_events_all_own" on public.task_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "checkins_all_own" on public.checkins;
create policy "checkins_all_own" on public.checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_all_own" on public.push_subscriptions;
create policy "push_subscriptions_all_own" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- Done. Your database is ready for TruePlanner.
-- =====================================================================
