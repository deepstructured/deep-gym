export type {
  WorkoutTemplate,
  WorkoutTemplateExercise,
  WorkoutTemplateInput,
  WorkoutTemplateSummary,
} from "./model/types";
export {
  getWorkoutTemplate,
  useCreateWorkoutTemplate,
  useDeleteWorkoutTemplate,
  useUpdateWorkoutTemplate,
  useWorkoutTemplate,
  useWorkoutTemplates,
} from "./api/queries";
