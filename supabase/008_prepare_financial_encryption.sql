begin;

create schema if not exists expenser_private;
revoke all on schema expenser_private from public, anon, authenticated;

create table if not exists expenser_private.financial_payloads (
  record_kind text not null check (record_kind in (
    'transactions', 'balances', 'balance_reconciliation_alerts',
    'user_categories', 'workflows', 'users'
  )),
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  envelope jsonb not null,
  payload_fingerprint text not null,
  import_lookup text,
  bank_reference_lookup text,
  request_lookup text,
  category_lookup text,
  primary key (record_kind, owner_id, record_id)
);

alter table expenser_private.financial_payloads enable row level security;
revoke all on expenser_private.financial_payloads from public, anon, authenticated;

commit;
