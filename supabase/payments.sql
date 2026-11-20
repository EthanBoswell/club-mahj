-- Club Mahj payments. Run once in Supabase -> SQL Editor, after schema.sql.
-- Orders are written only by the server (service-role key), never from the browser.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  product_id text not null,
  quantity int not null check (quantity between 1 and 10),
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','paid')),
  clover_session_id text not null unique,
  clover_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.orders enable row level security;

-- Members can read their own orders. No insert/update/delete policies exist, so only the
-- service role (which bypasses RLS) can change an order.
create policy "members read own orders" on public.orders for select using (auth.uid() = user_id);
