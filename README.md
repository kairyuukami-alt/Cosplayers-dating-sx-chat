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
- Sender message deletion for both participants
- View-once image/video mode with short-lived access
- Block and report controls
- Separate platform-support chat
- Creator/admin support console that can find any registered user and start a clearly labeled support conversation
- Row Level Security for profiles, matches, messages, reports, blocks, support threads and storage objects
- Private storage buckets with signed URLs

## Privacy model

Private dating conversations stay limited to the matched participants. The creator/admin console is deliberately separated from dating chats and does not provide a hidden reader for private conversations.

The application does not silently copy user chat media to Google Drive or another hidden backup. If you later add backup/retention, disclose it in the privacy policy and product before collecting user media.

## Stack

- Next.js 16.3.3 App Router + TypeScript
- React 19.3
- Supabase Auth
- Supabase Postgres + Row Level Security
- Supabase Realtime
- Supabase Storage

## Local setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Then run `supabase/privacy-chat-upgrade.sql`.
4. Copy `.env.example` to `.env.local`.
5. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
6. Install Node.js 20.9 or newer.
7. Run `npm install`.
8. Run `npm run dev`.
9. Open `http://localhost:3000`.

The repository does **not** configure or require hosting on any OpenAI/ChatGPT server. You can run it locally and deploy it later to any Node.js-capable host.

## Creator support console

The creator console lives at `/admin/support` and uses Supabase `app_metadata` for authorization. Do not put an admin flag in `user_metadata` because users can edit that field themselves.

After you create your own account, mark that account as admin using a trusted server-side/admin workflow by setting:

```json
{
  "role": "admin"
}
```

inside the user's **app metadata**. Sign out and sign back in so the refreshed JWT contains the new role. The creator console can then search users and send them platform-support messages. Users see those messages under the **Support** tab and they are clearly labeled as platform support.

## Git workflow

The initial build was developed as reviewable feature branches and pull requests. New privacy/chat work is kept on its own feature branch before merge.

## Security notes before public launch

This repository provides a strong MVP baseline, not a complete trust-and-safety operation. Before opening signups publicly, add email verification requirements, rate limiting, automated abuse/media moderation, legal/privacy documents, a disclosed retention policy, and a process for responding to reports and underage concerns.

For view-once media, the recipient receives a short-lived signed link and the database marks the item as consumed so it cannot normally be signed again by that recipient. As with any app, this cannot prevent someone from taking a screenshot, screen recording, or using another device to capture what they see.
