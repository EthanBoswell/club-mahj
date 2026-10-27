-- Club Mahj database schema. Paste into Supabase -> SQL Editor -> Run.

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  city text,
  skill text not null default 'beginner' check (skill in ('beginner','intermediate','advanced')),
  style text not null default 'american' check (style in ('american','riichi','hong_kong','chinese_official','any')),
  bio text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select using (true);
create policy "members edit own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id and is_admin = (select is_admin from public.profiles where id = auth.uid()));

-- Create a profile automatically when someone signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, city, skill, style)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)),
    nullif(new.raw_user_meta_data->>'city',''),
    coalesce(nullif(new.raw_user_meta_data->>'skill',''), 'beginner'),
    coalesce(nullif(new.raw_user_meta_data->>'style',''), 'american')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ OPEN GAMES (public invites) ============
create table public.games (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  style text not null default 'american' check (style in ('american','riichi','hong_kong','chinese_official','any')),
  skill text not null default 'any' check (skill in ('any','beginner','intermediate','advanced')),
  starts_at timestamptz not null,
  location_name text not null,
  city text,
  seats int not null default 4 check (seats between 2 and 4),
  notes text,
  status text not null default 'open' check (status in ('open','cancelled')),
  created_at timestamptz not null default now()
);

create table public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.games enable row level security;
alter table public.game_players enable row level security;

create policy "games are public" on public.games for select using (true);
create policy "members host games" on public.games for insert with check (auth.uid() = host_id);
create policy "hosts edit own games" on public.games for update using (auth.uid() = host_id);
create policy "hosts delete own games" on public.games for delete using (auth.uid() = host_id);

create policy "seats are public" on public.game_players for select using (true);
create policy "members take a seat" on public.game_players for insert with check (auth.uid() = user_id);
create policy "members leave a seat" on public.game_players for delete using (auth.uid() = user_id);

-- Host automatically holds a seat; seats can't be oversold
create or replace function public.game_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.game_players (game_id, user_id) values (new.id, new.host_id);
  return new;
end $$;
create trigger games_host_seat after insert on public.games
  for each row execute function public.game_after_insert();

create or replace function public.check_seat_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare taken int; cap int; st text;
begin
  select seats, status into cap, st from public.games where id = new.game_id;
  if st <> 'open' then raise exception 'This game is no longer open'; end if;
  select count(*) into taken from public.game_players where game_id = new.game_id;
  if taken >= cap then raise exception 'This table is full'; end if;
  return new;
end $$;
create trigger game_players_limit before insert on public.game_players
  for each row execute function public.check_seat_limit();

-- ============ LADDER ============
create table public.ladder_entries (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  rank int not null,
  wins int not null default 0,
  losses int not null default 0,
  joined_at timestamptz not null default now(),
  constraint ladder_rank_unique unique (rank) deferrable initially deferred
);

create table public.ladder_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  challenged_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','reported','completed','cancelled')),
  winner_id uuid references public.profiles(id),
  reported_by uuid references public.profiles(id),
  message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.ladder_entries enable row level security;
alter table public.ladder_challenges enable row level security;
create policy "ladder is public" on public.ladder_entries for select using (true);
create policy "challenges are public" on public.ladder_challenges for select using (true);
-- No insert/update policies: all ladder changes go through the functions below.

create or replace function public.join_ladder() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into public.ladder_entries (user_id, rank)
  values (auth.uid(), coalesce((select max(rank) from public.ladder_entries), 0) + 1)
  on conflict (user_id) do nothing;
end $$;

create or replace function public.leave_ladder() returns void
language plpgsql security definer set search_path = public as $$
declare r int;
begin
  if exists (select 1 from public.ladder_challenges
             where status in ('pending','accepted','reported')
               and auth.uid() in (challenger_id, challenged_id)) then
    raise exception 'Finish your open challenge before leaving the ladder';
  end if;
  select rank into r from public.ladder_entries where user_id = auth.uid();
  if r is null then return; end if;
  delete from public.ladder_entries where user_id = auth.uid();
  update public.ladder_entries set rank = rank - 1 where rank > r;
end $$;

-- You may challenge someone up to 3 spots above you
create or replace function public.issue_challenge(target uuid, note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me_rank int; them_rank int; new_id uuid;
begin
  select rank into me_rank from public.ladder_entries where user_id = auth.uid();
  select rank into them_rank from public.ladder_entries where user_id = target;
  if me_rank is null then raise exception 'Join the ladder first'; end if;
  if them_rank is null then raise exception 'That player is not on the ladder'; end if;
  if them_rank >= me_rank then raise exception 'You can only challenge players ranked above you'; end if;
  if me_rank - them_rank > 3 then raise exception 'You can challenge up to 3 spots above you'; end if;
  if exists (select 1 from public.ladder_challenges
             where status in ('pending','accepted','reported')
               and (challenger_id in (auth.uid(), target) or challenged_id in (auth.uid(), target))) then
    raise exception 'One of you already has an open challenge';
  end if;
  insert into public.ladder_challenges (challenger_id, challenged_id, message)
  values (auth.uid(), target, note) returning id into new_id;
  return new_id;
end $$;

create or replace function public.respond_challenge(challenge uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ladder_challenges
     set status = case when accept then 'accepted' else 'declined' end,
         completed_at = case when accept then null else now() end
   where id = challenge and challenged_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Challenge not found'; end if;
end $$;

create or replace function public.cancel_challenge(challenge uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ladder_challenges set status = 'cancelled', completed_at = now()
   where id = challenge and challenger_id = auth.uid() and status in ('pending','accepted');
  if not found then raise exception 'Challenge not found'; end if;
end $$;

-- Either player reports who finished ahead; the other player confirms.
create or replace function public.report_result(challenge uuid, winner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.ladder_challenges;
begin
  select * into c from public.ladder_challenges where id = challenge;
  if c.id is null or auth.uid() not in (c.challenger_id, c.challenged_id) then
    raise exception 'Challenge not found'; end if;
  if c.status <> 'accepted' then raise exception 'Challenge must be accepted first'; end if;
  if winner not in (c.challenger_id, c.challenged_id) then raise exception 'Winner must be one of the players'; end if;
  update public.ladder_challenges
     set status = 'reported', winner_id = winner, reported_by = auth.uid()
   where id = challenge;
end $$;

create or replace function public.dispute_result(challenge uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ladder_challenges set status = 'accepted', winner_id = null, reported_by = null
   where id = challenge and status = 'reported'
     and auth.uid() in (challenger_id, challenged_id) and reported_by <> auth.uid();
  if not found then raise exception 'Nothing to dispute'; end if;
end $$;

create or replace function public.confirm_result(challenge uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.ladder_challenges; loser uuid; ch_rank int; td_rank int;
begin
  select * into c from public.ladder_challenges where id = challenge for update;
  if c.id is null or c.status <> 'reported' then raise exception 'Nothing to confirm'; end if;
  if auth.uid() not in (c.challenger_id, c.challenged_id) or auth.uid() = c.reported_by then
    raise exception 'The other player must confirm the result'; end if;

  loser := case when c.winner_id = c.challenger_id then c.challenged_id else c.challenger_id end;
  update public.ladder_entries set wins = wins + 1 where user_id = c.winner_id;
  update public.ladder_entries set losses = losses + 1 where user_id = loser;

  -- Challenger beat a higher-ranked player: take their spot, everyone between slides down one
  if c.winner_id = c.challenger_id then
    select rank into ch_rank from public.ladder_entries where user_id = c.challenger_id;
    select rank into td_rank from public.ladder_entries where user_id = c.challenged_id;
    if td_rank < ch_rank then
      update public.ladder_entries set rank = rank + 1 where rank >= td_rank and rank < ch_rank;
      update public.ladder_entries set rank = td_rank where user_id = c.challenger_id;
    end if;
  end if;

  update public.ladder_challenges set status = 'completed', completed_at = now() where id = challenge;
end $$;

grant execute on function public.join_ladder() to authenticated;
grant execute on function public.leave_ladder() to authenticated;
grant execute on function public.issue_challenge(uuid, text) to authenticated;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;
grant execute on function public.cancel_challenge(uuid) to authenticated;
grant execute on function public.report_result(uuid, uuid) to authenticated;
grant execute on function public.dispute_result(uuid) to authenticated;
grant execute on function public.confirm_result(uuid) to authenticated;
