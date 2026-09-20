"use client";

import type { CSSProperties } from "react";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { BrandMark } from "../brand-mark/brand-mark";
import styles from "./page-loader.module.scss";

type LoaderVariant =
  | "brand"
  | "list"
  | "cards"
  | "chart"
  | "detail"
  | "form"
  | "settings"
  | "dashboard"
  | "progress";

/** Quiet placeholders keep the page's shape while its first request resolves. */
export function PageLoader({
  variant = "brand",
  fullscreen = false,
  className,
}: {
  variant?: LoaderVariant;
  fullscreen?: boolean;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        styles.pageLoader,
        styles[variant],
        fullscreen && styles.fullscreen,
        className,
      )}
      role="status"
      aria-label={t("common.loading")}
      aria-busy="true"
    >
      {variant === "brand" ? (
        <div className={styles.brandInner} aria-hidden="true">
          <div className={styles.mark}><BrandMark width={40} /></div>
          <div className={styles.loadingTrack}><span /></div>
          <span className={styles.loadingLabel}>{t("common.loading")}</span>
        </div>
      ) : (
        <div className={styles.placeholder} aria-hidden="true">
          <Placeholder variant={variant} />
        </div>
      )}
    </div>
  );
}

/** A neutral shape for inline content that loads independently of its page. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <span aria-hidden="true" className={cn(styles.bone, className)} style={style} />;
}

function Placeholder({ variant }: { variant: Exclude<LoaderVariant, "brand"> }) {
  if (variant === "chart") return <Chart />;

  if (variant === "list" || variant === "cards") {
    return <Rows count={variant === "cards" ? 6 : 4} />;
  }

  if (variant === "progress") {
    return (
      <>
        <div className={styles.overview}>
          <Metrics />
          <Chart />
        </div>
        <div className={styles.analysis}>
          <Chart />
          <Rows count={3} />
        </div>
      </>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className={styles.dashboardGrid}>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className={styles.dashboardCard}>
            <Skeleton className={styles.title} />
            <Skeleton className={styles.value} />
            <Skeleton className={styles.caption} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "settings") {
    return (
      <>
        <div className={styles.profile}>
          <Skeleton className={styles.avatar} />
          <div className={styles.rowText}>
            <Skeleton className={styles.title} />
            <Skeleton className={styles.caption} />
          </div>
        </div>
        <Rows count={5} />
      </>
    );
  }

  if (variant === "form") {
    return (
      <>
        <div className={styles.fieldGroup}>
          <Skeleton className={styles.caption} />
          <Skeleton className={styles.field} />
          <Skeleton className={styles.caption} />
          <Skeleton className={styles.field} />
        </div>
        <Rows count={3} />
      </>
    );
  }

  return (
    <div className={styles.detailGrid}>
      <div className={styles.detailSide}>
        <Skeleton className={styles.title} />
        <div className={styles.summaryCard}>
          <Skeleton className={styles.caption} />
          <Skeleton className={styles.value} />
          <Skeleton className={styles.title} />
        </div>
        <Rows count={2} />
      </div>
      <div className={styles.detailMain}><Chart /><Rows count={3} /></div>
    </div>
  );
}

function Rows({ count }: { count: number }) {
  return (
    <div className={styles.rows}>
      {Array.from({ length: count }, (_, index) => (
        <div className={styles.row} key={index}>
          <Skeleton className={styles.square} />
          <div className={styles.rowText}>
            <Skeleton className={styles.title} style={{ width: `${62 - (index % 3) * 10}%` }} />
            <Skeleton className={styles.caption} />
          </div>
          <Skeleton className={styles.end} />
        </div>
      ))}
    </div>
  );
}

function Metrics() {
  return (
    <div className={styles.metrics}>
      {Array.from({ length: 4 }, (_, index) => (
        <div className={styles.metric} key={index}>
          <Skeleton className={styles.caption} />
          <Skeleton className={styles.value} />
        </div>
      ))}
    </div>
  );
}

function Chart() {
  return (
    <div className={styles.chart}>
      <Skeleton className={styles.title} />
      <Skeleton className={styles.chartArea} />
      <div className={styles.axis}>
        <Skeleton className={styles.caption} />
        <Skeleton className={styles.caption} />
        <Skeleton className={styles.caption} />
      </div>
    </div>
  );
}
