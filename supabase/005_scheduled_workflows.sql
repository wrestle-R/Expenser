-- Server-owned scheduling: clients cannot create duplicate occurrences or skip
-- another user's event. The minute worker also catches up after interruptions.
begin;
alter table public.workflows add column if not exists schedule jsonb;
alter table public.workflows add column if not exists next_run_at timestamptz;
alter table public.workflows add column if not exists schedule_started_at timestamptz;
create index if not exists workflows_next_run on public.workflows(next_run_at) where next_run_at is not null;

create table if not exists public.workflow_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  local_date date not null,
  scheduled_at timestamptz not null,
  status text not null check (status in ('recorded','skipped')),
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(workflow_id,local_date)
);
alter table public.workflow_occurrences enable row level security;
drop policy if exists workflow_occurrence_owner_select on public.workflow_occurrences;
create policy workflow_occurrence_owner_select on public.workflow_occurrences for select to authenticated using (auth.uid()=user_id);

create or replace function public.next_workflow_run(config jsonb, after_time timestamptz)
returns timestamptz language plpgsql stable set search_path=public as $$
declare
  local_day date;
  candidate timestamptz;
  offset_day integer;
begin
  if config is null or not coalesce((config->>'enabled')::boolean,false) then return null; end if;
  for offset_day in 0..14 loop
    local_day := (after_time at time zone (config->>'timeZone'))::date + offset_day;
    if (config->'days') @> to_jsonb(extract(dow from local_day)::integer) then
      candidate := (local_day + (config->>'time')::time) at time zone (config->>'timeZone');
      -- A missing clock time during a DST jump is skipped, never shifted.
      if candidate > after_time and (candidate at time zone (config->>'timeZone'))::time = (config->>'time')::time then
        return candidate;
      end if;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.prepare_workflow_schedule()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.schedule is not null then
    if new.amount <= 0 or jsonb_typeof(new.schedule) is distinct from 'object'
       or not (new.schedule ?& array['days','time','timeZone','enabled']) or jsonb_typeof(new.schedule->'days') <> 'array'
       or jsonb_array_length(new.schedule->'days') not between 1 and 7
       or not (new.schedule->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
       or jsonb_typeof(new.schedule->'enabled') <> 'boolean'
       or not exists(select 1 from pg_timezone_names where name=new.schedule->>'timeZone')
       or exists(select 1 from jsonb_array_elements(new.schedule->'days') d where d::text !~ '^[0-6]$') then
      raise exception 'Invalid workflow schedule';
    end if;
  end if;
  if TG_OP='INSERT' or new.schedule is distinct from old.schedule then
    new.schedule_started_at := now();
    new.next_run_at := public.next_workflow_run(new.schedule, now());
  end if;
  return new;
end;
$$;
drop trigger if exists prepare_workflow_schedule on public.workflows;
create trigger prepare_workflow_schedule before insert or update on public.workflows for each row execute function public.prepare_workflow_schedule();

create or replace function public.process_due_workflows(run_until timestamptz default now(), target_user uuid default null)
returns integer language plpgsql security definer set search_path=public as $$
declare
  wf public.workflows%rowtype;
  due timestamptz;
  local_day date;
  occurrence_id uuid;
  generated_transaction_id uuid;
  processed integer := 0;
begin
  for wf in select * from public.workflows
    where next_run_at <= run_until and (target_user is null or user_id=target_user)
    order by next_run_at for update skip locked
  loop
    due := wf.next_run_at;
    -- Bound each run; remaining overdue entries are resumed on the next tick.
    while due <= run_until and processed < 500 loop
      local_day := (due at time zone (wf.schedule->>'timeZone'))::date;
      occurrence_id := null;
      generated_transaction_id := gen_random_uuid();
      insert into public.workflow_occurrences(user_id,workflow_id,local_date,scheduled_at,status)
        values(wf.user_id,wf.id,local_day,due,'recorded')
        on conflict(workflow_id,local_date) do nothing returning id into occurrence_id;
      if occurrence_id is not null then
        insert into public.transactions(id,user_id,client_request_id,type,amount,description,category,payment_method,split_amount,date,review_status)
        values(generated_transaction_id,wf.user_id,'wf_'||wf.id::text||'_'||local_day::text,wf.type,wf.amount,
          coalesce(nullif(wf.description,''),wf.name),wf.category,wf.payment_method,wf.split_amount,due,'active');
        update public.workflow_occurrences set transaction_id=generated_transaction_id where id=occurrence_id;
      end if;
      processed := processed+1;
      due := public.next_workflow_run(wf.schedule,due);
    end loop;
    update public.workflows set next_run_at=due where id=wf.id;
    exit when processed >= 500;
  end loop;
  return processed;
end;
$$;
revoke all on function public.process_due_workflows(timestamptz,uuid) from public,anon,authenticated;
commit;

-- Install separately only after verifying this migration and worker locally:
-- create extension if not exists pg_cron;
-- select cron.schedule('expenser-workflows', '* * * * *', 'select public.process_due_workflows()');
