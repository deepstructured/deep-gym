export const LANGS = ["en", "ru", "uk"] as const;
export type Lang = (typeof LANGS)[number];

export const LANGUAGE_OPTIONS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "uk", label: "Українська" },
];

/** English is the source of truth — every other language must cover its keys.
 *  Count keys hold plural forms separated by `|` (one|few|many for ru/uk). */
const en = {
  // common
  "common.save": "Save",
  "common.saveChanges": "Save changes",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.back": "Back",
  "common.add": "Add",
  "common.all": "All",
  "common.close": "Close",
  "common.error": "Something went wrong",
  "common.retry": "Try again",

  // bottom navigation
  "nav.home": "Home",
  "nav.history": "History",
  "nav.add": "Add",
  "nav.exercises": "Exercises",
  "nav.settings": "Settings",

  // home
  "home.greeting": "Hey, {name}",
  "home.athlete": "athlete",
  "home.startWorkout": "Start workout",
  "home.logSession": "Log your training session",
  "home.week": "Week",
  "home.workoutsThisWeek": "Workouts this week",
  "home.streak": "Streak",
  "home.weekStreak": "Week streak",
  "home.wk": "wk",
  "home.total": "Total",
  "home.totalWorkouts": "Total workouts",
  "home.allHistory": "All history",
  "home.emptyTitle": "Nothing logged yet",
  "home.emptyHint": "Your first workout is one tap away.",
  "home.nextWorkout": "Next workout",
  "home.today": "Today",
  "home.tomorrow": "Tomorrow",
  "home.progress": "Progress",
  "home.details": "Details",

  // history
  "history.title": "History",
  "history.day": "Day",
  "history.week": "Week",
  "history.month": "Month",
  "history.previous": "Previous",
  "history.next": "Next",
  "history.emptyTitle": "No workouts here",
  "history.emptyDay": "Rest day — or time to change that.",
  "history.todayPlanned":
    "Nothing logged today yet — but a workout is on the schedule:",
  "history.plannedDay": "A workout is planned for this day:",
  "history.scheduled": "Planned workout",
  "history.plannedMarker": "Planned",

  // workout form / new / edit
  "workout.new": "New workout",
  "workout.edit": "Edit workout",
  "workout.type": "Workout type",
  "workout.date": "Date",
  "workout.note": "Workout note",
  "workout.notePlaceholder": "Felt tired today, short on sleep…",
  "workout.addNote": "Add workout note",
  "workout.removeNote": "Remove note",
  "workout.addExercise": "Add exercise",
  "workout.copyLast": "Copy last “{type}” workout",
  "workout.save": "Save workout",
  "workout.discard": "Discard draft",
  "workout.delete": "Delete workout",
  "workout.deleteTitle": "Delete workout?",
  "workout.deleteMessage":
    "This removes the workout with all its sets. There is no undo.",
  "workout.notFound": "Workout not found",

  // built-in workout types (stored values stay language-neutral)
  "workoutType.upper": "Upper",
  "workoutType.lower": "Lower",
  "workoutType.fullBody": "Full body",
  "workoutType.push": "Push",
  "workoutType.pull": "Pull",

  // set editor
  "set.weight": "Weight, {unit}",
  "set.reps": "Reps",
  "set.fail": "Fail",
  "set.addSet": "Add set",
  "set.removeSet": "Remove set",
  "set.toFailure": "To failure",
  "set.plates": "Plate breakdown",
  "exercise.note": "Exercise note",
  "exercise.notePlaceholder": "Note for this exercise…",
  "exercise.remove": "Remove exercise",

  // exercise picker
  "picker.title": "Add exercise",
  "picker.newTitle": "New exercise",
  "picker.name": "Name",
  "picker.namePlaceholder": "Chest Press",
  "picker.muscleGroup": "Muscle group",
  "picker.equipment": "Equipment",
  "picker.machineSetupOptional": "Machine setup (optional)",
  "picker.machineSetupPlaceholder": "Seat height 4, back pad 2…",
  "picker.unitForExercise": "Weight unit for this exercise",
  "picker.unitDefault": "Default ({unit})",
  "picker.workingWeight": "Working weight, {unit} (optional)",
  "picker.search": "Search exercises…",
  "picker.empty": "Nothing found.",
  "picker.emptyFor": "Nothing found for “{query}”.",
  "picker.createNew": "Create new exercise",
  "picker.createAdd": "Create & add",
  "picker.errName": "Name the exercise",
  "picker.errGroup": "Pick a muscle group",

  // exercises list
  "exercises.title": "Exercises",
  "exercises.emptyTitle": "No exercises yet",
  "exercises.emptyHint":
    "Exercises are created while logging a workout — or will show up here after your first one.",
  "exercises.working": "Working",

  // exercise detail
  "detail.title": "Exercise",
  "detail.editExercise": "Edit exercise",
  "detail.currentWorking": "Current working weight",
  "detail.editWorking": "Edit working weight",
  "detail.sessions": "Sessions",
  "detail.totalSets": "Total sets",
  "detail.bestWeight": "Best weight",
  "detail.est1rm": "Est. 1RM",
  "detail.topSet": "Top set over time",
  "detail.repsByWeight": "Reps by weight",
  "detail.weight": "Weight",
  "detail.sets": "Sets",
  "detail.avg": "Avg",
  "detail.med": "Med",
  "detail.mode": "Mode",
  "detail.recent": "Recent",
  "detail.noSets":
    "No logged sets yet — stats will appear after the first workout with this exercise.",
  "detail.workingWeight": "Working weight",
  "detail.workingWeightHint":
    "Your current target weight for this exercise. Bump it up when you progress.",
  "detail.weightUnit": "Weight, {unit}",
  "detail.inUnit": "in {unit}",
  "detail.nameEmpty": "Name can't be empty",
  "detail.machineSetup": "Machine setup",
  "detail.deleteExercise": "Delete exercise",
  "detail.deleteTitle": "Delete exercise?",
  "detail.deleteMessage":
    "This also removes it from every logged workout. There is no undo.",

  // compare with a past session
  "compare.title": "Compare",
  "compare.aria": "Compare with past result",
  "compare.emptyTitle": "No past sessions yet",
  "compare.emptyHint":
    "Once you log this exercise, you'll be able to compare against previous days here.",
  "compare.thisSession": "This session",
  "compare.pickDay": "Pick a day",
  "compare.selectedDay": "Selected day",
  "compare.noSets": "No sets logged for this exercise on this day.",

  // machine setup
  "machine.title": "Machine setup",
  "machine.empty":
    "No setup notes yet. Add seat position, pad height and other adjustments so you never have to remember them.",
  "machine.edit": "Edit setup",
  "machine.add": "Add setup",
  "machine.placeholder": "Seat height 4, back pad 2, handles at chest level…",

  // plate calculator
  "plates.dumbbells": "Dumbbells",
  "plates.loadBar": "Load the bar",
  "plates.loadPlates": "Load the plates",
  "plates.each": "{unit} each",
  "plates.includesBar": "includes the {bar} bar",
  "plates.dumbbell": "{weight} dumbbell",
  "plates.oneEachHand": "One in each hand",
  "plates.totalLoad": "{unit} total load",
  "plates.barCovers": "The bar alone covers this weight — no plates needed.",
  "plates.ways": "Ways to assemble it",
  "plates.fewest": "fewest plates",
  "plates.perSide": "per side:",
  "plates.total": "total",
  "plates.closest": "Closest match",
  "plates.missing": "{weight} is missing —",
  "plates.editPlates": "edit your plates",
  "plates.none": "No plates configured —",
  "plates.addInSettings": "add them in Settings",

  // settings
  "settings.title": "Settings",
  "settings.profile": "Profile",
  "settings.displayName": "Display name",
  "settings.yourName": "Your name",
  "settings.language": "Language",
  "settings.uploadPhoto": "Upload photo",
  "settings.useDefault": "Use default",
  "settings.avatarHint": "JPG or PNG — it's cropped to a square.",
  "settings.chooseAvatar": "Or pick an avatar",
  "avatarPreset.portal": "Pixel portal",
  "avatarPreset.shark": "Pixel shark",
  "avatarPreset.mountain": "Pixel mountain",
  "avatarPreset.lifter": "Pixel lifter",
  "avatarPreset.gorilla": "Pixel gorilla",
  "avatarPreset.raven": "Pixel raven",
  "avatarPreset.eclipse": "Pixel eclipse",
  "avatarPreset.barbell": "Pixel barbell",
  "avatarPreset.grip": "Pixel grip",
  "avatarPreset.pulse": "Pixel training pulse",
  "settings.weightUnit": "Weight unit",
  "settings.kilograms": "Kilograms",
  "settings.pounds": "Pounds",
  "settings.trainingWeek": "Training week",
  "settings.trainingWeekHint":
    "Choose your usual training days and a workout type for each one. Nothing is scheduled by default.",
  "settings.restDay": "Rest day",
  "settings.toggleTrainingDay": "Toggle training day: {day}",
  "settings.workoutTypeFor": "Workout type for {day}",
  "settings.chooseWorkoutType": "Choose workout type",
  "settings.chooseTypeForEnabled":
    "Choose a workout type for every enabled day.",
  "settings.scheduleSaved": "Training week saved",
  "settings.saveSchedule": "Save training week",
  "settings.plateCalc": "Plate calculator",
  "settings.plateCalcHint":
    "Plates available in your gym — used for the weight breakdown.",
  "settings.barWeight": "Bar weight, {unit}",
  "settings.plateWeight": "Plate weight",
  "settings.removePlate": "Remove {plate} plate",
  "settings.muscleGroups": "Muscle groups",
  "settings.muscleGroupsHint":
    "Default groups are built in; you can add your own.",
  "settings.newGroup": "New group, e.g. Abs",
  "settings.deleteGroup": "Delete “{name}”?",
  "settings.deleteGroupMessage":
    "You can only delete a group that has no exercises in it.",
  "settings.install": "DeepGym · install it: Share → Add to Home Screen",
  "settings.signOut": "Sign out",
  "settings.helpUpdates": "Help & updates",
  "settings.appGuide": "App guide",
  "settings.appGuideHint":
    "Replay setup and see how workouts, history and progress fit together.",
  "settings.whatsNew": "What's new",
  "settings.whatsNewHint": "See the highlights from version {version}.",

  // onboarding
  "onboarding.progress": "Step {current} of {total}",
  "onboarding.continue": "Continue",
  "onboarding.exitGuide": "Exit guide",
  "onboarding.saveError":
    "We couldn't save your setup. Your choices are still here — try again.",
  "onboarding.eligibilityError":
    "We couldn't check your workout history. Check your connection and try again.",
  "onboarding.welcome.eyebrow": "WELCOME TO DEEPGYM",
  "onboarding.welcome.title": "Your training, finally in one place.",
  "onboarding.welcome.body":
    "Five short steps will tailor the app and show you the parts that matter during a real workout.",
  "onboarding.welcome.log.title": "Log without friction",
  "onboarding.welcome.log.body":
    "Save exercises, sets, reps, weight and failure in one flow.",
  "onboarding.welcome.remember.title": "Remember every setup",
  "onboarding.welcome.remember.body":
    "Keep machine positions, working weights and plate combinations close.",
  "onboarding.welcome.progress.title": "See actual progress",
  "onboarding.welcome.progress.body":
    "History, comparisons and charts turn every session into useful context.",
  "onboarding.welcome.start": "Set up my app",
  "onboarding.profile.eyebrow": "MAKE IT YOURS",
  "onboarding.profile.title": "How should DeepGym work for you?",
  "onboarding.profile.body":
    "Choose your language, display unit and an avatar. You can change all of this later.",
  "onboarding.profile.nameRequired":
    "Enter the name you want to see in the app.",
  "onboarding.profile.avatarOptional": "Avatar is optional",
  "onboarding.equipment.eyebrow": "YOUR GYM",
  "onboarding.equipment.title": "Set up the weight room once.",
  "onboarding.equipment.body":
    "We'll use this for plate breakdowns. Standard plates are ready; confirm your usual bar weight.",
  "onboarding.equipment.standardKg": "Standard metric plates",
  "onboarding.equipment.standardLb": "Standard imperial plates",
  "onboarding.equipment.plateCount": "{count} plate sizes configured",
  "onboarding.equipment.adjustLater":
    "Individual plate sizes can be edited later in Settings.",
  "onboarding.equipment.invalidBar": "Enter a bar weight greater than zero.",
  "onboarding.schedule.eyebrow": "YOUR RHYTHM",
  "onboarding.schedule.title": "What does a normal week look like?",
  "onboarding.schedule.body":
    "A schedule powers the Next Workout card. Flexible training works too — choose it explicitly.",
  "onboarding.schedule.fixed": "I use a schedule",
  "onboarding.schedule.flexible": "My week is flexible",
  "onboarding.schedule.flexibleHint":
    "DeepGym won't suggest a weekday workout, but you can start any type at any time.",
  "onboarding.schedule.twoDays": "2 days",
  "onboarding.schedule.threeDays": "3 days",
  "onboarding.schedule.fourDays": "4 days",
  "onboarding.schedule.required":
    "Choose a schedule or confirm that your week is flexible.",
  "onboarding.tour.eyebrow": "YOU'RE READY",
  "onboarding.tour.title": "One flow from set one to progress.",
  "onboarding.tour.body":
    "Here's where each part of the app becomes useful after you start training.",
  "onboarding.tour.workout.title": "Workout",
  "onboarding.tour.workout.body":
    "Choose a type, add exercises and log every set. Your draft survives an app close.",
  "onboarding.tour.equipment.title": "Equipment memory",
  "onboarding.tour.equipment.body":
    "Plate breakdowns and machine notes stay attached to the exercise.",
  "onboarding.tour.history.title": "History & planning",
  "onboarding.tour.history.body":
    "See completed days beside planned workouts from your training week.",
  "onboarding.tour.progress.title": "Progress",
  "onboarding.tour.progress.body":
    "Compare sessions and follow weight, volume, reps and estimated 1RM.",
  "onboarding.startFirstWorkout": "Start my first workout",
  "onboarding.startWorkout": "Start workout",
  "onboarding.continueToApp": "Continue to app",
  "onboarding.goHome": "Go to Home",

  // guided first workout
  "firstWorkout.guideTitle": "Your first workout",
  "firstWorkout.guideBody":
    "Three quick moves are enough to start building your history.",
  "firstWorkout.stepType": "Choose the workout type",
  "firstWorkout.stepExercise": "Add an exercise and enter weight + reps",
  "firstWorkout.stepSave": "Save — the result appears in History",
  "firstWorkout.open": "Log the first workout",
  "firstWorkout.formTip":
    "Start with one exercise. The plate icon calculates the load; machine notes remember your setup.",
  "firstWorkout.savedTitle": "First workout logged",
  "firstWorkout.savedBody":
    "Your history is live. The next session will unlock comparisons and richer progress data.",
  "firstWorkout.openHistory": "View my history",

  // release notes
  "whatsNew.title": "What's new",
  "whatsNew.version": "Version {version}",
  "whatsNew.releaseTitle": "A sharper DeepGym, built around your week.",
  "whatsNew.releaseBody":
    "The new release makes the dashboard clearer and brings your training plan into the product.",
  "whatsNew.dashboard.title": "Clearer dashboard stats",
  "whatsNew.dashboard.body":
    "Weekly activity, streak and total workouts now explain exactly what they measure.",
  "whatsNew.schedule.title": "Training week & next workout",
  "whatsNew.schedule.body":
    "Plan your usual days and get a real next-workout prompt on Home and History.",
  "whatsNew.avatars.title": "Pixel avatars & Night Reverse",
  "whatsNew.avatars.body":
    "Ten new halftone avatars, the production logo system and a dotted favicon are now live.",
  "whatsNew.gotIt": "Got it",
  "whatsNew.saveError":
    "We couldn't save that you've seen this update. Try again.",

  // login
  "login.tagline": "Track the progress.",
  "login.welcome": "Welcome back",
  "login.signInToStart": "Sign in to start training",
  "login.googleFailed": "Google sign-in failed. Try again.",
  "login.continueGoogle": "Continue with Google",
  "login.telegramUsername": "Telegram username",
  "login.firstTime":
    "First time here? Press “Start” in our bot, then come back and enter your username:",
  "login.sendCode": "Send code",
  "login.codeSent": "Code sent to @{username}",
  "login.signIn": "Sign in",
  "login.differentUsername": "Use a different username",
  "login.botNote": "One-time codes are sent by the DeepGym bot",

  // offline
  "offline.message":
    "No connection. Your workout draft is saved locally — reconnect to sync.",

  // equipment labels
  "equipment.free_weight": "Barbell",
  "equipment.dumbbell": "Dumbbell",
  "equipment.machine": "Machine",
  "equipment.crossover": "Crossover",

  // share workout
  "share.workout": "Share workout",
  "share.share": "Share",
  "share.download": "Download image",

  // analytics
  "stats.weight": "Weight",
  "stats.oneRm": "1RM",
  "stats.volume": "Volume",
  "stats.reps": "Reps",
  "stats.totalReps": "Total reps",
  "stats.failRate": "Fail rate",
  "stats.perWeek": "Per week",

  // plural counts
  "count.exercises": "{n} exercise|{n} exercises",
  "count.sets": "{n} set|{n} sets",
  "count.lastWorkouts": "Last workout|Last {n} workouts",
} as const;

export type MessageKey = keyof typeof en;

const ru: Record<MessageKey, string> = {
  "common.save": "Сохранить",
  "common.saveChanges": "Сохранить изменения",
  "common.cancel": "Отмена",
  "common.delete": "Удалить",
  "common.back": "Назад",
  "common.add": "Добавить",
  "common.all": "Все",
  "common.close": "Закрыть",
  "common.error": "Что-то пошло не так",
  "common.retry": "Попробовать снова",

  "nav.home": "Главная",
  "nav.history": "История",
  "nav.add": "Добавить",
  "nav.exercises": "Упражнения",
  "nav.settings": "Настройки",

  "home.greeting": "Привет, {name}",
  "home.athlete": "атлет",
  "home.startWorkout": "Начать тренировку",
  "home.logSession": "Запиши свою тренировку",
  "home.week": "Неделя",
  "home.workoutsThisWeek": "Тренировки за неделю",
  "home.streak": "Серия",
  "home.weekStreak": "Серия недель",
  "home.wk": "нед",
  "home.total": "Всего",
  "home.totalWorkouts": "Всего тренировок",
  "home.allHistory": "Вся история",
  "home.emptyTitle": "Пока пусто",
  "home.emptyHint": "Первая тренировка — в одно касание.",
  "home.nextWorkout": "Следующая тренировка",
  "home.today": "Сегодня",
  "home.tomorrow": "Завтра",
  "home.progress": "Прогресс",
  "home.details": "Детали",

  "history.title": "История",
  "history.day": "День",
  "history.week": "Неделя",
  "history.month": "Месяц",
  "history.previous": "Назад",
  "history.next": "Вперёд",
  "history.emptyTitle": "Тренировок нет",
  "history.emptyDay": "День отдыха — или пора это исправить.",
  "history.todayPlanned":
    "Сегодня тренировки ещё не было — а по расписанию она есть:",
  "history.plannedDay": "На этот день запланирована тренировка:",
  "history.scheduled": "Запланированная тренировка",
  "history.plannedMarker": "Запланировано",

  "workout.new": "Новая тренировка",
  "workout.edit": "Редактирование",
  "workout.type": "Тип тренировки",
  "workout.date": "Дата",
  "workout.note": "Заметка к тренировке",
  "workout.notePlaceholder": "Сегодня устал, не выспался…",
  "workout.addNote": "Добавить заметку",
  "workout.removeNote": "Убрать заметку",
  "workout.addExercise": "Добавить упражнение",
  "workout.copyLast": "Скопировать прошлую «{type}»",
  "workout.save": "Сохранить тренировку",
  "workout.discard": "Удалить черновик",
  "workout.delete": "Удалить тренировку",
  "workout.deleteTitle": "Удалить тренировку?",
  "workout.deleteMessage":
    "Тренировка и все её подходы будут удалены. Отменить нельзя.",
  "workout.notFound": "Тренировка не найдена",

  "workoutType.upper": "Верх тела",
  "workoutType.lower": "Низ тела",
  "workoutType.fullBody": "Всё тело",
  "workoutType.push": "Жим",
  "workoutType.pull": "Тяга",

  "set.weight": "Вес, {unit}",
  "set.reps": "Повт",
  "set.fail": "Отказ",
  "set.addSet": "Добавить подход",
  "set.removeSet": "Убрать подход",
  "set.toFailure": "До отказа",
  "set.plates": "Разбор по блинам",
  "exercise.note": "Заметка к упражнению",
  "exercise.notePlaceholder": "Заметка к этому упражнению…",
  "exercise.remove": "Убрать упражнение",

  "picker.title": "Добавить упражнение",
  "picker.newTitle": "Новое упражнение",
  "picker.name": "Название",
  "picker.namePlaceholder": "Жим от груди",
  "picker.muscleGroup": "Группа мышц",
  "picker.equipment": "Снаряд",
  "picker.machineSetupOptional": "Настройки тренажёра (необязательно)",
  "picker.machineSetupPlaceholder": "Сиденье 4, спинка 2…",
  "picker.unitForExercise": "Единица веса для этого упражнения",
  "picker.unitDefault": "По умолчанию ({unit})",
  "picker.workingWeight": "Рабочий вес, {unit} (необязательно)",
  "picker.search": "Поиск упражнений…",
  "picker.empty": "Ничего не найдено.",
  "picker.emptyFor": "По запросу «{query}» ничего не найдено.",
  "picker.createNew": "Создать новое упражнение",
  "picker.createAdd": "Создать и добавить",
  "picker.errName": "Укажите название",
  "picker.errGroup": "Выберите группу мышц",

  "exercises.title": "Упражнения",
  "exercises.emptyTitle": "Упражнений пока нет",
  "exercises.emptyHint":
    "Упражнения создаются при записи тренировки — они появятся здесь после первой.",
  "exercises.working": "Рабочий",

  "detail.title": "Упражнение",
  "detail.editExercise": "Редактировать упражнение",
  "detail.currentWorking": "Текущий рабочий вес",
  "detail.editWorking": "Изменить рабочий вес",
  "detail.sessions": "Сессии",
  "detail.totalSets": "Подходы",
  "detail.bestWeight": "Лучший вес",
  "detail.est1rm": "Оцен. 1ПМ",
  "detail.topSet": "Лучший подход в динамике",
  "detail.repsByWeight": "Повторы по весу",
  "detail.weight": "Вес",
  "detail.sets": "Подх",
  "detail.avg": "Сред",
  "detail.med": "Мед",
  "detail.mode": "Мода",
  "detail.recent": "Недавние",
  "detail.noSets":
    "Подходов пока нет — статистика появится после первой тренировки с этим упражнением.",
  "detail.workingWeight": "Рабочий вес",
  "detail.workingWeightHint":
    "Ваш текущий целевой вес в этом упражнении. Повышайте по мере прогресса.",
  "detail.weightUnit": "Вес, {unit}",
  "detail.inUnit": "в {unit}",
  "detail.nameEmpty": "Название не может быть пустым",
  "detail.machineSetup": "Настройки тренажёра",
  "detail.deleteExercise": "Удалить упражнение",
  "detail.deleteTitle": "Удалить упражнение?",
  "detail.deleteMessage":
    "Оно также исчезнет из всех записанных тренировок. Отменить нельзя.",

  "compare.title": "Сравнение",
  "compare.aria": "Сравнить с прошлым результатом",
  "compare.emptyTitle": "Прошлых сессий пока нет",
  "compare.emptyHint":
    "Когда запишете это упражнение, здесь можно будет сравнить с прошлыми днями.",
  "compare.thisSession": "Эта сессия",
  "compare.pickDay": "Выберите день",
  "compare.selectedDay": "Выбранный день",
  "compare.noSets": "В этот день подходов по этому упражнению нет.",

  "machine.title": "Настройки тренажёра",
  "machine.empty":
    "Заметок пока нет. Запишите положение сиденья, высоту упора и другие настройки, чтобы не держать их в голове.",
  "machine.edit": "Изменить настройки",
  "machine.add": "Добавить настройки",
  "machine.placeholder": "Сиденье 4, спинка 2, ручки на уровне груди…",

  "plates.dumbbells": "Гантели",
  "plates.loadBar": "Собери штангу",
  "plates.loadPlates": "Собери вес",
  "plates.each": "{unit} каждая",
  "plates.includesBar": "включая гриф {bar}",
  "plates.dumbbell": "гантель {weight}",
  "plates.oneEachHand": "По одной в каждую руку",
  "plates.totalLoad": "{unit} общий вес",
  "plates.barCovers": "Гриф уже покрывает этот вес — блины не нужны.",
  "plates.ways": "Варианты сборки",
  "plates.fewest": "меньше блинов",
  "plates.perSide": "на сторону:",
  "plates.total": "всего",
  "plates.closest": "Ближайший вариант",
  "plates.missing": "не хватает {weight} —",
  "plates.editPlates": "изменить блины",
  "plates.none": "Блины не настроены —",
  "plates.addInSettings": "добавьте их в настройках",

  "settings.title": "Настройки",
  "settings.profile": "Профиль",
  "settings.displayName": "Имя",
  "settings.yourName": "Ваше имя",
  "settings.language": "Язык",
  "settings.uploadPhoto": "Загрузить фото",
  "settings.useDefault": "Вернуть стандартный",
  "settings.avatarHint": "JPG или PNG — обрежется до квадрата.",
  "settings.chooseAvatar": "Или выберите аватар",
  "avatarPreset.portal": "Пиксельный портал",
  "avatarPreset.shark": "Пиксельная акула",
  "avatarPreset.mountain": "Пиксельная гора",
  "avatarPreset.lifter": "Пиксельный атлет",
  "avatarPreset.gorilla": "Пиксельная горилла",
  "avatarPreset.raven": "Пиксельный ворон",
  "avatarPreset.eclipse": "Пиксельное затмение",
  "avatarPreset.barbell": "Пиксельная штанга",
  "avatarPreset.grip": "Пиксельный хват",
  "avatarPreset.pulse": "Пиксельный тренировочный пульс",
  "settings.weightUnit": "Единица веса",
  "settings.kilograms": "Килограммы",
  "settings.pounds": "Фунты",
  "settings.trainingWeek": "Тренировочная неделя",
  "settings.trainingWeekHint":
    "Выберите обычные дни тренировок и тип для каждого дня. По умолчанию расписание пустое.",
  "settings.restDay": "День отдыха",
  "settings.toggleTrainingDay": "Переключить тренировочный день: {day}",
  "settings.workoutTypeFor": "Тип тренировки: {day}",
  "settings.chooseWorkoutType": "Выберите тип тренировки",
  "settings.chooseTypeForEnabled":
    "Выберите тип тренировки для каждого включённого дня.",
  "settings.scheduleSaved": "Тренировочная неделя сохранена",
  "settings.saveSchedule": "Сохранить расписание",
  "settings.plateCalc": "Калькулятор блинов",
  "settings.plateCalcHint":
    "Блины в вашем зале — используются для разбора веса.",
  "settings.barWeight": "Вес грифа, {unit}",
  "settings.plateWeight": "Вес блина",
  "settings.removePlate": "Убрать блин {plate}",
  "settings.muscleGroups": "Группы мышц",
  "settings.muscleGroupsHint":
    "Стандартные группы встроены; можно добавить свои.",
  "settings.newGroup": "Новая группа, напр. Пресс",
  "settings.deleteGroup": "Удалить «{name}»?",
  "settings.deleteGroupMessage":
    "Удалить можно только группу без упражнений.",
  "settings.install":
    "DeepGym · установить: Поделиться → На экран «Домой»",
  "settings.signOut": "Выйти",
  "settings.helpUpdates": "Помощь и обновления",
  "settings.appGuide": "Гид по приложению",
  "settings.appGuideHint":
    "Повторите настройку и посмотрите, как связаны тренировки, история и прогресс.",
  "settings.whatsNew": "Что нового",
  "settings.whatsNewHint": "Главные изменения версии {version}.",

  "onboarding.progress": "Шаг {current} из {total}",
  "onboarding.continue": "Продолжить",
  "onboarding.exitGuide": "Выйти из гида",
  "onboarding.saveError":
    "Не удалось сохранить настройки. Ваш выбор не потерян — попробуйте ещё раз.",
  "onboarding.eligibilityError":
    "Не удалось проверить историю тренировок. Проверьте подключение и попробуйте ещё раз.",
  "onboarding.welcome.eyebrow": "ДОБРО ПОЖАЛОВАТЬ В DEEPGYM",
  "onboarding.welcome.title": "Все тренировки — наконец в одном месте.",
  "onboarding.welcome.body":
    "Пять коротких шагов настроят приложение и покажут главное для реальной тренировки.",
  "onboarding.welcome.log.title": "Записывайте без лишних действий",
  "onboarding.welcome.log.body":
    "Упражнения, подходы, повторения, вес и отказ — в одном сценарии.",
  "onboarding.welcome.remember.title": "Не держите настройки в голове",
  "onboarding.welcome.remember.body":
    "Положения тренажёров, рабочие веса и комбинации блинов всегда под рукой.",
  "onboarding.welcome.progress.title": "Видите настоящий прогресс",
  "onboarding.welcome.progress.body":
    "История, сравнения и графики превращают каждую тренировку в полезные данные.",
  "onboarding.welcome.start": "Настроить приложение",
  "onboarding.profile.eyebrow": "СДЕЛАЙТЕ ЕГО СВОИМ",
  "onboarding.profile.title": "Как DeepGym должен работать для вас?",
  "onboarding.profile.body":
    "Выберите язык, единицы веса и аватар. Всё можно изменить позже.",
  "onboarding.profile.nameRequired":
    "Введите имя, которое будет видно в приложении.",
  "onboarding.profile.avatarOptional": "Аватар необязателен",
  "onboarding.equipment.eyebrow": "ВАШ ЗАЛ",
  "onboarding.equipment.title": "Настройте оборудование один раз.",
  "onboarding.equipment.body":
    "Эти данные нужны для расчёта блинов. Стандартный набор уже готов — проверьте вес грифа.",
  "onboarding.equipment.standardKg": "Стандартные блины в килограммах",
  "onboarding.equipment.standardLb": "Стандартные блины в фунтах",
  "onboarding.equipment.plateCount": "Настроено размеров блинов: {count}",
  "onboarding.equipment.adjustLater":
    "Отдельные размеры можно изменить позже в Настройках.",
  "onboarding.equipment.invalidBar": "Введите вес грифа больше нуля.",
  "onboarding.schedule.eyebrow": "ВАШ РИТМ",
  "onboarding.schedule.title": "Как выглядит ваша обычная неделя?",
  "onboarding.schedule.body":
    "Расписание включает карточку следующей тренировки. Если график плавающий — просто укажите это.",
  "onboarding.schedule.fixed": "Тренируюсь по расписанию",
  "onboarding.schedule.flexible": "У меня гибкая неделя",
  "onboarding.schedule.flexibleHint":
    "DeepGym не будет предлагать тренировку по дню недели, но любой тип можно начать в любое время.",
  "onboarding.schedule.twoDays": "2 дня",
  "onboarding.schedule.threeDays": "3 дня",
  "onboarding.schedule.fourDays": "4 дня",
  "onboarding.schedule.required":
    "Выберите расписание или подтвердите гибкую неделю.",
  "onboarding.tour.eyebrow": "ВСЁ ГОТОВО",
  "onboarding.tour.title": "Один путь — от первого подхода до прогресса.",
  "onboarding.tour.body":
    "Вот где каждый раздел приложения становится полезным после начала тренировок.",
  "onboarding.tour.workout.title": "Тренировка",
  "onboarding.tour.workout.body":
    "Выберите тип, добавьте упражнения и подходы. Черновик сохранится даже после закрытия приложения.",
  "onboarding.tour.equipment.title": "Память оборудования",
  "onboarding.tour.equipment.body":
    "Расчёт блинов и настройки тренажёров остаются привязаны к упражнению.",
  "onboarding.tour.history.title": "История и план",
  "onboarding.tour.history.body":
    "Смотрите выполненные дни рядом с запланированными тренировками недели.",
  "onboarding.tour.progress.title": "Прогресс",
  "onboarding.tour.progress.body":
    "Сравнивайте сессии и следите за весом, объёмом, повторами и расчётным 1ПМ.",
  "onboarding.startFirstWorkout": "Начать первую тренировку",
  "onboarding.startWorkout": "Начать тренировку",
  "onboarding.continueToApp": "Перейти в приложение",
  "onboarding.goHome": "Перейти на главную",

  "firstWorkout.guideTitle": "Ваша первая тренировка",
  "firstWorkout.guideBody":
    "Трёх простых действий достаточно, чтобы начать собирать историю.",
  "firstWorkout.stepType": "Выберите тип тренировки",
  "firstWorkout.stepExercise":
    "Добавьте упражнение и укажите вес с повторами",
  "firstWorkout.stepSave": "Сохраните — результат появится в Истории",
  "firstWorkout.open": "Записать первую тренировку",
  "firstWorkout.formTip":
    "Начните с одного упражнения. Иконка блинов рассчитает нагрузку, а заметки тренажёра запомнят настройки.",
  "firstWorkout.savedTitle": "Первая тренировка записана",
  "firstWorkout.savedBody":
    "История уже работает. Следующая сессия откроет сравнения и более подробные данные прогресса.",
  "firstWorkout.openHistory": "Открыть историю",

  "whatsNew.title": "Что нового",
  "whatsNew.version": "Версия {version}",
  "whatsNew.releaseTitle":
    "Более точный DeepGym, построенный вокруг вашей недели.",
  "whatsNew.releaseBody":
    "Обновление делает главную понятнее и добавляет тренировочный план прямо в продукт.",
  "whatsNew.dashboard.title": "Понятная статистика на главной",
  "whatsNew.dashboard.body":
    "Активность недели, серия и общее число тренировок теперь ясно объясняют свои значения.",
  "whatsNew.schedule.title":
    "Тренировочная неделя и следующая тренировка",
  "whatsNew.schedule.body":
    "Укажите обычные дни и получайте настоящую подсказку на Главной и в Истории.",
  "whatsNew.avatars.title": "Pixel-аватары и Night Reverse",
  "whatsNew.avatars.body":
    "Десять новых halftone-аватаров, production-логотип и dotted-фавикон уже в приложении.",
  "whatsNew.gotIt": "Понятно",
  "whatsNew.saveError":
    "Не удалось сохранить отметку о просмотре обновления. Попробуйте ещё раз.",

  "login.tagline": "Следи за прогрессом.",
  "login.welcome": "С возвращением",
  "login.signInToStart": "Войдите, чтобы начать тренироваться",
  "login.googleFailed": "Не удалось войти через Google. Попробуйте ещё раз.",
  "login.continueGoogle": "Продолжить с Google",
  "login.telegramUsername": "Имя пользователя Telegram",
  "login.firstTime":
    "Впервые здесь? Нажмите «Start» в нашем боте, затем вернитесь и введите свой username:",
  "login.sendCode": "Отправить код",
  "login.codeSent": "Код отправлен @{username}",
  "login.signIn": "Войти",
  "login.differentUsername": "Использовать другой username",
  "login.botNote": "Одноразовые коды отправляет бот DeepGym",

  "offline.message":
    "Нет соединения. Черновик тренировки сохранён локально — синхронизируется при подключении.",

  "equipment.free_weight": "Штанга",
  "equipment.dumbbell": "Гантель",
  "equipment.machine": "Тренажёр",
  "equipment.crossover": "Кроссовер",

  "share.workout": "Поделиться тренировкой",
  "share.share": "Поделиться",
  "share.download": "Скачать картинку",

  "stats.weight": "Вес",
  "stats.oneRm": "1ПМ",
  "stats.volume": "Объём",
  "stats.reps": "Повторы",
  "stats.totalReps": "Повторы",
  "stats.failRate": "Отказы",
  "stats.perWeek": "В неделю",

  "count.exercises": "{n} упражнение|{n} упражнения|{n} упражнений",
  "count.sets": "{n} подход|{n} подхода|{n} подходов",
  "count.lastWorkouts":
    "Последняя тренировка|Последние {n} тренировки|Последние {n} тренировок",
};

const uk: Record<MessageKey, string> = {
  "common.save": "Зберегти",
  "common.saveChanges": "Зберегти зміни",
  "common.cancel": "Скасувати",
  "common.delete": "Видалити",
  "common.back": "Назад",
  "common.add": "Додати",
  "common.all": "Усі",
  "common.close": "Закрити",
  "common.error": "Щось пішло не так",
  "common.retry": "Спробувати знову",

  "nav.home": "Головна",
  "nav.history": "Історія",
  "nav.add": "Додати",
  "nav.exercises": "Вправи",
  "nav.settings": "Налаштування",

  "home.greeting": "Привіт, {name}",
  "home.athlete": "атлет",
  "home.startWorkout": "Почати тренування",
  "home.logSession": "Запиши своє тренування",
  "home.week": "Тиждень",
  "home.workoutsThisWeek": "Тренування за тиждень",
  "home.streak": "Серія",
  "home.weekStreak": "Серія тижнів",
  "home.wk": "тиж",
  "home.total": "Усього",
  "home.totalWorkouts": "Усього тренувань",
  "home.allHistory": "Вся історія",
  "home.emptyTitle": "Поки порожньо",
  "home.emptyHint": "Перше тренування — в один дотик.",
  "home.nextWorkout": "Наступне тренування",
  "home.today": "Сьогодні",
  "home.tomorrow": "Завтра",
  "home.progress": "Прогрес",
  "home.details": "Деталі",

  "history.title": "Історія",
  "history.day": "День",
  "history.week": "Тиждень",
  "history.month": "Місяць",
  "history.previous": "Назад",
  "history.next": "Вперед",
  "history.emptyTitle": "Тренувань немає",
  "history.emptyDay": "День відпочинку — або час це виправити.",
  "history.todayPlanned":
    "Сьогодні тренування ще не було — а за розкладом воно є:",
  "history.plannedDay": "На цей день заплановане тренування:",
  "history.scheduled": "Заплановане тренування",
  "history.plannedMarker": "Заплановано",

  "workout.new": "Нове тренування",
  "workout.edit": "Редагування",
  "workout.type": "Тип тренування",
  "workout.date": "Дата",
  "workout.note": "Нотатка до тренування",
  "workout.notePlaceholder": "Сьогодні втомився, не виспався…",
  "workout.addNote": "Додати нотатку",
  "workout.removeNote": "Прибрати нотатку",
  "workout.addExercise": "Додати вправу",
  "workout.copyLast": "Скопіювати минуле «{type}»",
  "workout.save": "Зберегти тренування",
  "workout.discard": "Видалити чернетку",
  "workout.delete": "Видалити тренування",
  "workout.deleteTitle": "Видалити тренування?",
  "workout.deleteMessage":
    "Тренування та всі його підходи буде видалено. Скасувати не можна.",
  "workout.notFound": "Тренування не знайдено",

  "workoutType.upper": "Верх тіла",
  "workoutType.lower": "Низ тіла",
  "workoutType.fullBody": "Усе тіло",
  "workoutType.push": "Жим",
  "workoutType.pull": "Тяга",

  "set.weight": "Вага, {unit}",
  "set.reps": "Повт",
  "set.fail": "Відмова",
  "set.addSet": "Додати підхід",
  "set.removeSet": "Прибрати підхід",
  "set.toFailure": "До відмови",
  "set.plates": "Розбір по млинцях",
  "exercise.note": "Нотатка до вправи",
  "exercise.notePlaceholder": "Нотатка до цієї вправи…",
  "exercise.remove": "Прибрати вправу",

  "picker.title": "Додати вправу",
  "picker.newTitle": "Нова вправа",
  "picker.name": "Назва",
  "picker.namePlaceholder": "Жим від грудей",
  "picker.muscleGroup": "Група м'язів",
  "picker.equipment": "Снаряд",
  "picker.machineSetupOptional": "Налаштування тренажера (необов'язково)",
  "picker.machineSetupPlaceholder": "Сидіння 4, спинка 2…",
  "picker.unitForExercise": "Одиниця ваги для цієї вправи",
  "picker.unitDefault": "За замовчуванням ({unit})",
  "picker.workingWeight": "Робоча вага, {unit} (необов'язково)",
  "picker.search": "Пошук вправ…",
  "picker.empty": "Нічого не знайдено.",
  "picker.emptyFor": "За запитом «{query}» нічого не знайдено.",
  "picker.createNew": "Створити нову вправу",
  "picker.createAdd": "Створити й додати",
  "picker.errName": "Вкажіть назву",
  "picker.errGroup": "Оберіть групу м'язів",

  "exercises.title": "Вправи",
  "exercises.emptyTitle": "Вправ поки немає",
  "exercises.emptyHint":
    "Вправи створюються під час запису тренування — вони з'являться тут після першого.",
  "exercises.working": "Робоча",

  "detail.title": "Вправа",
  "detail.editExercise": "Редагувати вправу",
  "detail.currentWorking": "Поточна робоча вага",
  "detail.editWorking": "Змінити робочу вагу",
  "detail.sessions": "Сесії",
  "detail.totalSets": "Підходи",
  "detail.bestWeight": "Найкраща вага",
  "detail.est1rm": "Оцін. 1ПМ",
  "detail.topSet": "Найкращий підхід у динаміці",
  "detail.repsByWeight": "Повтори за вагою",
  "detail.weight": "Вага",
  "detail.sets": "Підх",
  "detail.avg": "Сер",
  "detail.med": "Мед",
  "detail.mode": "Мода",
  "detail.recent": "Нещодавні",
  "detail.noSets":
    "Підходів поки немає — статистика з'явиться після першого тренування з цією вправою.",
  "detail.workingWeight": "Робоча вага",
  "detail.workingWeightHint":
    "Ваша поточна цільова вага у цій вправі. Підвищуйте з прогресом.",
  "detail.weightUnit": "Вага, {unit}",
  "detail.inUnit": "в {unit}",
  "detail.nameEmpty": "Назва не може бути порожньою",
  "detail.machineSetup": "Налаштування тренажера",
  "detail.deleteExercise": "Видалити вправу",
  "detail.deleteTitle": "Видалити вправу?",
  "detail.deleteMessage":
    "Вона також зникне з усіх записаних тренувань. Скасувати не можна.",

  "compare.title": "Порівняння",
  "compare.aria": "Порівняти з минулим результатом",
  "compare.emptyTitle": "Минулих сесій поки немає",
  "compare.emptyHint":
    "Коли запишете цю вправу, тут можна буде порівняти з минулими днями.",
  "compare.thisSession": "Ця сесія",
  "compare.pickDay": "Оберіть день",
  "compare.selectedDay": "Обраний день",
  "compare.noSets": "Цього дня підходів із цієї вправи немає.",

  "machine.title": "Налаштування тренажера",
  "machine.empty":
    "Нотаток поки немає. Запишіть положення сидіння, висоту упору та інші налаштування, щоб не тримати їх у голові.",
  "machine.edit": "Змінити налаштування",
  "machine.add": "Додати налаштування",
  "machine.placeholder": "Сидіння 4, спинка 2, ручки на рівні грудей…",

  "plates.dumbbells": "Гантелі",
  "plates.loadBar": "Збери штангу",
  "plates.loadPlates": "Збери вагу",
  "plates.each": "{unit} кожна",
  "plates.includesBar": "включно з грифом {bar}",
  "plates.dumbbell": "гантель {weight}",
  "plates.oneEachHand": "По одній в кожну руку",
  "plates.totalLoad": "{unit} загальна вага",
  "plates.barCovers": "Гриф уже покриває цю вагу — млинці не потрібні.",
  "plates.ways": "Варіанти збирання",
  "plates.fewest": "менше млинців",
  "plates.perSide": "на сторону:",
  "plates.total": "усього",
  "plates.closest": "Найближчий варіант",
  "plates.missing": "не вистачає {weight} —",
  "plates.editPlates": "змінити млинці",
  "plates.none": "Млинці не налаштовані —",
  "plates.addInSettings": "додайте їх у налаштуваннях",

  "settings.title": "Налаштування",
  "settings.profile": "Профіль",
  "settings.displayName": "Ім'я",
  "settings.yourName": "Ваше ім'я",
  "settings.language": "Мова",
  "settings.uploadPhoto": "Завантажити фото",
  "settings.useDefault": "Повернути стандартний",
  "settings.avatarHint": "JPG або PNG — буде обрізано до квадрата.",
  "settings.chooseAvatar": "Або оберіть аватар",
  "avatarPreset.portal": "Піксельний портал",
  "avatarPreset.shark": "Піксельна акула",
  "avatarPreset.mountain": "Піксельна гора",
  "avatarPreset.lifter": "Піксельний атлет",
  "avatarPreset.gorilla": "Піксельна горила",
  "avatarPreset.raven": "Піксельний крук",
  "avatarPreset.eclipse": "Піксельне затемнення",
  "avatarPreset.barbell": "Піксельна штанга",
  "avatarPreset.grip": "Піксельний хват",
  "avatarPreset.pulse": "Піксельний тренувальний пульс",
  "settings.weightUnit": "Одиниця ваги",
  "settings.kilograms": "Кілограми",
  "settings.pounds": "Фунти",
  "settings.trainingWeek": "Тренувальний тиждень",
  "settings.trainingWeekHint":
    "Оберіть звичайні дні тренувань і тип для кожного дня. За замовчуванням розклад порожній.",
  "settings.restDay": "День відпочинку",
  "settings.toggleTrainingDay": "Перемкнути тренувальний день: {day}",
  "settings.workoutTypeFor": "Тип тренування: {day}",
  "settings.chooseWorkoutType": "Оберіть тип тренування",
  "settings.chooseTypeForEnabled":
    "Оберіть тип тренування для кожного увімкненого дня.",
  "settings.scheduleSaved": "Тренувальний тиждень збережено",
  "settings.saveSchedule": "Зберегти розклад",
  "settings.plateCalc": "Калькулятор млинців",
  "settings.plateCalcHint":
    "Млинці у вашому залі — використовуються для розбору ваги.",
  "settings.barWeight": "Вага грифа, {unit}",
  "settings.plateWeight": "Вага млинця",
  "settings.removePlate": "Прибрати млинець {plate}",
  "settings.muscleGroups": "Групи м'язів",
  "settings.muscleGroupsHint":
    "Стандартні групи вбудовані; можна додати свої.",
  "settings.newGroup": "Нова група, напр. Прес",
  "settings.deleteGroup": "Видалити «{name}»?",
  "settings.deleteGroupMessage":
    "Видалити можна лише групу без вправ.",
  "settings.install":
    "DeepGym · встановити: Поділитися → На екран «Додому»",
  "settings.signOut": "Вийти",
  "settings.helpUpdates": "Допомога й оновлення",
  "settings.appGuide": "Гід застосунком",
  "settings.appGuideHint":
    "Повторіть налаштування та подивіться, як пов'язані тренування, історія й прогрес.",
  "settings.whatsNew": "Що нового",
  "settings.whatsNewHint": "Головні зміни версії {version}.",

  "onboarding.progress": "Крок {current} із {total}",
  "onboarding.continue": "Продовжити",
  "onboarding.exitGuide": "Вийти з гіда",
  "onboarding.saveError":
    "Не вдалося зберегти налаштування. Ваш вибір не втрачено — спробуйте ще раз.",
  "onboarding.eligibilityError":
    "Не вдалося перевірити історію тренувань. Перевірте з'єднання та спробуйте ще раз.",
  "onboarding.welcome.eyebrow": "ЛАСКАВО ПРОСИМО ДО DEEPGYM",
  "onboarding.welcome.title": "Усі тренування — нарешті в одному місці.",
  "onboarding.welcome.body":
    "П'ять коротких кроків налаштують застосунок і покажуть головне для справжнього тренування.",
  "onboarding.welcome.log.title": "Записуйте без зайвих дій",
  "onboarding.welcome.log.body":
    "Вправи, підходи, повтори, вага й відмова — в одному сценарії.",
  "onboarding.welcome.remember.title":
    "Не тримайте налаштування в голові",
  "onboarding.welcome.remember.body":
    "Положення тренажерів, робочі ваги й комбінації млинців завжди поруч.",
  "onboarding.welcome.progress.title": "Бачите справжній прогрес",
  "onboarding.welcome.progress.body":
    "Історія, порівняння та графіки перетворюють кожне тренування на корисні дані.",
  "onboarding.welcome.start": "Налаштувати застосунок",
  "onboarding.profile.eyebrow": "ЗРОБІТЬ ЙОГО СВОЇМ",
  "onboarding.profile.title": "Як DeepGym має працювати для вас?",
  "onboarding.profile.body":
    "Оберіть мову, одиниці ваги й аватар. Усе можна змінити пізніше.",
  "onboarding.profile.nameRequired":
    "Введіть ім'я, яке буде видно в застосунку.",
  "onboarding.profile.avatarOptional": "Аватар необов'язковий",
  "onboarding.equipment.eyebrow": "ВАШ ЗАЛ",
  "onboarding.equipment.title": "Налаштуйте обладнання один раз.",
  "onboarding.equipment.body":
    "Ці дані потрібні для розрахунку млинців. Стандартний набір уже готовий — перевірте вагу грифа.",
  "onboarding.equipment.standardKg": "Стандартні млинці в кілограмах",
  "onboarding.equipment.standardLb": "Стандартні млинці у фунтах",
  "onboarding.equipment.plateCount": "Налаштовано розмірів млинців: {count}",
  "onboarding.equipment.adjustLater":
    "Окремі розміри можна змінити пізніше в Налаштуваннях.",
  "onboarding.equipment.invalidBar": "Введіть вагу грифа більше нуля.",
  "onboarding.schedule.eyebrow": "ВАШ РИТМ",
  "onboarding.schedule.title": "Як виглядає ваш звичайний тиждень?",
  "onboarding.schedule.body":
    "Розклад вмикає картку наступного тренування. Якщо графік гнучкий — просто вкажіть це.",
  "onboarding.schedule.fixed": "Тренуюся за розкладом",
  "onboarding.schedule.flexible": "У мене гнучкий тиждень",
  "onboarding.schedule.flexibleHint":
    "DeepGym не пропонуватиме тренування за днем тижня, але будь-який тип можна почати будь-коли.",
  "onboarding.schedule.twoDays": "2 дні",
  "onboarding.schedule.threeDays": "3 дні",
  "onboarding.schedule.fourDays": "4 дні",
  "onboarding.schedule.required":
    "Оберіть розклад або підтвердьте гнучкий тиждень.",
  "onboarding.tour.eyebrow": "УСЕ ГОТОВО",
  "onboarding.tour.title": "Один шлях — від першого підходу до прогресу.",
  "onboarding.tour.body":
    "Ось де кожен розділ застосунку стає корисним після початку тренувань.",
  "onboarding.tour.workout.title": "Тренування",
  "onboarding.tour.workout.body":
    "Оберіть тип, додайте вправи й підходи. Чернетка збережеться навіть після закриття застосунку.",
  "onboarding.tour.equipment.title": "Пам'ять обладнання",
  "onboarding.tour.equipment.body":
    "Розрахунок млинців і налаштування тренажерів залишаються прив'язаними до вправи.",
  "onboarding.tour.history.title": "Історія та план",
  "onboarding.tour.history.body":
    "Дивіться виконані дні поруч із запланованими тренуваннями тижня.",
  "onboarding.tour.progress.title": "Прогрес",
  "onboarding.tour.progress.body":
    "Порівнюйте сесії та стежте за вагою, обсягом, повторами й розрахунковим 1ПМ.",
  "onboarding.startFirstWorkout": "Почати перше тренування",
  "onboarding.startWorkout": "Почати тренування",
  "onboarding.continueToApp": "Перейти до застосунку",
  "onboarding.goHome": "Перейти на головну",

  "firstWorkout.guideTitle": "Ваше перше тренування",
  "firstWorkout.guideBody":
    "Трьох простих дій достатньо, щоб почати збирати історію.",
  "firstWorkout.stepType": "Оберіть тип тренування",
  "firstWorkout.stepExercise":
    "Додайте вправу та вкажіть вагу з повторами",
  "firstWorkout.stepSave": "Збережіть — результат з'явиться в Історії",
  "firstWorkout.open": "Записати перше тренування",
  "firstWorkout.formTip":
    "Почніть з однієї вправи. Іконка млинців розрахує навантаження, а нотатки тренажера запам'ятають налаштування.",
  "firstWorkout.savedTitle": "Перше тренування записано",
  "firstWorkout.savedBody":
    "Історія вже працює. Наступна сесія відкриє порівняння та докладніші дані прогресу.",
  "firstWorkout.openHistory": "Відкрити історію",

  "whatsNew.title": "Що нового",
  "whatsNew.version": "Версія {version}",
  "whatsNew.releaseTitle":
    "Точніший DeepGym, побудований навколо вашого тижня.",
  "whatsNew.releaseBody":
    "Оновлення робить головну зрозумілішою та додає тренувальний план прямо в продукт.",
  "whatsNew.dashboard.title": "Зрозуміла статистика на головній",
  "whatsNew.dashboard.body":
    "Активність тижня, серія та загальна кількість тренувань тепер чітко пояснюють свої значення.",
  "whatsNew.schedule.title":
    "Тренувальний тиждень і наступне тренування",
  "whatsNew.schedule.body":
    "Вкажіть звичайні дні й отримуйте справжню підказку на Головній та в Історії.",
  "whatsNew.avatars.title": "Pixel-аватари та Night Reverse",
  "whatsNew.avatars.body":
    "Десять нових halftone-аватарів, production-логотип і dotted-фавікон уже в застосунку.",
  "whatsNew.gotIt": "Зрозуміло",
  "whatsNew.saveError":
    "Не вдалося зберегти позначку про перегляд оновлення. Спробуйте ще раз.",

  "login.tagline": "Стеж за прогресом.",
  "login.welcome": "З поверненням",
  "login.signInToStart": "Увійдіть, щоб почати тренуватися",
  "login.googleFailed": "Не вдалося увійти через Google. Спробуйте ще раз.",
  "login.continueGoogle": "Продовжити з Google",
  "login.telegramUsername": "Ім'я користувача Telegram",
  "login.firstTime":
    "Вперше тут? Натисніть «Start» у нашому боті, потім поверніться та введіть свій username:",
  "login.sendCode": "Надіслати код",
  "login.codeSent": "Код надіслано @{username}",
  "login.signIn": "Увійти",
  "login.differentUsername": "Використати інший username",
  "login.botNote": "Одноразові коди надсилає бот DeepGym",

  "offline.message":
    "Немає з'єднання. Чернетку тренування збережено локально — синхронізується після підключення.",

  "equipment.free_weight": "Штанга",
  "equipment.dumbbell": "Гантель",
  "equipment.machine": "Тренажер",
  "equipment.crossover": "Кросовер",

  "share.workout": "Поділитися тренуванням",
  "share.share": "Поділитися",
  "share.download": "Завантажити зображення",

  "stats.weight": "Вага",
  "stats.oneRm": "1ПМ",
  "stats.volume": "Обсяг",
  "stats.reps": "Повтори",
  "stats.totalReps": "Повтори",
  "stats.failRate": "Відмови",
  "stats.perWeek": "На тиждень",

  "count.exercises": "{n} вправа|{n} вправи|{n} вправ",
  "count.sets": "{n} підхід|{n} підходи|{n} підходів",
  "count.lastWorkouts":
    "Останнє тренування|Останні {n} тренування|Останні {n} тренувань",
};

const messages: Record<Lang, Record<MessageKey, string>> = { en, ru, uk };

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] != null ? String(vars[name]) : match,
  );
}

export function translate(
  lang: Lang,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  return interpolate(messages[lang][key] ?? en[key], vars);
}

/** one/few/many index: en has 2 forms, ru/uk have 3 (Slavic rules). */
function pluralIndex(lang: Lang, n: number): number {
  const abs = Math.abs(n);
  if (lang === "en") return abs === 1 ? 0 : 1;
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 0;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
  return 2;
}

/** "count.sets" + 3 → "3 подхода" (form picked by language plural rules). */
export function translateCount(
  lang: Lang,
  key: MessageKey,
  n: number,
): string {
  const forms = (messages[lang][key] ?? en[key]).split("|");
  const form = forms[Math.min(pluralIndex(lang, n), forms.length - 1)];
  return interpolate(form, { n });
}
