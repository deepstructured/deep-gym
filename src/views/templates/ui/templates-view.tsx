"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkoutTemplates } from "@/entities/workout-template";
import { useI18n } from "@/shared/i18n";
import { AppShell } from "@/widgets/app-shell";
import {
  Button,
  EmptyState,
  ErrorNote,
  IconChevronRight,
  IconPlus,
  PageLoader,
  Tag,
} from "@/shared/ui";
import styles from "./templates-view.module.scss";

export function TemplatesView() {
  const router = useRouter();
  const { t, tn } = useI18n();
  const { data: templates, isLoading, error } = useWorkoutTemplates();

  const create = () => router.push("/templates/new");

  return (
    <AppShell
      title={t("templates.title")}
      action={
        <Button
          type="button"
          size="compact"
          variant="lime"
          iconOnly
          aria-label={t("templates.new")}
          onClick={create}
        >
          <IconPlus size={19} />
        </Button>
      }
    >
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorNote message={t("common.error")} />
      ) : !templates || templates.length === 0 ? (
        <EmptyState
          title={t("templates.emptyTitle")}
          hint={t("templates.emptyHint")}
          action={
            <Button type="button" variant="lime" onClick={create}>
              <IconPlus size={17} />
              {t("templates.new")}
            </Button>
          }
        />
      ) : (
        <div className={styles.list}>
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/templates/${template.id}`}
              className={styles.row}
            >
              <div className={styles.text}>
                <p className={styles.name}>{template.name}</p>
                <div className={styles.meta}>
                  <Tag>{template.type}</Tag>
                  <span>{tn("count.exercises", template.exerciseCount)}</span>
                </div>
              </div>
              <IconChevronRight size={18} className={styles.chevron} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
