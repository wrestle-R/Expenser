create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null unique,
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

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null,
  type text not null check (type in ('income', 'expense')),
  amount double precision not null default 0,
  description text not null,
  category text not null default 'General',
  payment_method text not null check (payment_method in ('bank', 'cash', 'splitwise')),
  split_amount double precision not null default 0,
  date timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
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

create index if not exists idx_users_clerk_id on public.users (clerk_id);
create index if not exists idx_transactions_clerk_id_date on public.transactions (clerk_id, date desc);
create index if not exists idx_workflows_user_id_created_at on public.workflows (user_id, created_at desc);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

drop trigger if exists workflows_set_updated_at on public.workflows;
create trigger workflows_set_updated_at
before update on public.workflows
for each row
execute function public.set_updated_at();
