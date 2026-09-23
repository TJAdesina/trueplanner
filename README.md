# TruePlanner

**Keep the day moving.**

A calm, intelligent productivity companion that helps you recover from
disrupted plans and keep making meaningful progress. Not a planner. Not a
task manager. Not a motivational coach. A recovery system for real-world
productivity.

This repository contains the full MVP: the marketing landing page and the
working web app (accounts, today's plan, AI-assisted check-ins, and an
honest end-of-day summary).

---

## 1. What's inside

- **Landing page** (`/`) — the full brand story: hero, problem, solution,
  the Cut / Shrink / Move framework, a product demo, features, and a final
  call to action.
- **Accounts** (`/signup`, `/login`) — email/password auth via Supabase.
- **Dashboard** (`/dashboard`) — today's overview, the current task, a full
  timeline, and an honest progress summary.
- **Check-in engine** — a deterministic system (see `lib/triggers.ts`)
  watches your tasks and decides *when* something needs your attention
  (a task ran over, the day is drifting, tasks are piling up, or one task
  keeps getting rescheduled). A separate writer decides *how* to phrase it
  — either the built-in rule-based writer, or live Gemini calls if you add
  an API key. You always get to **Cut**, **Shrink**, or **Move** — never a
  guilt trip.
- **End of day** (`/dashboard/end-of-day`) — a reflective summary that
  counts completed, started, shrunk, moved, and cut tasks, not just
  checkmarks.
- **Settings** (`/dashboard/settings`) — notification behavior, check-in
  sensitivity, quiet hours, working hours, appearance, and data export.

## 2. Tech stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** — Postgres database + email/password auth
- **Gemini API** (`gemini-3.5-flash-lite`) for live check-in copy, with an
  automatic on-brand rule-based fallback when no key is configured

Nothing about the app depends on any single host — it deploys cleanly to
Vercel, Netlify, or any Node hosting that supports Next.js.

---

## 3. Set up Supabase (5 minutes)

1. Go to [supabase.com](https://supabase.com) and create a free account,
   then click **New project**. Pick any name/region and set a database
   password (you won't need to remember it for this app).
2. Once the project is ready, open **SQL Editor** in the left sidebar,
   click **New query**, paste in the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql) from this repo, and click
   **Run**. This creates every table, security policy, and trigger the app
   needs.
3. Open **Settings → API**. You'll need two values from this page:
   - **Project URL**
   - **anon public** key
4. By default, Supabase requires users to confirm their email before they
   can sign in. For local testing, you can turn this off under
   **Authentication → Providers → Email → Confirm email** (toggle off), or
   just check the inbox you sign up with. Leave it on for a production app.

That's the entire backend. No servers to manage.

## 4. (Optional) Set up live AI check-ins

The app works fully without this step — check-ins are written by a
built-in, on-brand rule-based generator by default.

To use live Gemini-generated copy instead:

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   and create a free API key.
2. Add it as `GEMINI_API_KEY` in your environment (see below). The model
   used is `gemini-3.5-flash-lite`, set via `GEMINI_MODEL`.

The API key is only ever used **server-side** (inside a Next.js API route)
— it's never exposed to the browser. If the key is missing, invalid, or
the request fails for any reason, TruePlanner automatically falls back to
the rule-based writer so check-ins never break.

You can also turn AI processing off entirely per-user from
**Settings → Privacy & data → Allow AI processing for check-ins**.

## 5. Run it locally

Requires [Node.js](https://nodejs.org) 18.18 or newer.

```bash
# 1. Install dependencies
npm install

# 2. Set up your environment file
cp .env.example .env.local
```

Open `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key

# optional — leave blank to use the built-in rule-based check-in writer
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

```bash
# 3. Start the dev server
npm run dev
```

Visit `http://localhost:3000`. Sign up for an account, add a task, and
you're in.

---

## 6. Deploy it (ship it today)

### Push this to GitHub

```bash
git init
git add .
git commit -m "Initial commit: TruePlanner MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/trueplanner.git
git push -u origin main
```

(`.env.local` is already excluded via `.gitignore` — your keys never get
committed.)

### Deploy on Vercel (recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub
   repository you just pushed.
2. Vercel auto-detects Next.js — no build configuration needed.
3. Under **Environment Variables**, add the same three (or four) values
   from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (optional)
   - `GEMINI_MODEL` (optional, defaults to `gemini-3.5-flash-lite`)
4. Click **Deploy**. You'll have a live URL in about a minute.

### Deploy on Netlify

Netlify also supports Next.js natively — import the repo, add the same
environment variables under **Site settings → Environment variables**, and
deploy. No extra configuration is required for this project.

### One more Supabase step after deploying

In your Supabase project, go to **Authentication → URL Configuration** and
add your live domain (e.g. `https://trueplanner.vercel.app`) to **Site
URL** and **Redirect URLs** — otherwise email confirmation links will
redirect back to `localhost`.

---

## 7. How the check-in engine works

This is the core mechanic of the product, so it's worth understanding the
split:

- **`lib/triggers.ts`** — a fully deterministic function. It looks at your
  tasks and your settings and decides whether *right now* is a moment worth
  interrupting you for for four sitations: a task ran over its time
  (overrun), the day is drifting with little progress (drift), tasks are
  piling up (accumulation), or a task keeps getting rescheduled (repeated).
  This file never generates language, and never calls any AI — this is
  what keeps the product's notification behavior predictable.
- **`lib/aiWriter.ts`** — the deterministic, on-brand fallback copywriter.
  No API key required.
- **`lib/gemini.ts`** + **`app/api/checkin/route.ts`** — when a key is
  configured, the situation detected above is handed to Gemini with a
  system prompt encoding the brand voice (calm, direct, never guilt-driven,
  always leaves room for Cut/Shrink/Move). If that call fails for any
  reason, the route falls back to `aiWriter.ts` automatically.

Every check-in — however it was written — is logged to the `checkins`
table, and every task status change is logged to `task_events`, so the
end-of-day summary reflects what actually happened, not just what got
checked off.

## 8. Project structure

```
app/
  page.tsx                  Landing page
  login/, signup/            Auth pages
  dashboard/
    page.tsx                 Today's dashboard
    settings/                Settings
    end-of-day/               Reflective daily summary
  api/checkin/route.ts        Generates a check-in (Gemini or template)
  auth/callback/route.ts      Supabase email-confirmation callback
components/
  landing/                   Landing page sections
  dashboard/                 Dashboard sections, task/shrink/move/cut modals
  auth/, ui/                  Shared building blocks
hooks/
  useTasks.ts                Task CRUD + recovery actions (cut/shrink/move)
  useProfile.ts               Settings/profile
  useCheckinEngine.ts          Polls for situations, requests a check-in
lib/
  triggers.ts                 Deterministic "when to check in" engine
  aiWriter.ts                 Rule-based fallback check-in copywriter
  gemini.ts                   Live Gemini API client
  taskUtils.ts, time.ts        Shared helpers
  types.ts                    Shared TypeScript types
  supabase/                   Browser/server Supabase clients + middleware
supabase/schema.sql           Full database schema, RLS policies, triggers
```

## 9. Brand system reference

Colors, type pairing (Fraunces for headings, Inter for UI/body), voice, and
UI direction all follow the brand outline this build was based on —
encoded directly into `tailwind.config.ts` and `app/globals.css`. If your
brand spec changes, those two files are the place to start.

## 10. What's intentionally out of scope for this MVP

- Push notifications when the browser tab is fully closed (v1 uses the
  in-tab Notification API, which covers background tabs but not a closed
  browser). A future version could add a service worker + push backend.
- Multi-device real-time sync beyond what Supabase gives "for free" on
  refresh (no live websocket subscriptions yet — reload to see updates
  made elsewhere).
- Recurring tasks, projects/sub-tasks, and calendar import.

These were left out deliberately to ship a focused, working core loop
first; the schema (`profile.project`, `parent_task_id`, etc.) already
leaves room to grow into them.

---

Questions or issues while setting this up? Everything above should get you
from a fresh clone to a live, working product. If something in Supabase or
Vercel's UI has moved since this was written, their own docs
([supabase.com/docs](https://supabase.com/docs),
[vercel.com/docs](https://vercel.com/docs)) are the fastest way to find the
current equivalent step.
