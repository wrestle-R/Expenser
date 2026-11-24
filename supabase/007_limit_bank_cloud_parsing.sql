begin;

-- Keep these budgets in Postgres so they apply across server instances.
create table public.bank_cloud_parse_limits (
  user_id uuid references auth.users(id) on delete cascade,
  bucket timestamptz not null,
  hits integer not null,
  unique nulls not distinct (user_id)
);
alter table public.bank_cloud_parse_limits enable row level security;
revoke all on table public.bank_cloud_parse_limits from public, anon, authenticated;

create function public.reserve_bank_cloud_parse(owner_id uuid)
returns boolean language plpgsql set search_path='' as $$
declare
  minute_start timestamptz := date_trunc('minute', statement_timestamp());
begin
  if owner_id is null then return false; end if;

  insert into public.bank_cloud_parse_limits as limits (user_id, bucket, hits)
    values (owner_id, minute_start, 1)
    on conflict (user_id) do update
      set bucket=excluded.bucket, hits=case when limits.bucket < excluded.bucket then 1 else limits.hits+1 end
      where limits.bucket < excluded.bucket or limits.hits < 20;
  if not found then return false; end if;

  insert into public.bank_cloud_parse_limits as limits (user_id, bucket, hits)
    values (null, minute_start, 1)
    on conflict (user_id) do update
      set bucket=excluded.bucket, hits=case when limits.bucket < excluded.bucket then 1 else limits.hits+1 end
      where limits.bucket < excluded.bucket or limits.hits < 120;
  return found;
end;
$$;
revoke all on function public.reserve_bank_cloud_parse(uuid) from public, anon, authenticated;

commit;
