"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMuscleGroups } from "@/entities/muscle-group";
import {
  useDeleteWorkoutTemplate,
  useWorkoutTemplate,
} from "@/entities/workout-template";
import { useI18n } from "@/shared/i18n";
import { AppShell } from "@/widgets/app-shell";
import {
  Button,
  ConfirmSheet,
  ErrorNote,
  IconEdit,
  IconPlus,
  PageLoader,
  Tag,
} from "@/shared/ui";
import styles from "./template-detail-view.module.scss";

export function TemplateDetailView({ templateId }: { templateId: string }) {
  const router = useRouter();
  const { t, tn } = useI18n();
  const { data: template, isLoading, error: loadError } =
    useWorkoutTemplate(templateId);
  const { data: groups } = useMuscleGroups();
  const removeTemplate = useDeleteWorkoutTemplate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupNames = new Map((groups ?? []).map((group) => [group.id, group.name]));

  function remove() {
    setError(null);
    removeTemplate.mutate(templateId, {
      onSuccess: () => router.replace("/templates"),
      onError: (mutationError) => {
        setConfirmDelete(false);
        setError((mutationError as Error).message);
      },
    });
  }

  return (
    <AppShell
      title={template?.name ?? t("templates.title")}
      back
      action={
        template ? (
          <button
            type="button"
            aria-label={t("templates.edit")}
            className={styles.edit}
            onClick={() => router.push(`/templates/${templateId}/edit`)}
          >
            <IconEdit size={17} />
          </button>
        ) : null
      }
    >
      {isLoading ? (
        <PageLoader />
      ) : loadError || !template ? (
        <ErrorNote message={t("templates.notFound")} />
      ) : (
        <div className={styles.stack}>
          <div className={styles.summary}>
            <Tag tone="lime">{template.type}</Tag>
            <span>
              {tn(
                "count.exercises",
                template.workout_template_exercises.length,
              )}
            </span>
          </div>

          <section>
            <h2 className={styles.sectionTitle}>
              {t("templates.exercises")}
            </h2>
            {template.workout_template_exercises.length === 0 ? (
              <p className={styles.emptyExercises}>
                {t("templates.emptyExercises")}
              </p>
            ) : (
              <div className={styles.exerciseList}>
                {template.workout_template_exercises.map((item, index) => (
                  <div key={item.id} className={styles.exerciseRow}>
                    <span className={styles.position}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className={styles.exerciseText}>
                      <p className={styles.exerciseName}>{item.exercise.name}</p>
                      <div className={styles.exerciseMeta}>
                        <span>
                          {groupNames.get(item.exercise.muscle_group_id) ?? ""}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{t(`equipment.${item.exercise.equipment}`)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Button
            type="button"
            variant="gradient"
            size="lg"
            block
            disabled={template.workout_template_exercises.length === 0}
            onClick={() =>
              router.push(`/workouts/new?template=${encodeURIComponent(template.id)}`)
            }
          >
            <IconPlus size={18} />
            {t("templates.startWorkout")}
          </Button>

          <Button
            type="button"
            variant="danger"
            size="lg"
            block
            onClick={() => setConfirmDelete(true)}
            loading={removeTemplate.isPending}
          >
            {t("templates.delete")}
          </Button>

          {error && <ErrorNote message={error} />}
        </div>
      )}

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("templates.deleteTitle")}
        message={t("templates.deleteMessage")}
        confirmLabel={t("templates.delete")}
        loading={removeTemplate.isPending}
        onConfirm={remove}
      />
    </AppShell>
  );
}
