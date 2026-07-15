alter table public.users
  drop column if exists balance_bank,
  drop column if exists balance_cash,
  drop column if exists balance_splitwise;
