create extension if not exists pgcrypto;

drop table if exists public.balance_reconciliation_alerts cascade;
drop table if exists public.user_categories cascade;
drop table if exists public.balances cascade;
drop table if exists public.transactions cascade;
drop table if exists public.workflows cascade;
drop table if exists public.users cascade;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  occupation text not null default '',
  payment_methods text[] not null default '{}',
  onboarded boolean not null default false,
  dashboard_tutorial_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id text,
  exchange_expense_id uuid,
  import_source text,
  import_source_key text,
  imported_account_suffix text,
  imported_bank_balance double precision,
  imported_bank_reference text,
  imported_bank_confidence text,
  type text not null check (type in ('income', 'expense')),
  amount double precision not null default 0,
  description text not null default '',
  category text not null default 'General',
  review_status text not null default 'active' check (review_status in ('needs_category', 'active')),
  payment_method text not null check (payment_method in ('bank', 'cash', 'splitwise')),
  split_amount double precision not null default 0,
  date timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id text,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  amount double precision not null default 0,
  description text not null,
  category text not null default 'General',
  payment_method text not null check (payment_method in ('bank', 'cash', 'splitwise')),
  split_amount double precision not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.balances (
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_method text not null check (payment_method in ('bank', 'cash', 'splitwise')),
  opening_balance numeric(14, 2) not null default 0,
  opening_at timestamptz not null default '-infinity',
  current_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, payment_method)
);

create table public.user_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  name text not null,
  color text not null default '#6b7280',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.balance_reconciliation_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  payment_method text not null check (payment_method in ('bank', 'cash', 'splitwise')),
  expected_balance double precision not null,
  bank_balance double precision not null,
  difference double precision not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'kept')),
  source text not null default 'bank_notification',
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create index idx_users_user_id on public.users (user_id);
create index idx_transactions_user_id_date on public.transactions (user_id, date desc);
create index idx_transactions_user_active_date
on public.transactions (user_id, date desc)
where deleted_at is null;
create unique index idx_transactions_user_client_request_id
on public.transactions (user_id, client_request_id)
where client_request_id is not null;
create index idx_transactions_user_exchange_expense_id
on public.transactions (user_id, exchange_expense_id)
where exchange_expense_id is not null;
create unique index idx_transactions_user_import_key
on public.transactions (user_id, import_source, import_source_key)
where import_source is not null and import_source_key is not null;
create index idx_workflows_user_id_created_at on public.workflows (user_id, created_at desc);
create index idx_balances_user_id on public.balances (user_id);
create unique index idx_workflows_user_client_request_id
on public.workflows (user_id, client_request_id)
where client_request_id is not null;
create index idx_user_categories_user_type
on public.user_categories (user_id, type, name);
create unique index idx_user_categories_user_type_lower_name
on public.user_categories (user_id, type, lower(name));
create index idx_balance_reconciliation_user_status
on public.balance_reconciliation_alerts (user_id, status, created_at desc);

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

create trigger workflows_set_updated_at
before update on public.workflows
for each row
execute function public.set_updated_at();

create trigger user_categories_set_updated_at
before update on public.user_categories
for each row
execute function public.set_updated_at();

create trigger balances_set_updated_at
before update on public.balances
for each row
execute function public.set_updated_at();

create or replace function public.ensure_user_balances(target_user_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.balances (user_id, payment_method)
  values
    (target_user_id, 'bank'),
    (target_user_id, 'cash'),
    (target_user_id, 'splitwise')
  on conflict (user_id, payment_method) do nothing;
end;
$$;

create or replace function public.recalculate_user_balances(target_user_id uuid)
returns void
language plpgsql
as $$
declare
  bank_row public.balances%rowtype;
  cash_row public.balances%rowtype;
  splitwise_row public.balances%rowtype;
  bank_anchor public.transactions%rowtype;
  next_bank numeric(14, 2);
  next_cash numeric(14, 2);
  next_splitwise numeric(14, 2);
begin
  perform public.ensure_user_balances(target_user_id);

  select * into bank_row from public.balances
  where user_id = target_user_id and payment_method = 'bank' for update;
  select * into cash_row from public.balances
  where user_id = target_user_id and payment_method = 'cash' for update;
  select * into splitwise_row from public.balances
  where user_id = target_user_id and payment_method = 'splitwise' for update;

  select * into bank_anchor
  from public.transactions
  where user_id = target_user_id
    and deleted_at is null
    and payment_method = 'bank'
    and imported_bank_balance is not null
    and date > bank_row.opening_at
  order by date desc, created_at desc, id desc
  limit 1;

  if bank_anchor.id is not null then
    select round((bank_anchor.imported_bank_balance + coalesce(sum(
      case when type = 'income' then amount else -amount end
    ), 0))::numeric, 2)
    into next_bank
    from public.transactions
    where user_id = target_user_id
      and deleted_at is null
      and payment_method = 'bank'
      and import_source is null
      and (
        date > bank_anchor.date
        or (date = bank_anchor.date and created_at > bank_anchor.created_at)
        or (date = bank_anchor.date and created_at = bank_anchor.created_at and id > bank_anchor.id)
      );
  else
    select round((bank_row.opening_balance + coalesce(sum(
      case when type = 'income' then amount else -amount end
    ), 0))::numeric, 2)
    into next_bank
    from public.transactions
    where user_id = target_user_id
      and deleted_at is null
      and payment_method = 'bank'
      and date > bank_row.opening_at;
  end if;

  select round((cash_row.opening_balance + coalesce(sum(
    case when type = 'income' then amount else -amount end
  ), 0))::numeric, 2)
  into next_cash
  from public.transactions
  where user_id = target_user_id
    and deleted_at is null
    and payment_method = 'cash'
    and date > cash_row.opening_at;

  select round((splitwise_row.opening_balance
    + coalesce(sum(case
        when payment_method = 'splitwise' and type = 'income' then amount
        when payment_method = 'splitwise' and type = 'expense' then -amount
        else 0
      end), 0)
    + coalesce(sum(case
        when type = 'expense' then split_amount
        else 0
      end), 0)
  )::numeric, 2)
  into next_splitwise
  from public.transactions
  where user_id = target_user_id
    and deleted_at is null
    and date > splitwise_row.opening_at;

  update public.balances
  set current_balance = case payment_method
    when 'bank' then next_bank
    when 'cash' then next_cash
    when 'splitwise' then next_splitwise
  end
  where user_id = target_user_id;
end;
$$;

create or replace function public.initialize_user_balances()
returns trigger
language plpgsql
as $$
begin
  perform public.ensure_user_balances(new.user_id);
  return new;
end;
$$;

create trigger users_initialize_balances
after insert on public.users
for each row
execute function public.initialize_user_balances();

create or replace function public.transactions_recalculate_balances()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_user_balances(old.user_id);
  else
    perform public.recalculate_user_balances(new.user_id);
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    perform public.recalculate_user_balances(old.user_id);
  end if;
  return null;
end;
$$;

create trigger transactions_recalculate_balances
after insert or update or delete on public.transactions
for each row
execute function public.transactions_recalculate_balances();

alter table public.users enable row level security;
alter table public.transactions enable row level security;
alter table public.workflows enable row level security;
alter table public.balances enable row level security;
alter table public.user_categories enable row level security;
alter table public.balance_reconciliation_alerts enable row level security;

create policy users_owner_select on public.users
for select to authenticated
using ((select auth.uid()) = user_id);
create policy users_owner_insert on public.users
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy users_owner_update on public.users
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy users_owner_delete on public.users
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy transactions_owner_select on public.transactions
for select to authenticated
using ((select auth.uid()) = user_id);
create policy transactions_owner_insert on public.transactions
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy transactions_owner_update on public.transactions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy transactions_owner_delete on public.transactions
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy workflows_owner_select on public.workflows
for select to authenticated
using ((select auth.uid()) = user_id);
create policy workflows_owner_insert on public.workflows
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy workflows_owner_update on public.workflows
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy workflows_owner_delete on public.workflows
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy user_categories_owner_select on public.user_categories
for select to authenticated
using ((select auth.uid()) = user_id);
create policy user_categories_owner_insert on public.user_categories
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy balances_owner_select on public.balances
for select to authenticated
using ((select auth.uid()) = user_id);
create policy balances_owner_insert on public.balances
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy balances_owner_update on public.balances
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy balances_owner_delete on public.balances
for delete to authenticated
using ((select auth.uid()) = user_id);
create policy user_categories_owner_update on public.user_categories
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy user_categories_owner_delete on public.user_categories
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy balance_reconciliation_owner_select on public.balance_reconciliation_alerts
for select to authenticated
using ((select auth.uid()) = user_id);
create policy balance_reconciliation_owner_insert on public.balance_reconciliation_alerts
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy balance_reconciliation_owner_update on public.balance_reconciliation_alerts
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy balance_reconciliation_owner_delete on public.balance_reconciliation_alerts
for delete to authenticated
using ((select auth.uid()) = user_id);
