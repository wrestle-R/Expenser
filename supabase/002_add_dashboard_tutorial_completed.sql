alter table public.users
add column if not exists dashboard_tutorial_completed boolean not null default false;
