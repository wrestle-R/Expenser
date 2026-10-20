create table if not exists public.balances (
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_method text not null check (payment_method in ('bank', 'cash', 'splitwise')),
  opening_balance numeric(14, 2) not null default 0,
  opening_at timestamptz not null default '-infinity',
  current_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, payment_method)
);

create index if not exists idx_balances_user_id on public.balances (user_id);

alter table public.transactions alter column description set default '';
alter table public.transactions drop constraint if exists transactions_review_status_check;

update public.transactions
set
  category = case
    when import_source is not null and lower(trim(category)) = 'bank import' then ''
    else category
  end,
  review_status = case
    when import_source is not null
      and (trim(category) = '' or lower(trim(category)) = 'bank import')
      then 'needs_category'
    else 'active'
  end;

alter table public.transactions alter column review_status set default 'active';
alter table public.transactions add constraint transactions_review_status_check
check (review_status in ('needs_category', 'active'));

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

insert into public.balances (user_id, payment_method, opening_balance, current_balance)
select
  u.user_id,
  'bank',
  u.balance_bank - coalesce((
    select sum(case when t.type = 'income' then t.amount else -t.amount end)
    from public.transactions t
    where t.user_id = u.user_id and t.deleted_at is null and t.payment_method = 'bank'
  ), 0),
  u.balance_bank
from public.users u
on conflict (user_id, payment_method) do nothing;
insert into public.balances (user_id, payment_method, opening_balance, current_balance)
select
  u.user_id,
  'cash',
  u.balance_cash - coalesce((
    select sum(case when t.type = 'income' then t.amount else -t.amount end)
    from public.transactions t
    where t.user_id = u.user_id and t.deleted_at is null and t.payment_method = 'cash'
  ), 0),
  u.balance_cash
from public.users u
on conflict (user_id, payment_method) do nothing;
insert into public.balances (user_id, payment_method, opening_balance, current_balance)
select
  u.user_id,
  'splitwise',
  u.balance_splitwise
    - coalesce((
        select sum(case when t.type = 'income' then t.amount else -t.amount end)
        from public.transactions t
        where t.user_id = u.user_id and t.deleted_at is null and t.payment_method = 'splitwise'
      ), 0)
    - coalesce((
        select sum(t.split_amount)
        from public.transactions t
        where t.user_id = u.user_id and t.deleted_at is null and t.type = 'expense'
      ), 0),
  u.balance_splitwise
from public.users u
on conflict (user_id, payment_method) do nothing;

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
  select * into bank_row from public.balances where user_id = target_user_id and payment_method = 'bank' for update;
  select * into cash_row from public.balances where user_id = target_user_id and payment_method = 'cash' for update;
  select * into splitwise_row from public.balances where user_id = target_user_id and payment_method = 'splitwise' for update;

  select * into bank_anchor from public.transactions
  where user_id = target_user_id and deleted_at is null and payment_method = 'bank'
    and imported_bank_balance is not null and date > bank_row.opening_at
  order by date desc, created_at desc, id desc limit 1;

  if bank_anchor.id is not null then
    select round((bank_anchor.imported_bank_balance + coalesce(sum(case when type = 'income' then amount else -amount end), 0))::numeric, 2)
    into next_bank from public.transactions
    where user_id = target_user_id and deleted_at is null and payment_method = 'bank'
      and import_source is null
      and (date > bank_anchor.date
        or (date = bank_anchor.date and created_at > bank_anchor.created_at)
        or (date = bank_anchor.date and created_at = bank_anchor.created_at and id > bank_anchor.id));
  else
    select round((bank_row.opening_balance + coalesce(sum(case when type = 'income' then amount else -amount end), 0))::numeric, 2)
    into next_bank from public.transactions
    where user_id = target_user_id and deleted_at is null and payment_method = 'bank' and date > bank_row.opening_at;
  end if;

  select round((cash_row.opening_balance + coalesce(sum(case when type = 'income' then amount else -amount end), 0))::numeric, 2)
  into next_cash from public.transactions
  where user_id = target_user_id and deleted_at is null and payment_method = 'cash' and date > cash_row.opening_at;

  select round((splitwise_row.opening_balance
    + coalesce(sum(case when payment_method = 'splitwise' and type = 'income' then amount when payment_method = 'splitwise' and type = 'expense' then -amount else 0 end), 0)
    + coalesce(sum(case when type = 'expense' then split_amount else 0 end), 0))::numeric, 2)
  into next_splitwise from public.transactions
  where user_id = target_user_id and deleted_at is null and date > splitwise_row.opening_at;

  update public.balances set current_balance = case payment_method
    when 'bank' then next_bank when 'cash' then next_cash when 'splitwise' then next_splitwise end
  where user_id = target_user_id;
end;
$$;

create or replace function public.initialize_user_balances()
returns trigger language plpgsql as $$
begin
  perform public.ensure_user_balances(new.user_id);
  return new;
end;
$$;

drop trigger if exists users_initialize_balances on public.users;
create trigger users_initialize_balances after insert on public.users
for each row execute function public.initialize_user_balances();

create or replace function public.transactions_recalculate_balances()
returns trigger language plpgsql as $$
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

drop trigger if exists transactions_recalculate_balances on public.transactions;
create trigger transactions_recalculate_balances after insert or update or delete on public.transactions
for each row execute function public.transactions_recalculate_balances();

drop trigger if exists balances_set_updated_at on public.balances;
create trigger balances_set_updated_at before update on public.balances
for each row execute function public.set_updated_at();

alter table public.balances enable row level security;
drop policy if exists balances_owner_select on public.balances;
drop policy if exists balances_owner_insert on public.balances;
drop policy if exists balances_owner_update on public.balances;
drop policy if exists balances_owner_delete on public.balances;
create policy balances_owner_select on public.balances for select to authenticated using ((select auth.uid()) = user_id);
create policy balances_owner_insert on public.balances for insert to authenticated with check ((select auth.uid()) = user_id);
create policy balances_owner_update on public.balances for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy balances_owner_delete on public.balances for delete to authenticated using ((select auth.uid()) = user_id);

select public.recalculate_user_balances(user_id) from public.users;
