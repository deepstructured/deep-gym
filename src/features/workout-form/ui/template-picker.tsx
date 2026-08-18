"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMuscleGroups } from "@/entities/muscle-group";
import {
  getWorkoutTemplate,
  useWorkoutTemplates,
} from "@/entities/workout-template";
import { useI18n } from "@/shared/i18n";
import type { Unit } from "@/shared/lib/weight";
import {
  Button,
  EmptyState,
  ErrorNote,
  IconChevronRight,
  IconPlus,
  PageLoader,
  Sheet,
  Spinner,
  Tag,
} from "@/shared/ui";
import { exerciseToDraft, type DraftExercise } from "../model/draft";
import styles from "./template-picker.module.scss";

interface TemplatePickerProps {
  unit: Unit;
  bodyWeightKg: number | null;
  onApply: (exercises: DraftExercise[], type: string) => void;
}

/** Pick a reusable structure and materialize it as a normal workout draft. */
export function TemplatePicker({
  unit,
  bodyWeightKg,
  onApply,
}: TemplatePickerProps) {
  const router = useRouter();
  const { t, tn } = useI18n();
  const {
    data: templates,
    isLoading,
    error: templatesError,
  } = useWorkoutTemplates();
  const {
    data: groups,
    isLoading: groupsLoading,
    error: groupsError,
  } = useMuscleGroups();
  const [open, setOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(id: string) {
    if (applyingId || groupsLoading || groupsError || !groups) return;
    setApplyingId(id);
    setError(null);
    try {
      const template = await getWorkoutTemplate(id);
      if (template.workout_template_exercises.length === 0) {
        setError(t("templates.exercisesRequired"));
        return;
      }
      const groupNames = new Map(
        (groups ?? []).map((group) => [group.id, group.name]),
      );
      const exercises = template.workout_template_exercises.map((item) =>
        exerciseToDraft(
          item.exercise,
          groupNames.get(item.exercise.muscle_group_id) ?? "",
          unit,
          bodyWeightKg,
        ),
      );
      onApply(exercises, template.type);
      setOpen(false);
    } catch {
      setError(t("common.error"));
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
      >
        <span className={styles.triggerIcon}>
          <TemplateGlyph />
        </span>
        <span className={styles.triggerText}>
          <span className={styles.triggerTitle}>{t("workout.useTemplate")}</span>
          <span className={styles.triggerHint}>
            {t("workout.useTemplateHint")}
          </span>
        </span>
        <IconChevronRight size={18} className={styles.chevron} />
      </button>

      <Sheet
        open={open}
        onClose={() => !applyingId && setOpen(false)}
        title={t("workout.templatePickerTitle")}
      >
        {isLoading || groupsLoading ? (
          <PageLoader />
        ) : templatesError || groupsError ? (
          <ErrorNote message={t("common.error")} />
        ) : !templates || templates.length === 0 ? (
          <EmptyState
            title={t("templates.emptyTitle")}
            hint={t("templates.emptyHint")}
            action={
              <Button
                type="button"
                variant="lime"
                onClick={() => router.push("/templates/new")}
              >
                <IconPlus size={17} />
                {t("templates.new")}
              </Button>
            }
          />
        ) : (
          <div className={styles.list}>
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={styles.row}
                disabled={
                  applyingId != null ||
                  !groups ||
                  template.exerciseCount === 0
                }
                onClick={() => void apply(template.id)}
              >
                <span className={styles.rowIcon}>
                  {applyingId === template.id ? (
                    <Spinner size={16} />
                  ) : (
                    <TemplateGlyph />
                  )}
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{template.name}</span>
                  <span className={styles.rowMeta}>
                    <Tag>{template.type}</Tag>
                    {tn("count.exercises", template.exerciseCount)}
                  </span>
                </span>
                <IconChevronRight size={18} className={styles.chevron} />
              </button>
            ))}
            {error && <ErrorNote message={error} />}
          </div>
        )}
      </Sheet>
    </>
  );
}

function TemplateGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
