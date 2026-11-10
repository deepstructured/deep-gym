import type { Lang } from "./translations";

// Server-rendered public copy: locale comes from the URL, never localStorage.
// Keep claims aligned with shipped functionality and the demo screenshots.
const en = {
  skip: "Skip to content", language: "Language", featuresNav: "Features", installNav: "Install", faqNav: "Questions",
  signIn: "Open app", eyebrow: "YOUR STRENGTH. YOUR RECORD.",
  title: "A workout tracker that remembers every set.",
  intro: "Log your weights and reps, repeat your routines, and follow your progress. DeepGym keeps your strength training in one place — in the gym and between sessions.",
  cta: "Start your training log", secondary: "See how it works", availability: "On your phone and desktop · Install from your browser",
  demo: "Current DeepGym interface · illustrative demo account data",
  heroAlt: "DeepGym workout form with exercise weights, reps and sets",
  strip: ["Sets & reps", "Workout templates", "Progress charts", "kg & lb"],
  featuresLabel: "BUILT AROUND YOUR SESSION", featuresTitle: "Less to remember. More to build on.",
  features: [
    { title: "Keep every set in context", body: "Record weights, reps, warm-ups and notes. Copy the previous set, reuse a past workout, and pick up your saved draft when you return." },
    { title: "See your training over time", body: "Compare sessions and explore exercise charts, working weights and training volume. Warm-up sets stay in your log without inflating working-set statistics." },
    { title: "Give your week a structure", body: "Create workout templates and a fixed or flexible training schedule. Your next session starts with the exercises you choose." },
    { title: "Remember your equipment", body: "Save machine seat and grip settings. Use the plate calculator with your bar and available plates, and choose kg or lb for each exercise." },
  ],
  showcaseTitle: "Your training, at a glance.",
  screenshots: ["Your week and customizable home widgets", "Training progress and body-weight trends", "Your reusable workout templates"],
  howLabel: "FROM FIRST SET TO NEXT SESSION", howTitle: "Make a record. Build a routine.",
  steps: [
    { title: "Set up your space", body: "Sign in with Google or Telegram. Choose your language, units, equipment and training week." },
    { title: "Log your session", body: "Add your exercises, record sets and leave notes while the details are fresh." },
    { title: "Return with context", body: "Review previous weights and reps, compare your sessions and reuse your workout structure." },
  ],
  installLabel: "ALWAYS WITHIN REACH", installTitle: "Your training log. On your home screen.",
  installBody: "DeepGym is a progressive web app. Open it in your browser or add it to your home screen for a dedicated app window.",
  installSteps: [
    { title: "iPhone & iPad", body: "Open DeepGym in Safari, tap Share, then Add to Home Screen. Open the new DeepGym icon to sign in." },
    { title: "Android", body: "Open DeepGym in Chrome. In the browser menu, choose Install app or Add to Home screen; the wording depends on your device." },
    { title: "Desktop", body: "Use DeepGym in your browser. In a supported browser, use the install icon in the address bar to add a separate app window." },
  ],
  connection: "An internet connection is needed to sign in, load account data and save workouts to your account. Your workout draft is also kept locally on the device.",
  faqTitle: "Before your first workout", faqs: [
    { q: "What can I track with DeepGym?", a: "Strength workouts, exercises, weights, reps, warm-ups, notes and body weight. Your history and exercise charts help you compare sessions over time." },
    { q: "Do I need to download it from an app store?", a: "No. The web app runs in a browser and can be added to your home screen. These pages describe the web app; they do not require an App Store or Google Play download." },
    { q: "Can I use kilograms and pounds?", a: "Yes. Choose a default unit for your profile or a different unit for an individual exercise. DeepGym converts the stored weights for display." },
    { q: "Can I use my own workout routine?", a: "Yes. Build your exercise library, create reusable workout templates and choose a fixed or flexible training schedule. You can also copy an earlier session." },
    { q: "Does it work without internet?", a: "Your draft is stored locally, but DeepGym is not a fully offline workout database. Sign-in, loading account data and saving a session to your account require a connection." },
    { q: "Which languages are available?", a: "The app supports Ukrainian, English and Russian. Choose a language during setup or change it later in Settings." },
  ],
  closing: "Give your next session a starting point.", closingBody: "Your exercises. Your notes. Your progress, session after session.",
  privacy: "Privacy policy", footer: "A personal strength training tracker.", aboutLink: "Explore DeepGym",
};

type MarketingCopy = typeof en;
const uk: MarketingCopy = {
  skip: "Перейти до вмісту", language: "Мова", featuresNav: "Можливості", installNav: "Встановлення", faqNav: "Запитання",
  signIn: "Відкрити застосунок", eyebrow: "ТВОЯ СИЛА. ТВОЯ ІСТОРІЯ.",
  title: "Щоденник тренувань, що пам’ятає кожен підхід.",
  intro: "Записуй вагу й повторення, повертайся до своїх програм і стеж за прогресом. DeepGym збирає твої силові тренування в одному місці — у залі та між заняттями.",
  cta: "Почати щоденник тренувань", secondary: "Як це працює", availability: "На телефоні й комп’ютері · Встановлюється з браузера",
  demo: "Актуальний інтерфейс DeepGym · ілюстративні дані демоакаунта",
  heroAlt: "Форма тренування DeepGym з вагою, повтореннями й підходами",
  strip: ["Підходи й повторення", "Шаблони тренувань", "Графіки прогресу", "кг та lb"],
  featuresLabel: "УСЕ ДЛЯ ТВОГО ТРЕНУВАННЯ", featuresTitle: "Менше згадувати. Більше рухатись уперед.",
  features: [
    { title: "Кожен підхід — на своєму місці", body: "Записуй вагу, повторення, розминку й нотатки. Копіюй попередній підхід або ціле тренування та повертайся до збереженої чернетки." },
    { title: "Бачити свою роботу в динаміці", body: "Порівнюй заняття, переглядай графіки вправ, робочу вагу й обсяг тренувань. Розминкові підходи є в історії, але не збільшують статистику робочих." },
    { title: "Твій тиждень, твій ритм", body: "Створюй шаблони тренувань і обирай фіксований або гнучкий розклад. Наступне заняття починається з обраних тобою вправ." },
    { title: "Налаштування залу під рукою", body: "Зберігай висоту сидіння й положення руків’їв тренажерів. Розраховуй диски для свого грифа та обирай кг або lb для кожної вправи." },
  ],
  showcaseTitle: "Твої тренування з першого погляду.",
  screenshots: ["Твій тиждень і налаштовувані віджети", "Прогрес тренувань і зміни ваги тіла", "Твої шаблони тренувань"],
  howLabel: "ВІД ПЕРШОГО ПІДХОДУ ДО НАСТУПНОГО ЗАНЯТТЯ", howTitle: "Записуй. Повертайся. Продовжуй.",
  steps: [
    { title: "Налаштуй під себе", body: "Увійди через Google або Telegram. Обери мову, одиниці ваги, обладнання та тренувальний тиждень." },
    { title: "Запиши тренування", body: "Додай вправи, запиши підходи й залиш нотатки, поки пам’ятаєш деталі." },
    { title: "Повертайся з орієнтиром", body: "Переглядай попередню вагу й повторення, порівнюй заняття та використовуй свою структуру знову." },
  ],
  installLabel: "ЗАВЖДИ ПОРУЧ", installTitle: "Твій щоденник. На головному екрані.",
  installBody: "DeepGym — прогресивний вебзастосунок. Відкривай його в браузері або додай на головний екран, щоб користуватися в окремому вікні.",
  installSteps: [
    { title: "iPhone та iPad", body: "Відкрий DeepGym у Safari, натисни «Поширити», а потім «На початковий екран». Відкрий нову іконку DeepGym та увійди." },
    { title: "Android", body: "Відкрий DeepGym у Chrome. У меню браузера обери «Встановити застосунок» або «Додати на головний екран» — назва залежить від пристрою." },
    { title: "Комп’ютер", body: "Користуйся DeepGym у браузері. Якщо браузер підтримує встановлення, натисни відповідну іконку в адресному рядку для окремого вікна." },
  ],
  connection: "Для входу, завантаження даних і збереження тренувань в акаунті потрібен інтернет. Чернетка тренування також зберігається локально на пристрої.",
  faqTitle: "Перед першим тренуванням", faqs: [
    { q: "Що можна записувати в DeepGym?", a: "Силові тренування, вправи, вагу, повторення, розминкові підходи, нотатки й вагу тіла. Історія та графіки вправ допомагають порівнювати заняття з часом." },
    { q: "Чи потрібно завантажувати застосунок із магазину?", a: "Ні. Вебверсія працює у браузері та додається на головний екран. Для можливостей, описаних на цій сторінці, не потрібне завантаження з App Store або Google Play." },
    { q: "Чи є кілограми й фунти?", a: "Так. Обери одиниці для профілю або окремої вправи. DeepGym перетворює збережену вагу для відображення в обраних одиницях." },
    { q: "Чи можна тренуватись за власною програмою?", a: "Так. Створюй свою бібліотеку вправ, шаблони тренувань і фіксований або гнучкий розклад. Можна також скопіювати попереднє заняття." },
    { q: "Чи працює застосунок без інтернету?", a: "Чернетка зберігається локально, але DeepGym не є повністю автономною базою тренувань. Для входу, завантаження даних акаунта й збереження заняття в акаунті потрібне з’єднання." },
    { q: "Які мови доступні?", a: "Українська, англійська та російська. Обери мову під час першого налаштування або зміни її пізніше в налаштуваннях." },
  ],
  closing: "Нехай наступне тренування має орієнтир.", closingBody: "Твої вправи. Твої нотатки. Твій прогрес — заняття за заняттям.",
  privacy: "Політика конфіденційності", footer: "Особистий щоденник силових тренувань.", aboutLink: "Дізнатися про DeepGym",
};

const ru: MarketingCopy = {
  skip: "Перейти к содержимому", language: "Язык", featuresNav: "Возможности", installNav: "Установка", faqNav: "Вопросы",
  signIn: "Открыть приложение", eyebrow: "ТВОЯ СИЛА. ТВОЯ ИСТОРИЯ.",
  title: "Дневник тренировок, который помнит каждый подход.",
  intro: "Записывай вес и повторения, возвращайся к своим программам и следи за прогрессом. DeepGym собирает твои силовые тренировки в одном месте — в зале и между занятиями.",
  cta: "Начать дневник тренировок", secondary: "Как это работает", availability: "На телефоне и компьютере · Установка из браузера",
  demo: "Актуальный интерфейс DeepGym · иллюстративные данные демоаккаунта",
  heroAlt: "Форма тренировки DeepGym с весом, повторениями и подходами",
  strip: ["Подходы и повторения", "Шаблоны тренировок", "Графики прогресса", "кг и lb"],
  featuresLabel: "ВСЁ ДЛЯ ТВОЕЙ ТРЕНИРОВКИ", featuresTitle: "Меньше вспоминать. Больше двигаться вперёд.",
  features: [
    { title: "Каждый подход — на своём месте", body: "Записывай вес, повторения, разминку и заметки. Копируй предыдущий подход или целую тренировку и возвращайся к сохранённому черновику." },
    { title: "Твоя работа в динамике", body: "Сравнивай занятия, смотри графики упражнений, рабочий вес и объём тренировок. Разминочные подходы есть в истории, но не увеличивают статистику рабочих." },
    { title: "Твоя неделя, твой ритм", body: "Создавай шаблоны тренировок и выбирай фиксированное или гибкое расписание. Следующее занятие начинается с выбранных тобой упражнений." },
    { title: "Настройки зала под рукой", body: "Сохраняй высоту сиденья и положение рукояток тренажёров. Рассчитывай диски для своего грифа и выбирай кг или lb для каждого упражнения." },
  ],
  showcaseTitle: "Твои тренировки с первого взгляда.",
  screenshots: ["Твоя неделя и настраиваемые виджеты", "Прогресс тренировок и изменения веса тела", "Твои шаблоны тренировок"],
  howLabel: "ОТ ПЕРВОГО ПОДХОДА ДО СЛЕДУЮЩЕГО ЗАНЯТИЯ", howTitle: "Записывай. Возвращайся. Продолжай.",
  steps: [
    { title: "Настрой под себя", body: "Войди через Google или Telegram. Выбери язык, единицы веса, оборудование и тренировочную неделю." },
    { title: "Запиши тренировку", body: "Добавь упражнения, запиши подходы и оставь заметки, пока помнишь детали." },
    { title: "Возвращайся с ориентиром", body: "Смотри предыдущий вес и повторения, сравнивай занятия и используй свою структуру снова." },
  ],
  installLabel: "ВСЕГДА РЯДОМ", installTitle: "Твой дневник. На главном экране.",
  installBody: "DeepGym — прогрессивное веб-приложение. Открывай его в браузере или добавь на главный экран, чтобы пользоваться в отдельном окне.",
  installSteps: [
    { title: "iPhone и iPad", body: "Открой DeepGym в Safari, нажми «Поделиться», затем «На экран Домой». Открой новую иконку DeepGym и войди." },
    { title: "Android", body: "Открой DeepGym в Chrome. В меню браузера выбери «Установить приложение» или «Добавить на главный экран» — название зависит от устройства." },
    { title: "Компьютер", body: "Пользуйся DeepGym в браузере. Если браузер поддерживает установку, нажми соответствующую иконку в адресной строке для отдельного окна." },
  ],
  connection: "Для входа, загрузки данных и сохранения тренировок в аккаунте нужен интернет. Черновик тренировки также сохраняется локально на устройстве.",
  faqTitle: "Перед первой тренировкой", faqs: [
    { q: "Что можно записывать в DeepGym?", a: "Силовые тренировки, упражнения, вес, повторения, разминочные подходы, заметки и вес тела. История и графики упражнений помогают сравнивать занятия со временем." },
    { q: "Нужно ли скачивать приложение из магазина?", a: "Нет. Веб-версия работает в браузере и добавляется на главный экран. Для возможностей, описанных на этой странице, не нужна загрузка из App Store или Google Play." },
    { q: "Есть ли килограммы и фунты?", a: "Да. Выбери единицы для профиля или отдельного упражнения. DeepGym преобразует сохранённый вес для отображения в выбранных единицах." },
    { q: "Можно ли тренироваться по своей программе?", a: "Да. Создавай свою библиотеку упражнений, шаблоны тренировок и фиксированное или гибкое расписание. Можно также скопировать прошлое занятие." },
    { q: "Работает ли приложение без интернета?", a: "Черновик сохраняется локально, но DeepGym не является полностью автономной базой тренировок. Для входа, загрузки данных аккаунта и сохранения занятия в аккаунте нужно соединение." },
    { q: "Какие языки доступны?", a: "Украинский, английский и русский. Выбери язык при первом запуске или измени его позже в настройках." },
  ],
  closing: "Пусть у следующей тренировки будет ориентир.", closingBody: "Твои упражнения. Твои заметки. Твой прогресс — занятие за занятием.",
  privacy: "Политика конфиденциальности", footer: "Личный дневник силовых тренировок.", aboutLink: "Узнать о DeepGym",
};

export const marketingCopy: Record<Lang, MarketingCopy> = { en, uk, ru };
