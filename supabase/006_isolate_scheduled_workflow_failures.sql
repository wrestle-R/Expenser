begin;
-- The app writes workflows through its authenticated Next API. The scheduler's
-- cursor and retry state belong to the database worker.
alter table public.workflows add column if not exists processing_retry_after timestamptz;
revoke insert, update, delete on table public.workflows from public, anon, authenticated;

create or replace function public.process_due_workflows(run_until timestamptz default now(), target_user uuid default null)
returns integer language plpgsql security definer set search_path=public as $$
declare
  wf public.workflows%rowtype;
  due timestamptz;
  local_day date;
  occurrence_id uuid;
  generated_transaction_id uuid;
  processed integer := 0;
  attempts integer := 0;
  failed boolean;
begin
  for wf in select * from public.workflows
    where next_run_at <= run_until
      and (processing_retry_after is null or processing_retry_after <= now())
      and (target_user is null or user_id=target_user)
    order by next_run_at, id for update skip locked
  loop
    due := wf.next_run_at;
    failed := false;
    -- Commit each successful occurrence even if a later one is invalid.
    while due <= run_until and attempts < 500 loop
      attempts := attempts+1;
      begin
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
        due := public.next_workflow_run(wf.schedule,due);
        processed := processed+1;
      exception when integrity_constraint_violation or data_exception then
        -- Roll back this occurrence and keep its cursor for a retry. A damaged
        -- workflow cannot roll back entries from earlier workflows or block later ones.
        raise warning 'Scheduled workflow % failed (SQLSTATE %)', wf.id, sqlstate;
        failed := true;
      end;
      exit when failed;
    end loop;
    update public.workflows
      set next_run_at=due,
          processing_retry_after=case when failed then now()+interval '5 minutes' else null end
      where id=wf.id;
    exit when attempts >= 500;
  end loop;
  return processed;
end;
$$;
revoke all on function public.process_due_workflows(timestamptz,uuid) from public,anon,authenticated;
commit;
