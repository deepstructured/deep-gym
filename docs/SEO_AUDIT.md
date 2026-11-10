# DeepGym — SEO / PWA audit

Audit date: 2026-10-07. Scope: the Next.js web app, current public production responses, native app metadata, screenshot/documentation refresh and two sets of five Ukrainian paid-social creative assets. The production site changes only after deployment; this is not a claim that search engines have crawled or indexed them.

## Findings and implementation

| Finding before changes | Implemented change |
| --- | --- |
| Public site resolves to an authentication screen; there is no indexable product description. | The anonymous `/` now serves the English product page; `/uk` and `/ru` serve translations, with factual features, demo screenshots, installation instructions, FAQs and sign-in links. Authenticated `/` keeps the personal dashboard. Old `/about` URLs redirect permanently to their corresponding public URLs. |
| Live `robots.txt` and `sitemap.xml` return `307 /login`. | Dedicated public metadata routes, bypassing auth middleware; sitemap contains the three marketing pages and privacy policy. |
| Live login HTML has only the generic description “Personal strength training tracker”; no canonical or social previews. | Central metadata configuration, localized titles/descriptions, canonical, reciprocal hreflang and x-default, OG and Twitter large-image cards. |
| Apex `https://deepgym.fit` returns `308 https://www.deepgym.fit/`. | Canonical default is the verified final host, `https://www.deepgym.fit`. Short visible links may still use deepgym.fit. |
| Private app URLs and preview environments have no explicit index policy. | App/login/offline routes inherit noindex; middleware also sends X-Robots-Tag. Public pages opt into indexing only in production. Vercel preview/development and local/non-HTTPS SEO origins are excluded. Authentication still protects private data. |
| Public content could depend on onboarding and locally stored language. | Marketing bypasses authenticated providers; content language follows the URL in SSR and client navigation. The shared `/` resolves the session to choose product page or dashboard. Heavy app providers load separately. |
| PWA manifest has basic name/icons only. | Stable id/scope, descriptive name, categories, narrow install screenshots and shortcuts. Existing approved brand icons are preserved. Removed unnecessary portrait restriction in the web manifest. |
| Service worker stores every successful page navigation, including authenticated HTML. | Cache only `/uk`, `/ru` and `/offline` HTML; session-dependent `/` is never stored or read from page cache. Normalize tracking parameters, exclude document navigations from asset caching, preserve good network responses on storage failure, and remove only previous DeepGym caches. |
| No purpose-built social images. | Three 1200 × 630 PNGs with the exact brand mark, localized copy and demo interface. Reproducible generator and SVG sources included. |
| README images describe an older interface and omit major current screens. | Refresh the original `docs/screenshots/` captures in place, include separate Progress and Templates screens, and propagate the same current interface to public WebP screenshots and social previews. README now distinguishes web/PWA from the pre-release native app. |
| Native discoverability materials are missing. | Localized native metadata and permissions; factual App Store / Google Play copy in en/uk/ru and release guidance. See `MOBILE_ASO.md`. |

## Public content and structured data

The public pages focus on workout logging, sets/reps/weight, templates, training history, progress charts, equipment memory, plate calculations, kg/lb and PWA installation. These are product-relevant topics, not measured search-volume or ranking claims.

JSON-LD describes WebSite, WebPage and WebApplication, using the same visible product information. No fabricated reviews, ratings, prices, store IDs, endorsements or fitness outcomes are included. FAQ content is visible as native HTML details; no promise of FAQ or software-app rich results is made. Private exercise records are not public SEO content.

Fourteen current web/PWA PNG captures live in `docs/screenshots/`, including
mobile and desktop views, with a dated capture manifest. The 18 WebP images in
`public/screenshots/` show six screens in each of English, Ukrainian and Russian;
the public page uses screenshots in its own interface language. These are
illustrative demo-account records, and custom exercise/template names may remain
in English. Progress depicts the Progress tab; exercise detail has its own
separate capture. Hero imagery has fixed dimensions and prioritized loading;
below-fold screenshots use lazy loading. Native HTML headings, links and details
work without app JavaScript. All public copy lives in `src/shared/i18n/marketing.ts`.

The shared root layout reads the URL-derived language header, so marketing pages are dynamically server-rendered, not statically generated. The session-dependent root must not place authenticated content in a shared public cache. Real-user performance must be measured after deployment; bundle sizes and image weights should be remeasured after each interface/capture refresh.

## Files and configuration

- `src/shared/config/seo.ts`: canonical origin, localized metadata and index policy.
- `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`: public discovery and installation metadata.
- `public/social/deepgym-{en,uk,ru}.png`: social previews.
- `scripts/generate-social-images.mjs`: regenerate with `node scripts/generate-social-images.mjs` (requires the installed sharp dependency).
- `assets/seo/`: exact vector source exports for review.
- `docs/screenshots/`: original web/PWA captures used by the GitHub README; refresh existing filenames rather than retaining old UI alongside a second set.
- `public/screenshots/`: web derivatives of the same current capture set; not native store screenshots.
- `marketing/creatives/2026-10/`: five Ukrainian 1080 × 1350 paid-social PNGs, original generations, gallery, prompts, advertising copy and per-creative UTM destinations.
- `marketing/creatives/2026-10-product/`: the follow-up Ukrainian product campaign using the current interface and a broader overview of DeepGym.
- `scripts/stories/` and `scripts/render-stories.mjs`: maintained story templates and an offline renderer; two Ukrainian stories use localized screenshots and `/uk`, while the existing English template remains English. Rendered 1080 × 1920 PNGs and their asset-hash manifest are local outputs in ignored `docs/stories/`.
- `output/responsive-qa/`: ten current desktop/tablet captures and their dated hash manifest, refreshed by `scripts/refresh-responsive-screenshots.mjs` through read-only demo navigation. The former twelve before/after snapshots were replaced after all new captures passed; Git history retains those comparisons.
- `apps/mobile/store/listings.json`: native store copy; this does not publish or modify live listings.

`NEXT_PUBLIC_SEO_URL` is optional and defaults to `https://www.deepgym.fit`. Keep it separate from `NEXT_PUBLIC_SITE_URL`, which remains the OAuth/app redirect origin and may be localhost for development. Production OAuth configuration should use the production app origin. Optional `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and `NEXT_PUBLIC_BING_SITE_VERIFICATION` accept actual ownership tokens; no tokens were invented or inserted.

For non-Vercel staging, configure the deployment as non-indexable rather than building a production site with the production canonical and exposing it publicly. Robots files and meta directives are discovery controls, not access control.

## Validation and remaining release work

Validation completed against the final homepage and refreshed screenshots
(repeat after a later route or screenshot change):

- `npm run precommit` passed in the workspace: web/mobile TypeScript, non-mutating brand checks and whitespace validation.
- Clean production build passed in an isolated copy under `/private/tmp/deepgym-seo-validation`, avoiding the separately running development server's `.next` directory. An existing Supabase dependency emits an Edge-runtime warning about `process.version`; this did not fail compilation or route checks.
- Final HTTP checks against the built app passed for SSR content, language, canonical, hreflang, index directives, JSON-LD, versioned OG URLs, private-route redirects, unknown-locale 404s, public metadata endpoints and service-worker cache headers. A real verified demo session renders the dashboard at `/` with `Home · DeepGym` and `noindex`; an anonymous visitor receives the indexable product page. Forged authentication headers do not change that result. Legacy `/about` paths return 308 redirects and preserve tracking parameters.
- Both root outcomes send `private, no-store` and CDN `no-store`. Next.js replaces the middleware's `Vary: Cookie` with its RSC/encoding variants in the final HTTP response; isolation relies on the verified no-store policy, not on that Vary entry.
- Browser QA covered the anonymous root and Ukrainian page at 390 px and 1440 px widths, no horizontal document overflow, loaded current localized images and language navigation updating `html.lang`. Verified demo dashboard → History → dashboard navigation succeeds on the shared root. The public loading boundary was repaired after earlier browser QA exposed a dependency on authenticated i18n context. A locally served production build cannot provide Vercel's hosted analytics script; no application context error occurred in the final navigation checks.
- Thirteen isolated service-worker regression checks passed, including private navigation, image-like document URLs, offline fallback, failed cache writes, redirects, static resource caching and preserving unrelated caches.
- Both sets of five Ukrainian creatives are nonempty PNGs at exactly 1080 × 1350; all copy was visually reviewed and both ZIP integrity checks passed. The additional product campaign groups the key features and includes a freshly captured Ukrainian screen. All campaign destinations use `/uk`; regenerate a bundle if its links or assets change. OG images are exactly 1200 × 630 and come from the checked-in generator.

No Supabase migrations or real-user data changes are needed for this SEO work. The existing mobile migration requirements are documented separately and were not applied. No field-performance score or ranking result was measured or claimed.

After deploying:

1. Confirm the final host still resolves to `www.deepgym.fit`. If you change the hosting primary domain, update `NEXT_PUBLIC_SEO_URL` and redirects together. Avoid duplicate independently served www/apex content.
2. Open `/`, `/uk`, `/ru`, `/privacy`, `/robots.txt`, `/sitemap.xml` and the OG images without authentication. Confirm public `200` responses, correct canonicals, production index directives and correct content types. Check the permanent legacy redirects and confirm that an authenticated visit to `/` still opens the personal dashboard with private cache/index policy.
3. Verify the domain in Google Search Console (DNS or actual verification token) and Bing Webmaster Tools. Submit `https://www.deepgym.fit/sitemap.xml`; inspect the Ukrainian product URL and request indexing. Ownership access was not available in this task.
4. Use URL Inspection and the Rich Results Test to inspect rendered content. Validate previews in Meta Sharing Debugger and LinkedIn Post Inspector after deployment, because their cached previews cannot be refreshed using local-only files.
5. Monitor real mobile LCP, INP and CLS using Search Console/CrUX or your chosen first-party RUM pipeline. Local tests do not establish field Core Web Vitals. No tracking pixel or new third-party analytics service was added.
6. Point Ukrainian ads at `/uk` using the provided UTM URLs. Launch, budget, targeting, attribution and store publication remain separate account actions; no ads were launched.
7. For native release, use `MOBILE_ASO.md`: confirm final app IDs, approved 1024 px icon, signed-device validation and real store/privacy/support fields. Store URLs, Smart App Banners and Universal/App Links need verified store IDs/signing identities before configuration.

SEO indexing, rankings and rich results remain search-engine decisions; the work makes the intended public content accessible and consistent.

## References used

- [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Google: localized versions / hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: robots.txt purpose and limits](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Next.js: Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js: sitemap metadata](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Next.js: PWA guidance](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [web.dev: Web Vitals](https://web.dev/articles/vitals)
- Mobile listing/localization primary sources are linked in `MOBILE_ASO.md`.
