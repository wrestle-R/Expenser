-- Imported bank balances are comparison data. A reconciliation choice rebases
-- the bank opening balance at the imported transaction timestamp; it must not
-- be silently overridden by a later imported balance anchor.
create or replace function public.recalculate_user_balances(target_user_id uuid)
returns void
language plpgsql
as $$
declare
  bank_row public.balances%rowtype;
  cash_row public.balances%rowtype;
  splitwise_row public.balances%rowtype;
  next_bank numeric(14, 2);
  next_cash numeric(14, 2);
  next_splitwise numeric(14, 2);
begin
  perform public.ensure_user_balances(target_user_id);
  select * into bank_row from public.balances
    where user_id = target_user_id and payment_method = 'bank' for update;
  select * into cash_row from public.balances
    where user_id = target_user_id and payment_method = 'cash' for update;
  select * into splitwise_row from public.balances
    where user_id = target_user_id and payment_method = 'splitwise' for update;

  select round((bank_row.opening_balance + coalesce(sum(
    case when type = 'income' then amount else -amount end
  ), 0))::numeric, 2)
  into next_bank
  from public.transactions
  where user_id = target_user_id
    and deleted_at is null
    and payment_method = 'bank'
    and date > bank_row.opening_at;

  select round((cash_row.opening_balance + coalesce(sum(
    case when type = 'income' then amount else -amount end
  ), 0))::numeric, 2)
  into next_cash
  from public.transactions
  where user_id = target_user_id
    and deleted_at is null
    and payment_method = 'cash'
    and date > cash_row.opening_at;

  select round((splitwise_row.opening_balance
    + coalesce(sum(
        case
          when payment_method = 'splitwise' and type = 'income' then amount
          when payment_method = 'splitwise' and type = 'expense' then -amount
          else 0
        end
      ), 0)
    + coalesce(sum(case when type = 'expense' then split_amount else 0 end), 0)
  )::numeric, 2)
  into next_splitwise
  from public.transactions
  where user_id = target_user_id
    and deleted_at is null
    and date > splitwise_row.opening_at;

  update public.balances
  set current_balance = case payment_method
    when 'bank' then next_bank
    when 'cash' then next_cash
    when 'splitwise' then next_splitwise
  end
  where user_id = target_user_id;
end;
$$;

select public.recalculate_user_balances(user_id) from public.users;
