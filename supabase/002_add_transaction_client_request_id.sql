alter table if exists public.transactions
add column if not exists client_request_id text;

create unique index if not exists idx_transactions_clerk_client_request_id
on public.transactions (clerk_id, client_request_id)
where client_request_id is not null;
