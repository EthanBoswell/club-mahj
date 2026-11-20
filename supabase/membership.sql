-- Club Mahj memberships. Run once in Supabase -> SQL Editor, after schema.sql.
-- Written only by the server (service-role key). Members can read their own row.

create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','active','canceled','lapsed')),
  idempotency_key uuid not null,
  clover_customer_id text,
  clover_subscription_id text,
  started_at timestamptz,
  paid_through timestamptz,
  canceled_at timestamptz,
  billing_issue text,
  updated_at timestamptz not null default now()
);

alter table public.memberships enable row level security;
create policy "members read own membership" on public.memberships for select using (auth.uid() = user_id);
