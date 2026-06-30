create extension if not exists pgcrypto;

drop table if exists public.balance_reconciliation_alerts cascade;
drop table if exists public.user_categories cascade;
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
  balance_bank double precision not null default 0,
  balance_cash double precision not null default 0,
  balance_splitwise double precision not null default 0,
  onboarded boolean not null default false,
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
  description text not null,
  category text not null default 'General',
  review_status text not null default 'complete' check (review_status in ('pending', 'complete')),
  payment_method text not null check (payment_method in ('bank', 'cash', 'splitwise')),
  split_amount double precision not null default 0,
  date timestamptz not null default timezone('utc', now()),
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

alter table public.users enable row level security;
alter table public.transactions enable row level security;
alter table public.workflows enable row level security;
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
