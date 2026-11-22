-- Club Mahj memberships. Run once in Supabase -> SQL Editor, after schema.sql and payments.sql.
-- Written only by the server (service-role key). Members can read their own row.
--
-- Membership is paid month by month: each payment extends paid_through. Nothing renews by itself.

create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  paid_through timestamptz not null,
  reminders_enabled boolean not null default true,
  upcoming_reminded_for timestamptz,
  grace_reminded_for timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.memberships enable row level security;
create policy "members read own membership" on public.memberships for select using (auth.uid() = user_id);

-- Marks when an order's effect (for a membership, the extra month) was applied, so a repeated
-- webhook cannot add a second month.
alter table public.orders add column fulfilled_at timestamptz;
