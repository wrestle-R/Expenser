create table if not exists public.user_categories (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null,
  type text not null check (type in ('income', 'expense')),
  name text not null,
  color text not null default '#6b7280',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.transactions
add column if not exists import_source text,
add column if not exists import_source_key text,
add column if not exists imported_account_suffix text,
add column if not exists imported_bank_balance double precision,
add column if not exists imported_bank_reference text,
add column if not exists imported_bank_confidence text;

create unique index if not exists idx_transactions_clerk_import_key
on public.transactions (clerk_id, import_source, import_source_key)
where import_source is not null and import_source_key is not null;

create table if not exists public.balance_reconciliation_alerts (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null,
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

create index if not exists idx_user_categories_clerk_type
on public.user_categories (clerk_id, type, name);

create unique index if not exists idx_user_categories_clerk_type_lower_name
on public.user_categories (clerk_id, type, lower(name));

create index if not exists idx_balance_reconciliation_clerk_status
on public.balance_reconciliation_alerts (clerk_id, status, created_at desc);

drop trigger if exists user_categories_set_updated_at on public.user_categories;
create trigger user_categories_set_updated_at
before update on public.user_categories
for each row
execute function public.set_updated_at();
