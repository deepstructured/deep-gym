"use client";

import { useI18n } from "@/shared/i18n";
import { Segmented } from "@/shared/ui";
import styles from "./exercise-create-form.module.scss";

type GymOption = { id: string; name: string };

/** null means universal. An empty array is an unfinished gym-specific selection. */
export function ExerciseAvailability({
  gyms, value, onChange, defaultGymId, requiredGymId,
}: {
  gyms?: GymOption[] | null;
  value: string[] | null;
  onChange: (value: string[] | null) => void;
  defaultGymId?: string | null;
  requiredGymId?: string | null;
}) {
  const { t } = useI18n();
  const suggested = requiredGymId ?? defaultGymId;

  return (
    <fieldset className={styles.availability}>
      <legend>{t("gym.availability")}</legend>
      <Segmented
        ariaLabel={t("gym.availability")}
        options={[
          { value: "all", label: t("gym.universal") },
          { value: "specific", label: t("gym.specific") },
        ]}
        value={value === null ? "all" : "specific"}
        onChange={mode => {
          if (mode === "all") onChange(null);
          else if (value === null) onChange(suggested && gyms?.some(gym => gym.id === suggested) ? [suggested] : []);
        }}
      />
      {value !== null && (
        gyms?.length ? (
          <div className={styles.gymOptions}>
            {gyms.map(gym => (
              <label key={gym.id}>
                <input type="checkbox" checked={value.includes(gym.id)} disabled={gym.id === requiredGymId}
                  onChange={event => onChange(event.target.checked ? [...value, gym.id] : value.filter(id => id !== gym.id))} />
                {gym.name}
              </label>
            ))}
          </div>
        ) : <p className={styles.hint}>{t(gyms === null ? "gym.loadError" : gyms ? "gym.noGyms" : "common.loading")}</p>
      )}
    </fieldset>
  );
}
