alter table if exists public.transactions
add column if not exists exchange_expense_id uuid;

create index if not exists idx_transactions_clerk_exchange_expense_id
on public.transactions (clerk_id, exchange_expense_id)
where exchange_expense_id is not null;
