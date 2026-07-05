"use client";

import { useEffect, useState } from "react";
import {
  useCreateMuscleGroup,
  useDeleteMuscleGroup,
  useMuscleGroups,
} from "@/entities/muscle-group";
import { useProfile, useUpdateProfile } from "@/entities/user";
import { SignOutButton } from "@/features/auth";
import {
  kgToUnit,
  parseWeight,
  roundWeight,
  unitToKg,
  type Unit,
} from "@/shared/lib/weight";
import { AppShell } from "@/widgets/app-shell";
import {
  Button,
  Card,
  ConfirmSheet,
  Field,
  IconClose,
  IconPlus,
  Input,
  PageLoader,
  Segmented,
  Tag,
} from "@/shared/ui";

export function SettingsView() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [barWeight, setBarWeight] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [newPlateUnit, setNewPlateUnit] = useState<Unit>("kg");

  const unit: Unit = profile?.unit ?? "kg";

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setBarWeight(String(roundWeight(kgToUnit(profile.bar_weight_kg, profile.unit))));
    }
  }, [profile]);

  if (isLoading || !profile) {
    return (
      <AppShell title="Settings">
        <PageLoader />
      </AppShell>
    );
  }

  // combined plate list, heaviest first, each in its native denomination
  const plates: { value: number; unit: Unit; kg: number }[] = [
    ...profile.plates_kg.map((value) => ({ value, unit: "kg" as Unit, kg: value })),
    ...(profile.plates_lb ?? []).map((value) => ({
      value,
      unit: "lb" as Unit,
      kg: unitToKg(value, "lb"),
    })),
  ].sort((a, b) => b.kg - a.kg);

  function saveName() {
    if (name.trim() && name.trim() !== profile?.display_name) {
      updateProfile.mutate({ display_name: name.trim() });
    }
  }

  function saveBarWeight() {
    const parsed = parseWeight(barWeight);
    if (parsed != null) {
      updateProfile.mutate({
        bar_weight_kg: Math.round(unitToKg(parsed, unit) * 100) / 100,
      });
    }
  }

  function addPlate() {
    const parsed = parseWeight(newPlate);
    if (parsed == null) return;
    if (newPlateUnit === "kg") {
      if (!profile!.plates_kg.includes(parsed)) {
        updateProfile.mutate({ plates_kg: [...profile!.plates_kg, parsed] });
      }
    } else {
      const platesLb = profile!.plates_lb ?? [];
      if (!platesLb.includes(parsed)) {
        updateProfile.mutate({ plates_lb: [...platesLb, parsed] });
      }
    }
    setNewPlate("");
  }

  function removePlate(plate: { value: number; unit: Unit }) {
    if (plate.unit === "kg") {
      updateProfile.mutate({
        plates_kg: profile!.plates_kg.filter((p) => p !== plate.value),
      });
    } else {
      updateProfile.mutate({
        plates_lb: (profile!.plates_lb ?? []).filter(
          (p) => p !== plate.value,
        ),
      });
    }
  }

  return (
    <AppShell title="Settings">
      <div className="space-y-5">
        {/* Profile */}
        <Card variant="surface" className="space-y-4 p-4">
          <p className="text-sm font-semibold">Profile</p>
          <Field label="Display name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              placeholder="Your name"
            />
          </Field>
          {profile.telegram_username && (
            <p className="text-sm text-muted">
              Telegram: <Tag>@{profile.telegram_username}</Tag>
            </p>
          )}
        </Card>

        {/* Units */}
        <Card variant="surface" className="space-y-3 p-4">
          <p className="text-sm font-semibold">Weight unit</p>
          <Segmented
            value={unit}
            onChange={(next) => updateProfile.mutate({ unit: next })}
            options={[
              { value: "kg", label: "Kilograms" },
              { value: "lb", label: "Pounds" },
            ]}
          />
        </Card>

        {/* Plates */}
        <Card variant="surface" className="space-y-4 p-4">
          <div>
            <p className="text-sm font-semibold">Plate calculator</p>
            <p className="mt-0.5 text-xs text-muted">
              Plates available in your gym — used for the weight breakdown.
            </p>
          </div>

          <Field label={`Bar weight, ${unit}`}>
            <Input
              value={barWeight}
              onChange={(e) =>
                setBarWeight(e.target.value.replace(/[^\d.,]/g, ""))
              }
              onBlur={saveBarWeight}
              inputMode="decimal"
              className="max-w-32"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {plates.map((plate) => (
              <span
                key={`${plate.unit}-${plate.value}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised pr-2 pl-3.5 text-sm"
              >
                <span className="font-dot">{plate.value}</span>
                <span className="text-xs text-muted">{plate.unit}</span>
                <button
                  type="button"
                  aria-label={`Remove ${plate.value} ${plate.unit} plate`}
                  onClick={() => removePlate(plate)}
                  className="text-faint active:text-flame"
                >
                  <IconClose size={14} />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newPlate}
              onChange={(e) =>
                setNewPlate(e.target.value.replace(/[^\d.,]/g, ""))
              }
              onKeyDown={(e) => e.key === "Enter" && addPlate()}
              inputMode="decimal"
              placeholder="Plate weight"
              className="h-10 flex-1"
            />
            <div className="flex rounded-full border border-line bg-surface p-0.5">
              {(["kg", "lb"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setNewPlateUnit(option)}
                  className={
                    newPlateUnit === option
                      ? "h-9 rounded-full bg-lime px-3 text-sm font-medium text-black"
                      : "h-9 rounded-full px-3 text-sm font-medium text-muted"
                  }
                >
                  {option}
                </button>
              ))}
            </div>
            <Button variant="surface" size="sm" className="h-10" onClick={addPlate}>
              <IconPlus size={16} />
              Add
            </Button>
          </div>
        </Card>

        {/* Muscle groups */}
        <MuscleGroupsCard />

        <SignOutButton />

        <p className="pb-2 text-center text-xs text-faint">
          DeepGym · install it: Share → Add to Home Screen
        </p>
      </div>
    </AppShell>
  );
}

function MuscleGroupsCard() {
  const { data: groups } = useMuscleGroups();
  const createGroup = useCreateMuscleGroup();
  const deleteGroup = useDeleteMuscleGroup();
  const [newGroup, setNewGroup] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function add() {
    const name = newGroup.trim();
    if (!name) return;
    createGroup.mutate(name, { onSuccess: () => setNewGroup("") });
  }

  const pending = groups?.find((g) => g.id === deleteId);

  return (
    <Card variant="surface" className="space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold">Muscle groups</p>
        <p className="mt-0.5 text-xs text-muted">
          Default groups are built in; you can add your own.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {groups?.map((group) => (
          <span
            key={group.id}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 text-sm"
          >
            {group.name}
            {group.user_id != null && (
              <button
                type="button"
                aria-label={`Delete ${group.name}`}
                onClick={() => setDeleteId(group.id)}
                className="text-faint active:text-flame"
              >
                <IconClose size={14} />
              </button>
            )}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New group, e.g. Abs"
          className="h-10 flex-1"
        />
        <Button
          variant="surface"
          size="sm"
          className="h-10"
          onClick={add}
          loading={createGroup.isPending}
        >
          <IconPlus size={16} />
          Add
        </Button>
      </div>

      <ConfirmSheet
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        title={`Delete “${pending?.name}”?`}
        message="You can only delete a group that has no exercises in it."
        loading={deleteGroup.isPending}
        onConfirm={() => {
          if (!deleteId) return;
          deleteGroup.mutate(deleteId, {
            onSuccess: () => setDeleteId(null),
            onError: () => setDeleteId(null),
          });
        }}
      />
    </Card>
  );
}
