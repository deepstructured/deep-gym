"use client";

import { useEffect, useState } from "react";
import { useUpdateExercise } from "@/entities/exercise";
import { Button, IconInfo, Sheet, TextArea } from "@/shared/ui";

interface MachineInfoButtonProps {
  exerciseId: string;
  exerciseName: string;
  machineSettings: string | null;
  /** Rendered on gradient cards — lighter button style. */
  onGradient?: boolean;
}

/**
 * The ⓘ button next to machine exercises: opens a sheet with your saved
 * machine setup (seat height, handle position, …) and lets you edit it.
 */
export function MachineInfoButton({
  exerciseId,
  exerciseName,
  machineSettings,
  onGradient,
}: MachineInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(machineSettings ?? "");
  const update = useUpdateExercise();

  useEffect(() => {
    setText(machineSettings ?? "");
  }, [machineSettings]);

  function save() {
    update.mutate(
      { id: exerciseId, patch: { machine_settings: text.trim() || null } },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Machine setup"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          onGradient
            ? "flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white"
            : "flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-lime"
        }
      >
        <IconInfo size={17} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Machine setup">
        <p className="mb-3 text-sm text-muted">{exerciseName}</p>
        {editing ? (
          <div className="space-y-4">
            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Seat height 4, back pad 2, handles at chest level…"
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                variant="surface"
                className="flex-1"
                onClick={() => {
                  setEditing(false);
                  setText(machineSettings ?? "");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="lime"
                className="flex-1"
                onClick={save}
                loading={update.isPending}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-tile border border-line bg-raised px-4 py-4 whitespace-pre-wrap text-[15px] leading-relaxed">
              {machineSettings || (
                <span className="text-faint">
                  No setup notes yet. Add seat position, pad height and other
                  adjustments so you never have to remember them.
                </span>
              )}
            </div>
            <Button
              variant="surface"
              className="w-full"
              onClick={() => setEditing(true)}
            >
              {machineSettings ? "Edit setup" : "Add setup"}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
