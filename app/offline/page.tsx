"use client";

import { useI18n } from "@/shared/i18n";
import { BrandMark } from "@/shared/ui";
import styles from "./offline.module.scss";

export default function OfflinePage() {
  const { t } = useI18n();
  return (
    <main className={styles.main}>
      <BrandMark width={72} className={styles.mark} />
      <p className={styles.title}>Offline</p>
      <p className={styles.message}>{t("offline.message")}</p>
    </main>
  );
}
