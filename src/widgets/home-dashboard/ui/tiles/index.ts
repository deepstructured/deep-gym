import type { ComponentType } from "react";
import type { MessageKey } from "@/shared/i18n";
import {
  IconBolt,
  IconCalendar,
  IconChart,
  IconDumbbell,
  IconFlame,
  IconHistory,
  IconMuscle,
  IconPlus,
  IconRepeat,
  IconScale,
  IconTarget,
  IconTemplate,
  IconTrophy,
} from "@/shared/ui";
import type { TileProps } from "../home-data";
import type { WidgetType } from "../../model/layout";
import {
  ConsistencyTile,
  GoalTile,
  MonthTile,
  StartTile,
  StreakTile,
  TotalTile,
  WeekTile,
  WeeklyVolumeTile,
} from "./activity-tiles";
import {
  NextTile,
  QuickActionsTile,
  RecentTile,
  RepeatTile,
  TemplatesTile,
} from "./plan-tiles";
import {
  BodyWeightTile,
  ExerciseProgressTile,
  MuscleTile,
  RecordsTile,
  StrongestTile,
} from "./progress-tiles";

type IconComponent = ComponentType<{ size?: number }>;

export const TILES: Record<
  WidgetType,
  { component: ComponentType<TileProps>; icon: IconComponent }
> = {
  startWorkout: { component: StartTile, icon: IconPlus },
  quickActions: { component: QuickActionsTile, icon: IconBolt },
  repeatLast: { component: RepeatTile, icon: IconRepeat },
  weekActivity: { component: WeekTile, icon: IconDumbbell },
  streak: { component: StreakTile, icon: IconFlame },
  totalWorkouts: { component: TotalTile, icon: IconHistory },
  weeklyGoal: { component: GoalTile, icon: IconTarget },
  consistency: { component: ConsistencyTile, icon: IconCalendar },
  weeklyVolume: { component: WeeklyVolumeTile, icon: IconChart },
  monthSummary: { component: MonthTile, icon: IconCalendar },
  exerciseProgress: { component: ExerciseProgressTile, icon: IconChart },
  personalRecords: { component: RecordsTile, icon: IconTrophy },
  strongestLifts: { component: StrongestTile, icon: IconDumbbell },
  muscleBalance: { component: MuscleTile, icon: IconMuscle },
  nextWorkout: { component: NextTile, icon: IconCalendar },
  templates: { component: TemplatesTile, icon: IconTemplate },
  recentWorkouts: { component: RecentTile, icon: IconHistory },
  bodyWeight: { component: BodyWeightTile, icon: IconScale },
};

export function widgetTitleKey(type: WidgetType): MessageKey {
  return `widget.${type}.name` as MessageKey;
}

export function widgetDescriptionKey(type: WidgetType): MessageKey {
  return `widget.${type}.desc` as MessageKey;
}
