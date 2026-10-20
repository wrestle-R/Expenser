alter table public.transactions
add column if not exists deleted_at timestamptz;

create index if not exists idx_transactions_user_active_date
on public.transactions (user_id, date desc)
where deleted_at is null;
