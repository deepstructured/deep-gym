# DeepGym — Setup & Development

Technical guide. For the product tour see [README.md](README.md).

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS 4 + Supabase, Feature-Sliced Design. Installable PWA.

## 1. Install & run

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

> ⚠️ Don't run `npm run build` while `npm run dev` is running — they share
> the `.next` folder and the dev server will start throwing `ChunkLoadError`.

## 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run every file in `supabase/migrations/` in
   numeric order — they create the schema, RLS policies and subsequent
   profile features. The current sequence is `0001_init.sql` through
   `0004_onboarding_release_state.sql`.
3. **Project Settings → API**: copy into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)

> ⚠️ In this repository `.env.local` points at the live Supabase project.
> Migration files are not applied automatically: review them and execute each
> new numbered file manually in the production SQL Editor. Never mutate a real
> user while testing; use `demo@deepgym.app`.

## 3. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an **OAuth client ID** (Web application).
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase **Authentication → Providers → Google**: enable, paste client ID + secret.
4. Supabase **Authentication → URL Configuration**: Site URL = your app origin, add `<origin>/auth/callback` to Redirect URLs.

## 4. Telegram bot (OTP login)

1. Create a bot with [@BotFather](https://t.me/BotFather) → `TELEGRAM_BOT_TOKEN`; bot username (without `@`) → `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
2. `openssl rand -hex 32` → `TELEGRAM_WEBHOOK_SECRET`.
3. **Production** — register the webhook once after deploying:

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<your-domain>/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

4. **Local development** — Telegram can't reach localhost. Instead of the
   webhook run the polling worker alongside `npm run dev`:

   ```bash
   node scripts/telegram-dev-poll.mjs
   ```

   It performs the same linking as the webhook. Run only ONE instance, and
   don't run it if a webhook is registered (they're mutually exclusive).

Login flow: user presses **Start** in the bot once → enters `@username` in the app → bot sends a 6-digit code (5 min TTL, 5 attempts, 60 s resend cooldown) → Supabase session.

## 5. Dev utilities

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run icons` | Verify the curated Night Reverse sources, then install the approved app/PWA/favicon files |
| `npm run icons:check` | Check source and installed brand-asset checksums without writing |
| `npm run avatars:legacy` | Regenerate legacy SVG avatars retained for existing stored profile URLs |
| `npm run verify` | Run typecheck and the non-mutating icon check |
| `npm run precommit` | Run `verify` and `git diff --check` |
| `node scripts/seed-demo.mjs` | Create/reset `demo@deepgym.app` with 8 weeks of data |
| `node scripts/take-screenshots.mjs` | Re-shoot README screenshots (needs dev server + seeded demo) |
| `GET /api/dev/login?email=...` | Passwordless sign-in as any user — **dev builds only**, returns 404 in production |

There are currently no automated tests or configured linter. Use
`npm run precommit` plus browser QA for UI changes. Do not run
`npm run build` while the dev server is active.

The demo seed marks onboarding and the current release announcement as seen so
the standard screenshot flow is not covered by startup UI. Development-only
preview URLs are:

- `/onboarding?preview=1` — five-step onboarding without persisting changes;
- `/?preview-whats-new=1` — current release announcement.

## 6. Product lifecycle versions

`src/shared/config/releases.ts` contains two independent version systems:

- `CURRENT_ONBOARDING_VERSION` controls whether a zero-workout user needs the
  setup flow;
- `CURRENT_RELEASE.sequence` controls whether the user has acknowledged the
  current **What's new** announcement; `label` is display-only.

These values are intentionally independent from both `package.json` and the
service-worker cache version. When publishing a new announcement, increment
the release sequence and update its localized copy in
`src/shared/i18n/translations.ts`. Completing onboarding also acknowledges the
current release, preventing two startup experiences from appearing in a row.

## Architecture (FSD)

```
app/                    # Next.js App Router — thin routes only
src/
  app/                  # app layer: fonts, globals.css, providers
  views/                # pages layer (renamed for Next.js compatibility)
    home | login | onboarding | history | exercises | exercise-detail
    workout-new | workout-edit | settings
  widgets/              # app-shell and global product-experience gate
  features/             # auth, avatar, first-workout, what's-new, workout-form/share,
                        # training-schedule, next-workout, plate-calculator,
                        # machine-info, exercise-stats/compare
  entities/             # user, muscle-group, exercise, workout
  shared/               # ui kit, supabase clients, config, lib
supabase/migrations/    # database schema (run in SQL Editor, in order)
```

Weights are always stored in **kg** (`weight_kg`); the display unit is
resolved per exercise: `exercise.unit ?? profile.unit`.
