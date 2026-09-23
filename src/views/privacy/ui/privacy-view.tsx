"use client";

import {
  getPrivacyPolicy,
  PRIVACY_POLICY_CONTACT,
  PRIVACY_POLICY_DEVELOPER_CONTACT,
} from "@deepgym/core/privacy-policy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/shared/i18n";
import { BrandMark } from "@/shared/ui";
import styles from "./privacy-view.module.scss";

export function PrivacyView() {
  const { lang, t } = useI18n();
  const router = useRouter();
  const policy = getPrivacyPolicy(lang);

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="DeepGym home">
            <BrandMark width={30} />
            <span>DeepGym</span>
          </Link>
          <button
            type="button"
            className={styles.back}
            onClick={() => {
              if (window.history.length > 1) router.back();
              else router.push("/login");
            }}
          >
            {t("common.back")}
          </button>
        </header>

        <article className={styles.document}>
          <p className={styles.eyebrow}>DeepGym</p>
          <h1>{policy.title}</h1>
          <p className={styles.date}>{policy.effectiveDateLabel}</p>
          <p className={styles.overview}>{policy.overview}</p>

          {policy.sections.map((section) => (
            <section key={section.id} id={section.id} className={styles.section}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
          <a className={styles.contact} href={`mailto:${PRIVACY_POLICY_CONTACT}`}>
            {policy.contactAction} ↗
          </a>
        </article>
        <p className={styles.credit}>
          {policy.developerCredit} · <a href="https://deepagency.digital">deepagency.digital</a>
          <br />
          {policy.developerContactLabel}: <a href={`mailto:${PRIVACY_POLICY_DEVELOPER_CONTACT}`}>{PRIVACY_POLICY_DEVELOPER_CONTACT}</a>
        </p>
      </div>
    </main>
  );
}
