# DeepGym mobile

Expo / React Native app in the same npm workspace as the Next.js web app.

## Local setup

1. From the repository root run `npm install`.
2. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and fill in the public Supabase URL/anon key, the deployed web app URL for Telegram OTP and account deletion, the Telegram bot username, and the public privacy policy URL when ready. Never put `SUPABASE_SERVICE_ROLE_KEY` in an `EXPO_PUBLIC_` variable.
3. Run `npm run mobile:go` from the root for Expo Go. Open the printed QR with the iPhone Camera while the phone and laptop are on the same Wi-Fi. On a physical iPhone, sign in to the same Expo account in Expo Go and on the laptop (`npx expo login`). For a custom development build use `npm run mobile` instead. The Expo server normally uses port 8081 and can run alongside Next.js on port 3000.
4. Run `npm run mobile:typecheck` for mobile TypeScript checks. `npm run typecheck` checks the web app only.

The app reads and writes the same Supabase project as the web app. Its auth session is stored on the device with AsyncStorage; the server's RLS policies remain the data access boundary.

`EXPO_PUBLIC_WEB_URL` must be reachable from the iPhone. `http://localhost:3000` points at the phone itself, not the laptop. Use the deployed HTTPS web API, or the laptop's Wi-Fi address if testing a local Next server. Google OAuth needs this app's custom URL scheme and therefore cannot finish inside Expo Go. Telegram OTP can be used for Expo Go when its web API is reachable; use only a demo identity while testing writes against the live database. The native Apple login should be validated in a signed development build.

## Database migration

Creating and editing workouts in the native app calls `public.save_workout_atomic`. Review and apply `supabase/migrations/0009_atomic_workout_write.sql` manually in the Supabase SQL Editor **after** migration 0008. This keeps the workout and all its sets in one transaction and deduplicates a retry from the same device. The app does not fall back to multi-request writes when the function is missing. Refresh the PostgREST schema cache if a just-applied function is not visible yet. The configured Supabase project contains real users; use only the demo account for QA.

## First run

An authenticated profile with an older `onboarding_version` enters the five-step native guide only when its exact workout count is zero. Existing athletes with workout history enter the app directly. The guide collects language, name/avatar, weight unit, bar/plate defaults and training schedule, then shows a short tour. It writes one profile update only when the athlete finishes; that update also acknowledges the current release. Release notes appear on Home afterward only when their acknowledgement is still behind. If the eligibility count cannot be read, the app shows a retry action instead of guessing.

For safe UI review, `/onboarding?preview=1` is available in development builds and never saves the draft. `/?preview-whats-new=1` shows the release sheet without acknowledging it. `/onboarding?replay=1` reopens the guide for an authenticated athlete and saves changes only on completion.

## OAuth setup

Google sign-in redirects to `deepgym://auth/callback`. Add this exact URL (or `deepgym://**`) in **Supabase Auth → URL Configuration → Redirect URLs** before testing Google login. The Supabase Google provider remains the same one used by the web app. OAuth needs an Expo development build or a standalone build; Expo Go cannot receive this app's custom URL scheme. `eas.json` includes development builds for devices and iOS Simulator. Configure the same public environment variables in EAS before cloud builds. Telegram OTP works through the deployed Next.js API at `EXPO_PUBLIC_WEB_URL` and can be tested in Expo Go.

On iOS, the login screen also offers the native **Continue with Apple** button when the device supports it. `app.json` enables the Apple Sign In entitlement through `expo-apple-authentication`. Before a device or TestFlight test, enable the Apple provider in Supabase Auth, configure Sign in with Apple for the final iOS bundle identifier in Apple Developer, and build with a provisioning profile that includes the capability. The native flow passes a nonce and Apple's identity token to Supabase. Apple only provides a person's name on the first authorization, so the app saves it immediately. This flow cannot be validated by the JavaScript bundle export alone; test it on an Apple-signed iOS build.

Account deletion in mobile Settings calls `DELETE /api/account/delete` on `EXPO_PUBLIC_WEB_URL`. Deploy the matching web API before testing deletion from a mobile build. Set `EXPO_PUBLIC_PRIVACY_POLICY_URL` to a public HTTPS policy page to show the policy in mobile Settings; the same URL is required in App Store Connect. The policy content needs product and legal review before submission.

## Store identifiers and assets

`app.json` currently uses the **provisional** iOS bundle ID `app.deepgym.mobile` and Android package `app.deepgym.mobile`. Confirm the final identifier before the first App Store/TestFlight build; changing it later creates a different app identity. `assets/icon.png` is the existing approved 512 px PWA icon copied for development. A 1024 px App Store icon export from the brand source is still needed for submission.

The root `app/` and `src/` directories remain the Next.js app. Shared, platform independent logic lives in `packages/core`; mobile routes live in `apps/mobile/app` and mobile implementation in `apps/mobile/src`.

## Current port status

This is the first native milestone, not an App Store release build. The main flows are implemented: authentication, onboarding, Home, History, workout create/edit/detail, exercise and template library/detail, Progress, Settings and the plate calculator. Workout creation uses a stable key in the local and cloud draft, with an atomic database write after the keyed cloud copy is confirmed.

The native Home currently renders and customizes the nine default widgets. Other widget types from a web-saved layout stay in the layout data but do not render yet. Remaining parity work includes the web's richer progress comparisons, workout image sharing and additional workout copy modes. Verify the complete flow, appearance, OAuth, and account deletion on a signed iPhone build before inviting testers; a JavaScript bundle export cannot establish device behavior.
