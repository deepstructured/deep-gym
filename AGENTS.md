# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

DeepGym — a mobile-first PWA workout tracker. Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Supabase (Auth + Postgres with RLS), TanStack React Query, Zustand. Detailed docs: [SETUP.md](SETUP.md) (setup, auth providers, dev utilities) and [docs/APP_SCHEMA_RU.md](docs/APP_SCHEMA_RU.md) (full app schema, in Russian).

## Commands

```bash
npm run dev          # dev server
npm run build        # production build — do NOT run while `npm run dev` is running (shared .next folder → ChunkLoadError)
npm run typecheck    # tsc --noEmit
npm run icons        # verify sources, then install approved brand/PWA/favicon assets
npm run icons:check  # checksum-check sources and installed assets without writing
npm run avatars:legacy # regenerate legacy SVG avatars kept for stored profile URLs
npm run verify       # typecheck + non-mutating brand asset verification
npm run precommit    # verify + git diff --check
node scripts/seed-demo.mjs          # create/reset demo@deepgym.app with 8 weeks of data
node scripts/telegram-dev-poll.mjs  # local Telegram OTP (webhook can't reach localhost); run ONE instance, never alongside a registered webhook
node scripts/take-screenshots.mjs   # re-shoot README screenshots (needs dev server + seeded demo)
```

There are no automated tests or configured linter. Run `npm run verify` and verify UI changes in the browser; run `npm run precommit` before handoff or commit.

`GET /api/dev/login?email=...` — passwordless sign-in as any user (dev builds only, 404 in production). Use `demo@deepgym.app` for testing.

## ⚠️ Database is production

`.env.local` points at the **live Supabase project with real users**. Never run destructive SQL or mutate data outside the demo user. Migrations in `supabase/migrations/` are applied **manually** in the Supabase SQL Editor, in order — creating a new numbered migration file does not apply it; remind the user to run it.

## Architecture (Feature-Sliced Design)

```
app/                  # Next.js App Router — thin route files only (page = one-line re-export of a view), API routes, middleware auth-gate
src/
  app/                # providers (React Query, i18n), fonts, globals.css
  views/              # FSD "pages" layer: home, login, onboarding, history, exercises, exercise-detail, workout-new, workout-edit, settings
  widgets/            # app-shell (header + bottom tab bar), product-experience gate
  features/           # auth, avatar, first-workout, what's-new, workout-form/share, training-schedule, next-workout, stats/compare, machine-info, plate-calculator
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
- **Product lifecycle versions** — `src/shared/config/releases.ts`; onboarding and release-note sequences are independent from `package.json` and the service-worker cache version.
- **First-run/release gate** — `src/widgets/product-experience/`; onboarding view is under `src/views/onboarding/`, and release content is under `src/features/whats-new/`.

## Onboarding and release notes

- The authenticated `/onboarding` route is required when the user's `onboarding_version` is behind `CURRENT_ONBOARDING_VERSION` **and** their exact workout count is zero.
- Existing users with workout history are backfilled as complete by migration `0004_onboarding_release_state.sql`; existing zero-workout users keep version `0` and receive the setup flow.
- The five-step flow collects language, display name/avatar, unit/bar/plates, training schedule (fixed or explicitly flexible), then explains the core workout flow. Its draft is session-only; completion is persisted on `profiles`.
- After setup, `src/features/first-workout/` provides a zero-workout Home checklist, an in-form contextual tip, and a success sheet after the first saved session.
- Completing onboarding also acknowledges the current release so a new user never receives onboarding and “What's new” back-to-back.
- `ProductExperience` resolves in strict order: profile/workout eligibility → onboarding redirect → versioned “What's new” sheet → application. Do not introduce a second competing startup modal.
- `CURRENT_RELEASE.sequence` is the monotonic persisted acknowledgement. Increment it only for a real announcement and update all localized release copy at the same time. `CURRENT_RELEASE.label` is display-only.
- `/onboarding?replay=1` reopens the guide without changing eligibility until completion. Development-only previews are `/onboarding?preview=1` and `/?preview-whats-new=1`.
- Demo seeding marks onboarding and the current release complete so README screenshots and normal UI QA are not covered by lifecycle UI.

## Domain conventions

- Weights are **always stored in kg** (`weight_kg`). Display unit is resolved per exercise: `exercise.unit ?? profile.unit`.
- Auth: Google OAuth + Telegram OTP (bot sends 6-digit code → `/api/auth/telegram/*`). `middleware.ts` redirects unauthenticated users to `/login`; public paths: `/login`, `/auth`, `/api`, `/offline`.
- **Do not break** `/api/auth/telegram/verify` returning session tokens in its response — the native Expo/RN sibling app (deep-gym-mobile) depends on it.
- Built-in legacy SVG avatar URLs must remain available because existing `profiles.avatar_url` values may reference them; current selectable presets are the checked-in DeepGym WebP pixel avatars.
