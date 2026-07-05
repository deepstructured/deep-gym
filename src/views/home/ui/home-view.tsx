"use client";

import { differenceInCalendarWeeks, format, subDays } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useProfile } from "@/entities/user";
import {
  WorkoutCard,
  useDeleteWorkout,
  useWorkouts,
} from "@/entities/workout";
import { toISODate, todayISO } from "@/shared/lib/dates";
import { AppShell } from "@/widgets/app-shell";
import {
  Card,
  ConfirmSheet,
  DotValue,
  EmptyState,
  IconChevronRight,
  IconPlus,
} from "@/shared/ui";

/** Consecutive weeks (incl. this one) with at least one workout. */
function weekStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const now = new Date();
  const weeks = new Set(
    dates.map((date) =>
      differenceInCalendarWeeks(now, new Date(date), { weekStartsOn: 1 }),
    ),
  );
  let streak = 0;
  // Week 0 = current week; streak may also start from last week (week 1)
  let week = weeks.has(0) ? 0 : 1;
  while (weeks.has(week)) {
    streak++;
    week++;
  }
  return streak;
}

export function HomeView() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteWorkout = useDeleteWorkout();

  const from = toISODate(subDays(new Date(), 180));
  const to = todayISO();
  const { data: workouts } = useWorkouts(from, to);

  const unit = profile?.unit ?? "kg";

  const stats = useMemo(() => {
    const list = workouts ?? [];
    const thisWeekStart = subDays(
      new Date(),
      (new Date().getDay() + 6) % 7, // days since Monday
    );
    const weekFrom = toISODate(thisWeekStart);
    return {
      thisWeek: list.filter((w) => w.date >= weekFrom).length,
      streak: weekStreak(list.map((w) => w.date)),
      total: list.length,
    };
  }, [workouts]);

  const recent = (workouts ?? []).slice(0, 3);
  const firstName =
    profile?.display_name?.split(" ")[0] ?? "athlete";

  return (
    <AppShell>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">
            {format(new Date(), "EEEE, MMM d")}
          </p>
          <h1 className="text-2xl font-semibold">Hey, {firstName}</h1>
        </div>
        <span className="font-dot text-lg text-lime">DeepGym</span>
      </header>

      <div className="space-y-5">
        {/* Main CTA */}
        <Link href="/workouts/new" className="block">
          <Card variant="pink" className="p-6">
            <div className="dots-bg pointer-events-none absolute inset-0 opacity-25" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-xl font-semibold text-white">
                  Start workout
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Log your training session
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white">
                <IconPlus size={24} />
              </span>
            </div>
          </Card>
        </Link>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card variant="surface" className="rounded-tile p-4">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-faint uppercase">
              Week
            </p>
            <DotValue value={stats.thisWeek} className="text-3xl text-lime" />
          </Card>
          <Card variant="indigo" className="rounded-tile p-4">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-white/60 uppercase">
              Streak
            </p>
            <DotValue
              value={stats.streak}
              suffix="wk"
              className="text-3xl text-white"
              suffixClassName="text-white/60"
            />
          </Card>
          <Card variant="surface" className="rounded-tile p-4">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-faint uppercase">
              Total
            </p>
            <DotValue value={stats.total} className="text-3xl" />
          </Card>
        </div>

        {/* Recent workouts */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Recent workouts</h2>
            <Link
              href="/history"
              className="flex items-center gap-0.5 text-sm text-muted"
            >
              All history
              <IconChevronRight size={15} />
            </Link>
          </div>

          {recent.length === 0 ? (
            <EmptyState
              title="Nothing logged yet"
              hint="Your first workout is one tap away."
            />
          ) : (
            <div className="space-y-4">
              {recent.map((workout) => (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  unit={unit}
                  showDate
                  onEdit={() => router.push(`/workouts/${workout.id}/edit`)}
                  onDelete={() => setDeleteId(workout.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmSheet
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        title="Delete workout?"
        message="This removes the workout with all its sets. There is no undo."
        loading={deleteWorkout.isPending}
        onConfirm={() => {
          if (!deleteId) return;
          deleteWorkout.mutate(deleteId, {
            onSuccess: () => setDeleteId(null),
          });
        }}
      />
    </AppShell>
  );
}
