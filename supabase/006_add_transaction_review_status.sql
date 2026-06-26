alter table if exists public.transactions
add column if not exists review_status text not null default 'complete'
check (review_status in ('pending', 'complete'));
