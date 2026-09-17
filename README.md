# Cosplay Match

An 18+ cosplay-focused dating and chat application. Users can build cosplay profiles, discover compatible people, match mutually, chat in real time, and privately share photos/videos.

## Stack

- Next.js 16 App Router + TypeScript
- Supabase Auth
- Supabase Postgres + Row Level Security
- Supabase Realtime for chat
- Supabase Storage for private profile/chat media

## Safety & privacy baseline

- 18+ only onboarding gate
- Mutual matches required before chat
- Private media bucket with signed/authenticated access
- Block and report flows
- RLS policies for profiles, matches, messages, reports, and blocks
- No public exposure of private chat media

## Development workflow

`main` stays stable. Product work is developed on feature branches and merged with pull requests.

The first implementation branch is `feat/mvp-cosplay-match`.

## Local setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the values from Supabase.
3. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
4. Install dependencies with `npm install`.
5. Start with `npm run dev`.

No production hosting is configured by this repository.
