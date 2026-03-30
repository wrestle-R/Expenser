alter table if exists public.workflows
add column if not exists client_request_id text;

create unique index if not exists idx_workflows_user_client_request_id
on public.workflows (user_id, client_request_id)
where client_request_id is not null;
