# Cosplay Match

A GitHub-first, 18+ cosplay dating and private chat application. Users can build cosplay profiles, discover mutually compatible people, match on reciprocal likes, chat in real time, and privately share photos/videos.

## Features

- Email/password authentication
- 18+ age gate enforced in the UI and database
- Cosplay-first profiles with characters, fandoms, bio and city
- Dating preference matching between men and women
- Like/pass discovery with reciprocal-match creation
- Private match list
- Realtime one-to-one chat
- Private image/video sharing up to 25 MB per file
- Block and report controls
- Row Level Security for profiles, matches, messages, reports, blocks and storage objects
- Private storage buckets with signed URLs

## Stack

- Next.js 16.3.3 App Router + TypeScript
- React 19.3
- Supabase Auth
- Supabase Postgres + Row Level Security
- Supabase Realtime
- Supabase Storage

## Local setup

1. Create a new Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Install Node.js 20.9 or newer.
6. Run `npm install`.
7. Run `npm run dev`.
8. Open `http://localhost:3000`.

The repository does **not** configure or require hosting on any OpenAI/ChatGPT server. You can run it locally and deploy it later to any Node.js-capable host.

## Git workflow

The initial build was developed as reviewable feature branches:

- `feat/core-auth-profiles`
- `feat/matching-discovery`
- `feat/realtime-chat-media`
- `feat/mvp-cosplay-match` (integration branch)

Each product slice is merged to `main` through a pull request.

## Security notes before public launch

This repository provides a strong MVP baseline, not a complete trust-and-safety operation. Before opening signups publicly, add email verification requirements, rate limiting, automated abuse/media moderation, a moderator/admin console, legal/privacy documents, retention rules, and a process for responding to reports and underage concerns.
