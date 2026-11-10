"use client";

import { useI18n } from "@/shared/i18n";
import { Button } from "../button/button";
import { ErrorNote } from "../error-note/error-note";

export function QueryError({ onRetry, retrying = false, message }: {
  onRetry: () => void;
  retrying?: boolean;
  message?: string;
}) {
  const { t } = useI18n();
  return (
    <div style={{ display: "grid", gap: 12, paddingBlock: 12 }}>
      <ErrorNote message={message ?? t("common.error")} />
      <Button type="button" variant="surface" onClick={onRetry} loading={retrying}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
