-- The cutover runner holds an exclusive lock and verifies every source row
-- against its ciphertext before executing this file in the same transaction.
do $$
begin
  if current_setting('expenser.verified_cutover', true) is distinct from 'yes' then
    raise exception 'Run the verified encrypted cutover command';
  end if;
end;
$$;

drop trigger if exists users_initialize_balances on public.users;
drop trigger if exists transactions_recalculate_balances on public.transactions;

create or replace function public.recalculate_user_balances(target_user_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception 'Balances must be calculated by the encrypted ledger';
end;
$$;

create or replace function public.process_due_workflows(run_until timestamptz default now(), target_user uuid default null)
returns integer language plpgsql set search_path = '' as $$
begin
  raise exception 'Workflows must be processed by the encrypted scheduler';
end;
$$;

-- The schedule trigger only handles queryable metadata after cutover.
-- The authenticated application validates the encrypted amount before writing.
alter table public.workflows add column if not exists processing_retry_after timestamptz;

create or replace function public.prepare_workflow_schedule()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' or new.schedule is distinct from old.schedule then
    new.schedule_started_at := now();
    new.next_run_at := public.next_workflow_run(new.schedule, now());
    new.processing_retry_after := null;
  end if;
  return new;
end;
$$;

drop index if exists public.idx_user_categories_user_type_lower_name;
create unique index financial_payloads_category_name
  on expenser_private.financial_payloads (owner_id, category_lookup)
  where record_kind = 'user_categories' and category_lookup is not null;
create index financial_payloads_request_lookup
  on expenser_private.financial_payloads (owner_id, record_kind, request_lookup)
  where request_lookup is not null;
create index financial_payloads_import_lookup
  on expenser_private.financial_payloads (owner_id, import_lookup) where import_lookup is not null;
create index financial_payloads_bank_reference_lookup
  on expenser_private.financial_payloads (owner_id, bank_reference_lookup) where bank_reference_lookup is not null;

alter table public.transactions disable trigger transactions_set_updated_at;
alter table public.balances disable trigger balances_set_updated_at;
alter table public.user_categories disable trigger user_categories_set_updated_at;
alter table public.workflows disable trigger workflows_set_updated_at;
alter table public.users disable trigger users_set_updated_at;

update public.transactions set amount = 0, split_amount = 0, description = '', category = 'General',
  type = 'expense', payment_method = 'bank', imported_bank_balance = null, imported_bank_reference = null,
  imported_account_suffix = null, import_source = null, import_source_key = null,
  imported_bank_confidence = null, client_request_id = null;
update public.balances set opening_balance = 0, current_balance = 0;
update public.balance_reconciliation_alerts set expected_balance = 0, bank_balance = 0, difference = 0, source = '';
update public.user_categories set name = '', color = '#6b7280';
update public.workflows set name = '', description = '', category = 'General', payment_method = 'bank',
  amount = 0, split_amount = 0, type = 'expense', client_request_id = null;
update public.users set name = '', occupation = '';

alter table public.transactions enable trigger transactions_set_updated_at;
alter table public.balances enable trigger balances_set_updated_at;
alter table public.user_categories enable trigger user_categories_set_updated_at;
alter table public.workflows enable trigger workflows_set_updated_at;
alter table public.users enable trigger users_set_updated_at;

alter table public.transactions add constraint transactions_encrypted_fields check (
  amount = 0 and split_amount = 0 and description = '' and category = 'General'
  and type = 'expense' and payment_method = 'bank' and imported_bank_balance is null
  and imported_bank_reference is null and imported_account_suffix is null and import_source is null
  and import_source_key is null and imported_bank_confidence is null and client_request_id is null
);
alter table public.balances add constraint balances_encrypted_fields check (opening_balance = 0 and current_balance = 0);
alter table public.balance_reconciliation_alerts add constraint alerts_encrypted_fields
  check (expected_balance = 0 and bank_balance = 0 and difference = 0 and source = '');
alter table public.user_categories add constraint categories_encrypted_fields check (name = '' and color = '#6b7280');
alter table public.workflows add constraint workflows_encrypted_fields check (
  name = '' and description = '' and category = 'General' and payment_method = 'bank'
  and amount = 0 and split_amount = 0 and type = 'expense' and client_request_id is null
);
alter table public.users add constraint users_encrypted_fields check (name = '' and occupation = '');

revoke all on public.transactions, public.balances, public.balance_reconciliation_alerts,
  public.user_categories, public.workflows, public.users, public.workflow_occurrences
  from public, anon, authenticated;

create function expenser_private.require_financial_payload()
returns trigger language plpgsql set search_path = '' as $$
declare
  record_key text := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'payment_method');
begin
  if not exists (
    select 1 from expenser_private.financial_payloads
    where owner_id = new.user_id and record_kind = TG_TABLE_NAME and record_id = record_key
  ) then
    raise exception 'Encrypted financial payload required' using errcode = '23514';
  end if;
  return null;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['transactions', 'balances', 'balance_reconciliation_alerts', 'user_categories', 'workflows', 'users']
  loop
    execute format('create constraint trigger require_financial_payload after insert or update on public.%I
      deferrable initially deferred for each row execute function expenser_private.require_financial_payload()', table_name);
  end loop;
end;
$$;

create function expenser_private.require_encrypted_writer()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Include Auth account deletion cascades. The authenticated application
  -- does not expose a physical ledger deletion operation.
  if TG_OP = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  if current_setting('expenser.encrypted_writer', true) is distinct from 'yes' then
    raise exception 'Encrypted writer required' using errcode = '23514';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['transactions', 'balances', 'balance_reconciliation_alerts', 'user_categories', 'workflows', 'users', 'workflow_occurrences']
  loop
    execute format('create trigger require_encrypted_writer before insert or update or delete on public.%I
      for each row execute function expenser_private.require_encrypted_writer()', table_name);
  end loop;
end;
$$;
