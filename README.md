# Club Mahj

Next.js + Supabase site for a mahjong club: member sign-up, public open-game invites, and a challenge ladder.

## Run it
1. `npm install`
2. Create a free project at supabase.com. In **SQL Editor**, paste and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Project Settings -> API).
4. In Supabase **Authentication -> URL Configuration**, set the Site URL to your domain and add `https://YOUR-DOMAIN/auth/callback` as a redirect URL.
5. `npm run dev` (or deploy to Vercel and add the same two env vars).

Without the env vars the site runs in **preview mode** with sample data, handy for showing the client.

## What is in it
- `/join`, `/signin`, `/dashboard`: accounts and member profile (level, style, city)
- `/games`, `/games/new`, `/games/[id]`: public open invites; members post, take and release seats (4-seat cap enforced in the database)
- `/ladder`: public standings. Members join at the bottom, challenge up to 3 spots above, the opponent accepts, one reports the result and the other confirms. If the challenger wins they take the higher rank and everyone between slides down one.

All ladder changes run through database functions (see the schema), so ranks can't be edited directly from the browser.

## Ideas for next
Admin tools to correct a result, email notifications, Stripe membership ($50/mo on the old site), event calendar, profile photos.
