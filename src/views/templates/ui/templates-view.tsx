"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkoutTemplates } from "@/entities/workout-template";
import { useI18n } from "@/shared/i18n";
import { AppShell, LibraryTabs } from "@/widgets/app-shell";
import {
  Button,
  EmptyState,
  ErrorNote,
  IconChevronRight,
  IconPlay,
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
      title={t("nav.library")}
      account
      subheader={<LibraryTabs />}
      action={
        <Button
          type="button"
          size="sm"
          variant="lime"
          iconOnly
          aria-label={t("templates.new")}
          onClick={create}
        >
          <IconPlus size={18} />
        </Button>
      }
    >
      {isLoading ? (
        <PageLoader variant="cards" />
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
            <div key={template.id} className={styles.row}>
              <Link
                href={`/templates/${template.id}`}
                className={styles.rowLink}
              >
                <div className={styles.text}>
                  <p className={styles.name}>{template.name}</p>
                  <div className={styles.meta}>
                    <Tag>{template.type}</Tag>
                    <span>
                      {tn("count.exercises", template.exerciseCount)}
                    </span>
                  </div>
                </div>
                <IconChevronRight size={18} className={styles.chevron} />
              </Link>
              {/* One tap from the list straight into a prefilled workout. */}
              <Link
                href={`/workouts/new?template=${template.id}`}
                aria-label={`${t("templates.startWorkout")}: ${template.name}`}
                className={styles.start}
              >
                <IconPlay size={14} />
                {t("templates.start")}
              </Link>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
