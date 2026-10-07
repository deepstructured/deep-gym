# DeepGym mobile discoverability and store copy

Prepared 2026-10-07. The native app remains a pre-release implementation; this document does not assert that an App Store or Google Play listing is live.

## Implemented

- `apps/mobile/app.json` describes the actual workout tracker, declares English, Ukrainian and Russian for iOS, and references localized native metadata.
- `apps/mobile/locales/` contains the native display name and translated iOS profile-photo permission text. A native rebuild is required to install these changes. These files do not change the profile's selected interface language.
- `apps/mobile/store/listings.json` contains ready-to-copy English, Ukrainian and Russian titles, Apple subtitles/keywords, Google short descriptions and full descriptions. Store publication is a separate action; Expo's `description` does not update store listings.

The current supported feature claims were checked against native screens and shared domain code: workout logging, sets/weights/repetitions, warm-up flags, saved drafts, custom exercises, templates, schedules, history, progress charts, personal records, body-weight measurements, widgets, plate calculations, kg/lb and three interface languages. Copy makes no claims about guaranteed fitness results, AI coaching, nutrition, wearables, offline cloud saves, pricing or unavailable Apple sign-in.

## Listing fields

Use the `title` for the store listing only; keep the installed app name **DeepGym**. The proposed category is **Health & Fitness**. Select the corresponding category label in each console.

Apple permits 30 characters for the app name, 30 for the subtitle and 100 for comma-separated keywords. Keywords should describe the real product, without competitor names or repeated filler. See [Apple's product-page guidance](https://developer.apple.com/app-store/product-page/).

Google permits 30 characters for the app name, 80 for the short description and 4,000 for the full description. See [Google Play's store-listing fields](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en).

All current JSON fields fit these limits. Apple keywords are hypotheses based on product relevance, not search-volume research. Revisit wording using actual store impressions, search terms and conversion after release.

## Screenshot sequence

Capture the signed native build with the demo account. Use the actual native interface and supported device sizes; web screenshots and AI-generated UI are not proof of the native app's appearance. Suggested panels:

The refreshed repository captures in `docs/screenshots/`, their
`public/screenshots/` exports and the GitHub README all document the web/PWA.
They must not be uploaded as native store screenshots. The public site uses
`/` (English), `/uk` and `/ru`; an authenticated `/` visit opens the web dashboard.

| Screen | English caption | Ukrainian caption | Russian caption |
| --- | --- | --- | --- |
| Workout form | Every set, recorded | Кожен підхід — у щоденнику | Каждый подход — в дневнике |
| Exercise progress | See your training progress | Бачте прогрес у тренуваннях | Следите за прогрессом |
| Templates | Your routine, ready to repeat | Ваше тренування завжди під рукою | Ваша тренировка под рукой |
| History | Your training history | Історія ваших тренувань | История ваших тренировок |
| Home widgets | Your training at a glance | Усе про тренування на одному екрані | Всё о тренировках на одном экране |

Keep captions outside interactive controls, show plausible demo data and localize the captured UI to match each listing. Do not add review scores, badges, download counts or before/after promises without evidence. Apple recommends showing the actual app UI and prioritizing the first screenshots; see [Apple's screenshot guidance](https://developer.apple.com/app-store/product-page/#screenshots).

## Steps that require release infrastructure

1. Confirm the final iOS bundle ID and Android package. Both currently use the provisional `app.deepgym.mobile`; do not change identifiers of an already registered app without checking the store records.
2. Export the approved brand icon at 1024 × 1024 for iOS and prepare platform-specific adaptive icon assets. The current native `assets/icon.png` is a 512 px development asset. See [Expo's app-icon guidance](https://docs.expo.dev/develop/user-interface/app-icons/).
3. Verify the signed build on devices, including Google/Telegram login, first-run setup, workout save/edit, photo selection, privacy policy and account deletion. Apple login remains disabled; do not list it as supported. Native workout saves also require the manually applied `0009_atomic_workout_write.sql` migration described in the mobile README.
4. Use the real deployed HTTPS public site for the store marketing/support/privacy fields and verify that `/privacy` is reachable without signing in. Review current operator/support details in `packages/core/src/privacy-policy.ts` before submission. Complete store privacy/data-safety and age-rating forms from actual data flows and included SDKs.
5. Enter the localized listing copy and device screenshots in App Store Connect and Play Console. Store ownership, signing credentials, developer-account details, release availability and final URLs are not present in these preparation files.
6. Once real store listings exist, add their verified URLs to the public website and PWA's `related_applications` where appropriate. An iOS Smart App Banner requires the real numeric App Store ID. Universal Links/App Links require a confirmed domain, signing identity and deployed association files; do not invent them from the custom `deepgym://` scheme.

Native metadata localization follows [Expo's localization guide](https://docs.expo.dev/guides/localization/#translating-app-metadata). Verify translated OS prompts in a rebuilt app; Expo Go does not represent the app's installed native metadata.
