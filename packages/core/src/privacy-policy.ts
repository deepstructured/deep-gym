import type { Lang } from "./i18n";

/** Shared policy copy for the PWA and the Expo app. Keep these in sync. */
export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-09-23";

export const PRIVACY_POLICY_OPERATOR = "Ilya Minkin";
export const PRIVACY_POLICY_CONTACT = "ilyaminkin.jsx@gmail.com";
export const PRIVACY_POLICY_DEVELOPER_CONTACT = "hello@deepagency.digital";

export interface PrivacyPolicySection {
  id: string;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
}

export interface PrivacyPolicyDocument {
  title: string;
  effectiveDateLabel: string;
  overview: string;
  contactAction: string;
  developerCredit: string;
  developerContactLabel: string;
  sections: readonly PrivacyPolicySection[];
}

const en: PrivacyPolicyDocument = {
  title: "Privacy policy",
  effectiveDateLabel: "Effective September 23, 2026",
  overview:
    "This policy explains how DeepGym handles personal information when you use its website, progressive web app (PWA), or mobile app.",
  contactAction: "Contact about privacy",
  developerCredit: "Made by Deep Agency Digital",
  developerContactLabel: "Studio contact",
  sections: [
    {
      id: "operator",
      title: "Who is responsible and how to contact us",
      paragraphs: [
        `The operator and data controller of DeepGym is ${PRIVACY_POLICY_OPERATOR}. For privacy questions or requests, contact ${PRIVACY_POLICY_CONTACT}.`,
      ],
    },
    {
      id: "data",
      title: "Information we process",
      paragraphs: [
        "You provide most information when you create an account and log training. Workout and body-weight records can reveal information about your fitness, so treat them as personal information.",
      ],
      bullets: [
        "Account and sign-in: an account identifier, and information returned by the method you choose, such as a Google name/email or a Telegram username, ID, chat ID and one-time sign-in code. The server stores a hash of Telegram codes, not the code itself. We do not currently collect Apple sign-in data.",
        "Profile and preferences: display name, language, units, training schedule, plate settings, selected avatar or an uploaded image, and home-widget layout.",
        "Training content: exercises and equipment settings, workouts and dates, sets, weights, repetitions, failure and warm-up flags, notes, templates, drafts, and body-weight measurements. Progress figures are calculated from this content.",
        "Technical data: session information and locally saved drafts/preferences. The PWA also uses Vercel Web Analytics, which receives page-view and basic browser/device information such as page URL, referrer, approximate location and device type for aggregate usage reports.",
      ],
    },
    {
      id: "purposes",
      title: "Why we use it",
      paragraphs: [
        "We use account data to authenticate you, protect your session and sync your information between devices. We use training and profile data to save sessions, show history and progress, personalize the interface and calculate workout statistics. We use technical data to operate, secure and improve the service.",
        "Where applicable, the legal bases are providing the service you requested, our legitimate interests in security and basic product operation, and compliance with legal duties. Optional information such as an uploaded avatar is processed when you choose to add it and can be removed by changing your avatar or deleting your account.",
      ],
    },
    {
      id: "services",
      title: "Service providers and sign-in partners",
      paragraphs: [
        "Supabase provides authentication, database and image storage. The web app uses Vercel Web Analytics for aggregate page-view statistics. Google or Telegram are involved when you use their respective sign-in method; their own privacy notices also apply. Telegram delivers one-time codes through the DeepGym bot. We will update this notice before enabling Apple sign-in.",
        "We do not use training records for advertising or sell them. Providers may process information in countries other than yours. Their location and retention arrangements depend on the deployed service configuration and provider terms.",
      ],
    },
    {
      id: "storage",
      title: "Storage and security",
      paragraphs: [
        "Account, training and body-weight data are stored in Supabase. User-owned database tables use row-level access rules. The PWA and mobile app also keep session information, unsaved workout drafts and interface preferences on your device; the PWA may cache app assets for offline use.",
        "If you upload an avatar, its image is stored in a public-read storage bucket. Anyone with the image URL may be able to view it. You can choose an included preset instead of uploading an image.",
      ],
    },
    {
      id: "retention",
      title: "How long information is kept",
      paragraphs: [
        "We keep account and training content while your account exists. When you delete the account in mobile Settings, the app requests deletion of its current profile, workouts, exercises, templates, body-weight entries, linked Telegram sign-in records and uploaded avatars. Deletion from provider backups, operational logs and device caches may take longer under provider retention schedules or applicable legal duties. Contact us for details about a particular request.",
        "A Telegram one-time code is valid for five minutes. Signing out clears the active session. To remove local drafts and preferences, clear browser or app data or remove the app, as applicable.",
      ],
    },
    {
      id: "choices",
      title: "Your choices and rights",
      paragraphs: [
        "You can review and edit profile details, exercises, workouts and templates in the app. Mobile Settings includes permanent account deletion. To request access, correction, a copy of your data, deletion or another privacy right available where you live, contact the address above. You may also complain to your local data-protection authority. We may need to verify your identity before fulfilling a request.",
      ],
    },
    {
      id: "children",
      title: "Children",
      paragraphs: [
        "DeepGym is a general fitness log and is not designed for children. If you believe a child provided personal information, use the privacy contact above so we can review it.",
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      paragraphs: [
        "We will update the effective date and this page when our data practices change. Material changes may also be announced in the app.",
      ],
    },
  ],
};

const ru: PrivacyPolicyDocument = {
  title: "Политика конфиденциальности",
  effectiveDateLabel: "Действует с 23 сентября 2026 г.",
  overview:
    "Эта политика объясняет, как DeepGym обрабатывает персональные данные при использовании сайта, PWA и мобильного приложения.",
  contactAction: "Написать по вопросам данных",
  developerCredit: "Разработано Deep Agency Digital",
  developerContactLabel: "Контакт студии",
  sections: [
    {
      id: "operator",
      title: "Кто отвечает за данные и как с нами связаться",
      paragraphs: [
        `Оператор и контролёр персональных данных DeepGym: ${PRIVACY_POLICY_OPERATOR}. По вопросам персональных данных обращайтесь: ${PRIVACY_POLICY_CONTACT}.`,
      ],
    },
    {
      id: "data",
      title: "Какие данные мы обрабатываем",
      paragraphs: [
        "Большую часть данных вы сообщаете при создании аккаунта и ведении журнала тренировок. Записи о тренировках и весе тела могут раскрывать сведения о физической форме, поэтому мы рассматриваем их как персональные данные.",
      ],
      bullets: [
        "Аккаунт и вход: идентификатор аккаунта и данные выбранного способа входа, например имя или email из Google либо имя пользователя, ID и chat ID Telegram и одноразовый код. На сервере хранится хеш кода Telegram, а не сам код. Сейчас мы не собираем данные для входа через Apple.",
        "Профиль и настройки: отображаемое имя, язык, единицы измерения, расписание тренировок, настройки блинов, выбранный аватар или загруженное изображение, расположение виджетов.",
        "Тренировки: упражнения и настройки оборудования, тренировки и даты, подходы, вес, повторения, отметки отказа и разминки, заметки, шаблоны, черновики и измерения веса тела. Показатели прогресса рассчитываются из этих данных.",
        "Технические данные: сведения о сессии, локально сохранённые черновики и настройки. PWA также использует Vercel Web Analytics: сервис получает просмотры страниц и базовые сведения о браузере и устройстве, например URL страницы, источник перехода, приблизительное местоположение и тип устройства, для сводной статистики.",
      ],
    },
    {
      id: "purposes",
      title: "Зачем мы используем данные",
      paragraphs: [
        "Данные аккаунта нужны для входа, защиты сессии и синхронизации между устройствами. Данные тренировок и профиля нужны для сохранения занятий, истории и прогресса, настройки интерфейса и расчёта статистики. Технические данные помогают поддерживать работу и безопасность сервиса и улучшать его.",
        "Где применимо, правовые основания — предоставление запрошенного сервиса, наш законный интерес в безопасности и работе продукта, а также соблюдение требований закона. Дополнительные данные, например загруженный аватар, обрабатываются по вашему выбору; аватар можно заменить, а аккаунт удалить.",
      ],
    },
    {
      id: "services",
      title: "Поставщики сервисов и партнёры по входу",
      paragraphs: [
        "Supabase обеспечивает аутентификацию, базу данных и хранение изображений. Веб-приложение использует Vercel Web Analytics для сводной статистики просмотров. Google или Telegram участвуют, если вы выбрали соответствующий способ входа; также действуют их собственные политики. Telegram доставляет одноразовые коды через бота DeepGym. До включения входа через Apple мы обновим этот документ.",
        "Мы не используем тренировочные записи для рекламы и не продаём их. Поставщики могут обрабатывать данные за пределами вашей страны. Место обработки и сроки хранения зависят от настройки развёрнутого сервиса и условий поставщика.",
      ],
    },
    {
      id: "storage",
      title: "Хранение и безопасность",
      paragraphs: [
        "Данные аккаунта, тренировок и веса тела хранятся в Supabase. Для пользовательских таблиц действуют правила доступа на уровне строк. PWA и мобильное приложение также хранят на устройстве сведения о сессии, несохранённые черновики и настройки интерфейса; PWA может кэшировать файлы приложения для работы без сети.",
        "Если вы загружаете аватар, изображение помещается в хранилище с публичным чтением. Человек, получивший URL изображения, может его просмотреть. Вместо загрузки можно выбрать встроенный аватар.",
      ],
    },
    {
      id: "retention",
      title: "Сроки хранения",
      paragraphs: [
        "Данные аккаунта и тренировок хранятся, пока существует аккаунт. При удалении аккаунта в настройках мобильного приложения отправляется запрос на удаление текущего профиля, тренировок, упражнений, шаблонов, измерений веса тела, связанных записей Telegram и загруженных аватаров. Удаление данных из резервных копий, служебных журналов поставщиков и кэшей устройств может занять больше времени согласно их срокам хранения или требованиям закона. За сведениями по конкретному запросу обратитесь к нам.",
        "Одноразовый код Telegram действителен пять минут. Выход из аккаунта очищает активную сессию. Чтобы удалить локальные черновики и настройки, очистите данные браузера или приложения либо удалите приложение — в зависимости от платформы.",
      ],
    },
    {
      id: "choices",
      title: "Ваш выбор и права",
      paragraphs: [
        "В приложении можно просматривать и менять профиль, упражнения, тренировки и шаблоны. В настройках мобильной версии доступно безвозвратное удаление аккаунта. Чтобы запросить доступ, исправление, копию или удаление данных либо воспользоваться иным правом по законодательству вашей страны, обратитесь по указанному выше адресу. Также можно подать жалобу в местный орган по защите данных. Перед ответом мы можем проверить вашу личность.",
      ],
    },
    {
      id: "children",
      title: "Дети",
      paragraphs: [
        "DeepGym — общий журнал тренировок; он не предназначен специально для детей. Если вы считаете, что ребёнок предоставил персональные данные, свяжитесь с нами по указанному выше адресу.",
      ],
    },
    {
      id: "changes",
      title: "Изменения политики",
      paragraphs: [
        "Если обработка данных изменится, мы обновим эту страницу и дату вступления изменений в силу. О существенных изменениях также можем сообщить в приложении.",
      ],
    },
  ],
};

const uk: PrivacyPolicyDocument = {
  title: "Політика конфіденційності",
  effectiveDateLabel: "Чинна з 23 вересня 2026 р.",
  overview:
    "Ця політика пояснює, як DeepGym обробляє персональні дані під час використання сайту, PWA та мобільного застосунку.",
  contactAction: "Написати з питань даних",
  developerCredit: "Створено Deep Agency Digital",
  developerContactLabel: "Контакт студії",
  sections: [
    {
      id: "operator",
      title: "Хто відповідає за дані та як з нами зв’язатися",
      paragraphs: [
        `Оператор і контролер персональних даних DeepGym: ${PRIVACY_POLICY_OPERATOR}. З питань персональних даних звертайтеся: ${PRIVACY_POLICY_CONTACT}.`,
      ],
    },
    {
      id: "data",
      title: "Які дані ми обробляємо",
      paragraphs: [
        "Більшість даних ви надаєте під час створення акаунта та ведення журналу тренувань. Записи про тренування й вагу тіла можуть розкривати відомості про фізичну форму, тому ми вважаємо їх персональними даними.",
      ],
      bullets: [
        "Акаунт і вхід: ідентифікатор акаунта та дані обраного способу входу, наприклад ім’я або email від Google чи ім’я користувача, ID і chat ID Telegram та одноразовий код. На сервері зберігається хеш коду Telegram, а не сам код. Зараз ми не збираємо дані для входу через Apple.",
        "Профіль і налаштування: відображуване ім’я, мова, одиниці вимірювання, графік тренувань, налаштування млинців, обраний аватар або завантажене зображення, розташування віджетів.",
        "Тренування: вправи й налаштування обладнання, тренування та дати, підходи, вага, повторення, позначки відмови й розминки, нотатки, шаблони, чернетки та вимірювання ваги тіла. Показники прогресу обчислюються з цих даних.",
        "Технічні дані: відомості про сесію, локально збережені чернетки й налаштування. PWA також використовує Vercel Web Analytics: сервіс отримує перегляди сторінок і базові відомості про браузер та пристрій, наприклад URL сторінки, джерело переходу, приблизне місцезнаходження й тип пристрою, для зведеної статистики.",
      ],
    },
    {
      id: "purposes",
      title: "Навіщо ми використовуємо дані",
      paragraphs: [
        "Дані акаунта потрібні для входу, захисту сесії та синхронізації між пристроями. Дані тренувань і профілю потрібні для збереження занять, історії та прогресу, налаштування інтерфейсу й обчислення статистики. Технічні дані допомагають підтримувати роботу та безпеку сервісу й поліпшувати його.",
        "Де це застосовно, правові підстави — надання запитаного сервісу, наш законний інтерес у безпеці й роботі продукту та виконання вимог закону. Додаткові дані, наприклад завантажений аватар, обробляються за вашим вибором; аватар можна замінити, а акаунт видалити.",
      ],
    },
    {
      id: "services",
      title: "Постачальники сервісів і партнери для входу",
      paragraphs: [
        "Supabase забезпечує автентифікацію, базу даних і зберігання зображень. Вебзастосунок використовує Vercel Web Analytics для зведеної статистики переглядів. Google або Telegram залучаються, коли ви обираєте відповідний спосіб входу; також діють їхні власні політики. Telegram доставляє одноразові коди через бота DeepGym. Перед увімкненням входу через Apple ми оновимо цей документ.",
        "Ми не використовуємо записи тренувань для реклами й не продаємо їх. Постачальники можуть обробляти дані за межами вашої країни. Місце обробки та строки зберігання залежать від налаштування розгорнутого сервісу й умов постачальника.",
      ],
    },
    {
      id: "storage",
      title: "Зберігання та безпека",
      paragraphs: [
        "Дані акаунта, тренувань і ваги тіла зберігаються в Supabase. Для користувацьких таблиць діють правила доступу на рівні рядків. PWA та мобільний застосунок також зберігають на пристрої відомості про сесію, незбережені чернетки й налаштування інтерфейсу; PWA може кешувати файли застосунку для роботи без мережі.",
        "Якщо ви завантажуєте аватар, зображення потрапляє до сховища з публічним читанням. Людина, яка отримала URL зображення, може його переглянути. Замість завантаження можна обрати вбудований аватар.",
      ],
    },
    {
      id: "retention",
      title: "Строки зберігання",
      paragraphs: [
        "Дані акаунта й тренувань зберігаються, доки існує акаунт. Під час видалення акаунта в налаштуваннях мобільного застосунку надсилається запит на видалення поточного профілю, тренувань, вправ, шаблонів, вимірювань ваги тіла, пов’язаних записів Telegram і завантажених аватарів. Видалення даних із резервних копій, службових журналів постачальників і кешів пристроїв може тривати довше відповідно до їхніх строків зберігання або вимог закону. За відомостями щодо конкретного запиту зверніться до нас.",
        "Одноразовий код Telegram чинний п’ять хвилин. Вихід з акаунта очищає активну сесію. Щоб видалити локальні чернетки й налаштування, очистьте дані браузера або застосунку чи видаліть застосунок — залежно від платформи.",
      ],
    },
    {
      id: "choices",
      title: "Ваш вибір і права",
      paragraphs: [
        "У застосунку можна переглядати й змінювати профіль, вправи, тренування та шаблони. У налаштуваннях мобільної версії доступне безповоротне видалення акаунта. Щоб запросити доступ, виправлення, копію чи видалення даних або скористатися іншим правом за законодавством вашої країни, зверніться за адресою вище. Також можна подати скаргу до місцевого органу із захисту даних. Перед відповіддю ми можемо перевірити вашу особу.",
      ],
    },
    {
      id: "children",
      title: "Діти",
      paragraphs: [
        "DeepGym — загальний журнал тренувань; його не створено спеціально для дітей. Якщо ви вважаєте, що дитина надала персональні дані, зв’яжіться з нами за адресою вище.",
      ],
    },
    {
      id: "changes",
      title: "Зміни політики",
      paragraphs: [
        "Якщо обробка даних зміниться, ми оновимо цю сторінку та дату набрання змінами чинності. Про суттєві зміни також можемо повідомити в застосунку.",
      ],
    },
  ],
};

export const PRIVACY_POLICY: Record<Lang, PrivacyPolicyDocument> = { en, ru, uk };

export function getPrivacyPolicy(lang: Lang): PrivacyPolicyDocument {
  return PRIVACY_POLICY[lang];
}
