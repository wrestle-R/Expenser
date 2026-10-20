-- Import identity is semantic and independent of whichever capture path named
-- the source. Enforce one transaction per canonical key for each user.
create unique index if not exists idx_transactions_user_import_source_key
on public.transactions (user_id, import_source_key)
where import_source_key is not null;
