import Image from "next/image";
import Link from "next/link";
import { absoluteUrl, marketingPath, type MarketingLocale } from "@/shared/config/seo";
import { marketingCopy } from "@/shared/i18n/marketing";
import { screenshotPath, SCREENSHOT_REVISION } from "@/shared/config/screenshots";
import { BrandMark } from "@/shared/ui";
import styles from "./about-view.module.scss";

const languages = { en: "EN", uk: "УКР", ru: "РУС" } as const;

export function AboutView({ locale = "en" }: { locale?: MarketingLocale }) {
  const copy = marketingCopy[locale];
  const url = absoluteUrl(marketingPath(locale));
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite", "@id": `${absoluteUrl("/")}#website`,
        name: "DeepGym", url: absoluteUrl("/"), inLanguage: ["en", "uk", "ru"],
      },
      {
        "@type": "WebPage", "@id": `${url}#webpage`, url, name: copy.title,
        description: copy.intro, inLanguage: locale,
        isPartOf: { "@id": `${absoluteUrl("/")}#website` },
        mainEntity: { "@id": `${url}#app` },
      },
      {
        "@type": "WebApplication", "@id": `${url}#app`, name: "DeepGym", url,
        description: copy.intro, applicationCategory: "HealthApplication",
        operatingSystem: "Android, iOS, Windows, macOS, Linux",
        browserRequirements: "Requires a modern web browser and an internet connection to sync account data.",
        inLanguage: ["en", "uk", "ru"],
        image: absoluteUrl(`/social/deepgym-${locale}.png?v=${SCREENSHOT_REVISION}`),
        screenshot: absoluteUrl(screenshotPath("new-workout", locale)),
        featureList: copy.features.map((feature) => feature.title),
      },
    ],
  };

  return (
    <div className={styles.page} lang={locale}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <a href="#main" className={styles.skip}>{copy.skip}</a>
      <header className={styles.header}>
        <Link href={marketingPath(locale)} className={styles.brand} aria-label="DeepGym">
          <BrandMark width={34} /><span>DeepGym</span>
        </Link>
        <nav className={styles.navigation} aria-label={copy.featuresNav}>
          <a href="#features">{copy.featuresNav}</a><a href="#install">{copy.installNav}</a><a href="#faq">{copy.faqNav}</a>
        </nav>
        <nav className={styles.languages} aria-label={copy.language}>
          {(Object.keys(languages) as MarketingLocale[]).map((lang) => (
            <Link href={marketingPath(lang)} hrefLang={lang} lang={lang} key={lang} aria-current={locale === lang ? "page" : undefined}>{languages[lang]}</Link>
          ))}
        </nav>
        <Link href="/login" className={styles.open}>{copy.signIn}<span aria-hidden="true"> ↗</span></Link>
      </header>
      <main id="main">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className={styles.intro}>{copy.intro}</p>
            <div className={styles.actions}>
              <Link href="/login" className={styles.cta}>{copy.cta}<span aria-hidden="true"> ↗</span></Link>
              <a href="#features" className={styles.secondary}>{copy.secondary}<span aria-hidden="true"> ↓</span></a>
            </div>
            <p className={styles.availability}>{copy.availability}</p>
          </div>
          <figure className={styles.heroVisual}>
            <div className={styles.halo} aria-hidden="true" />
            <div className={styles.phone}>
              <Image src={screenshotPath("new-workout", locale)} alt={copy.heroAlt} width={780} height={1688} sizes="(max-width: 700px) 260px, 310px" priority />
            </div>
            <figcaption>{copy.demo}</figcaption>
          </figure>
        </section>
        <ul className={styles.strip}>{copy.strip.map((item) => <li key={item}><span aria-hidden="true">✳</span>{item}</li>)}</ul>
        <section className={styles.section} id="features">
          <p className={styles.eyebrow}>{copy.featuresLabel}</p>
          <h2>{copy.featuresTitle}</h2>
          <div className={styles.features}>{copy.features.map((feature, i) => (
            <article key={feature.title}><span className={styles.number} aria-hidden="true">0{i + 1}</span><h3>{feature.title}</h3><p>{feature.body}</p></article>
          ))}</div>
        </section>
        <section className={`${styles.section} ${styles.showcase}`}>
          <h2>{copy.showcaseTitle}</h2>
          <div className={styles.screenshots}>
            {(["home", "progress", "templates"] as const).map((name, i) => <figure key={name}>
              <Image src={screenshotPath(name, locale)} alt={copy.screenshots[i]} width={780} height={1688} sizes="(max-width: 700px) 72vw, 280px" />
              <figcaption>{copy.screenshots[i]}</figcaption>
            </figure>)}
          </div>
          <p className={styles.caption}>{copy.demo}</p>
        </section>
        <section className={styles.section}>
          <p className={styles.eyebrow}>{copy.howLabel}</p><h2>{copy.howTitle}</h2>
          <ol className={styles.steps}>{copy.steps.map((step, i) => <li key={step.title}>
            <span className={styles.stepNumber} aria-hidden="true">{i + 1}</span><h3>{step.title}</h3><p>{step.body}</p>
          </li>)}</ol>
        </section>
        <section className={`${styles.section} ${styles.install}`} id="install">
          <p className={styles.eyebrow}>{copy.installLabel}</p><h2>{copy.installTitle}</h2><p className={styles.intro}>{copy.installBody}</p>
          <div className={styles.steps}>{copy.installSteps.map((step) => <article key={step.title}><h3>{step.title}</h3><p>{step.body}</p></article>)}</div>
          <p className={styles.connection}>{copy.connection}</p>
        </section>
        <section className={`${styles.section} ${styles.faq}`} id="faq">
          <h2>{copy.faqTitle}</h2>
          <div>{copy.faqs.map((faq) => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}</div>
        </section>
        <section className={styles.closing}>
          <BrandMark width={64} /><h2>{copy.closing}</h2><p>{copy.closingBody}</p>
          <Link href="/login" className={styles.cta}>{copy.cta}<span aria-hidden="true"> ↗</span></Link>
        </section>
      </main>
      <footer className={styles.footer}><div><strong>DeepGym</strong><p>{copy.footer}</p></div><Link href="/privacy">{copy.privacy}</Link><a href="https://deepagency.digital">Deep Agency ↗</a></footer>
    </div>
  );
}
