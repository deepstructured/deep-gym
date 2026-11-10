/** Small server/edge error document; it must work without client JS or Auth. */
export const serviceUnavailableCopy = {
  en: {
    title: "Sign-in is temporarily unavailable",
    message: "We couldn't check your session. Your saved workouts are unchanged. Please try again shortly.",
    retry: "Try again",
  },
  uk: {
    title: "Вхід тимчасово недоступний",
    message: "Не вдалося перевірити сесію. Збережені тренування не змінено. Спробуйте ще раз за хвилину.",
    retry: "Спробувати ще раз",
  },
  ru: {
    title: "Вход временно недоступен",
    message: "Не удалось проверить сессию. Сохранённые тренировки не изменены. Попробуйте ещё раз через минуту.",
    retry: "Попробовать снова",
  },
} as const;
