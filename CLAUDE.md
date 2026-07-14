# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DeepGym — a mobile-first PWA workout tracker. Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Supabase (Auth + Postgres with RLS), TanStack React Query, Zustand. Detailed docs: [SETUP.md](SETUP.md) (setup, auth providers, dev utilities) and [docs/APP_SCHEMA_RU.md](docs/APP_SCHEMA_RU.md) (full app schema, in Russian).

## Commands

```bash
npm run dev          # dev server
npm run build        # production build — do NOT run while `npm run dev` is running (shared .next folder → ChunkLoadError)
npm run lint         # BROKEN: eslint is not installed and has no config — don't rely on it
npm run typecheck    # tsc --noEmit
npm run icons        # regenerate PWA icons
node scripts/seed-demo.mjs          # create/reset demo@deepgym.app with 8 weeks of data
node scripts/telegram-dev-poll.mjs  # local Telegram OTP (webhook can't reach localhost); run ONE instance, never alongside a registered webhook
node scripts/take-screenshots.mjs   # re-shoot README screenshots (needs dev server + seeded demo)
```

There are no tests. Verify changes with `npm run typecheck`, and in the browser for UI work.

`GET /api/dev/login?email=...` — passwordless sign-in as any user (dev builds only, 404 in production). Use `demo@deepgym.app` for testing.

## ⚠️ Database is production

`.env.local` points at the **live Supabase project with real users**. Never run destructive SQL or mutate data outside the demo user. Migrations in `supabase/migrations/` are applied **manually** in the Supabase SQL Editor, in order — creating a new numbered migration file does not apply it; remind the user to run it.

## Architecture (Feature-Sliced Design)

```
app/                  # Next.js App Router — thin route files only (page = one-line re-export of a view), API routes, middleware auth-gate
src/
  app/                # providers (React Query, i18n), fonts, globals.css
  views/              # FSD "pages" layer (renamed to avoid Next.js clash): home, login, history, exercises, exercise-detail, workout-new, workout-edit, settings
  widgets/            # app-shell (header + bottom tab bar)
  features/           # auth, workout-form, plate-calculator, machine-info, exercise-stats, exercise-compare, avatar
  entities/           # user, muscle-group, exercise, workout — each with api/queries.ts (React Query hooks) + model/types.ts
  shared/             # ui kit (src/shared/ui), supabase clients, config, lib, i18n
supabase/migrations/  # numbered SQL files, run manually in SQL Editor
```

FSD import rule: layers import only downward (views → widgets → features → entities → shared). Each slice exposes its public API via `index.ts` — import from the slice root, not deep paths.

Key locations:
- **Supabase clients** — `src/shared/lib/supabase/`: `client.ts` (browser), `server.ts` (server components/routes), `admin.ts` (service-role, server-only).
- **Server state** — React Query hooks in each entity's `api/queries.ts`. **Local state** — Zustand; the new-workout draft persists to localStorage so input survives app closes.
- **i18n** — `src/shared/i18n/` (context + translations); UI strings go through it, not hardcoded.
- **UI kit** — `src/shared/ui/` (button, sheet, calendar, segmented, …), exported via `index.ts`. Styling: Tailwind 4 + SCSS modules for some components.

## Domain conventions

- Weights are **always stored in kg** (`weight_kg`). Display unit is resolved per exercise: `exercise.unit ?? profile.unit`.
- Auth: Google OAuth + Telegram OTP (bot sends 6-digit code → `/api/auth/telegram/*`). `middleware.ts` redirects unauthenticated users to `/login`; public paths: `/login`, `/auth`, `/api`, `/offline`.
- **Do not break** `/api/auth/telegram/verify` returning session tokens in its response — the native Expo/RN sibling app (deep-gym-mobile) depends on it.
