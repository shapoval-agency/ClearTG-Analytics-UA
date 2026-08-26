# Функциональный аудит ClearTG Analytics UA vs TGTrack

**Дата аудита:** 2026-07-20
**Объём:** apps/api (NestJS+Fastify, 79 TS-файлов), apps/web (Next.js 15, 73 файла), packages/database (Prisma), packages/shared (атрибуция/consent/crypto), docs/*, .env.example, docker/CI-конфигурация.
**Метод:** прямое чтение исходного кода, схемы БД, конфигурации и внутренней документации проекта; grep-верификация отсутствия заявленных модулей; сверка бэкенда с фронтендом. Без запуска БД/бота/платных API — сетевые вызовы не выполнялись, реальные конверсии не отправлялись.

Все статусы промаркированы согласно шкале ТЗ: **Реализовано / Реализовано частично / Заготовка / Не реализовано / Не удалось подтвердить / Реализовано с ошибками / Требует ручного теста**.

Полная машиночитаемая матрица (91 строка) — [`audit-matrix.json`](./audit-matrix.json) / [`audit-matrix.csv`](./audit-matrix.csv).

---

## 1. Executive Summary

**Средняя оценка готовности по 91 проверенной функции: ~35%.** Это не «средний процент готовности продукта» в маркетинговом смысле — это отражает то, что аудит по ТЗ намеренно включает большие блоки функциональности TGTrack (биллинг, Mini App, CRM-коннекторы, конструктор лендингов, антифрод, пул ботов), которых в проекте нет вовсе (readiness=0), наравне с блоками, которые уже реально работают (атрибуция, Meta/Google/TikTok доставка, retention) на 75–90%.

- **Реализовано полностью или почти полностью** (readiness ≥ 75%): 21 из 91 функций — в основном ядро: захват клика, атрибуция (5 уровней, с тестами), инвайт-линки, retention D1/D7/D30, серверная доставка в Meta CAPI / GA4 / Google Ads (полный OAuth) / TikTok Events API, шифрование секретов at rest, дашборд/досье подписчика.
- **Реализовано частично**: 24 функции — есть работающий кусок сценария, но не хватает надёжности, редактирования или интерфейса (например: tracking-ссылки нельзя редактировать/удалять; конверсии не переотправляются при сбое; лид-магнит — только текст+ссылка).
- **Реализовано с ошибками**: 7 функций, где сценарий формально работает, но содержит логическую ошибку, ломающую бизнес-корректность данных (важнейшая — повторная подписка после отписки не создаёт нового события и не переатрибутируется).
- **Не реализовано / заготовка**: 39 функций, включая **весь биллинг**, **весь блок CRM/бот-конструкторов (SendPulse, KeyCRM, Make, n8n)**, **Telegram Mini App**, **антифрод**, **join_request (заявки на вступление)**, **пул ботов**, **конструктор лендингов**, **цепочки сообщений**, **массовые рассылки** (таблицы в БД есть, кода отправки нет).

**Можно ли уже продавать?** Да, но только как **нишевый MVP для одного канала на одно агентство/владельца**, который лично контролирует токен единственного Telegram-бота, готов вручную решать вопросы биллинга (оплата не автоматизирована) и не обещает клиенту closed-канал с заявками на вступление, Mini App-точность или CRM-интеграции. Технически это уже работающий продукт для сценария «Meta/Google/TikTok реклама → публичный канал → invite-link → атрибуция → CAPI», но **не полноценный аналог TGTrack**.

**Для какого сегмента продавать сейчас:** один-два публичных Telegram-канала на клиента, с открытой (не gated) подпиской, с прямой оплатой рекламы через Meta/Google/TikTok, без требования CRM/биллинг-автоматизации, без сценария re-subscribe (клиенты, которые не теряют и не возвращают подписчиков часто).

**Чего нельзя обещать клиентам прямо сейчас:**
1. Точную атрибуцию для закрытых каналов с заявкой на вступление (join request) — не реализовано (D3/H5).
2. Работающую цель «Открыл Telegram» в рекомендованном режиме мгновенного редиректа — поле фактически не заполняется (G5/J1).
3. Устойчивую доставку рекламных конверсий при временной недоступности Meta/Google/TikTok API — нет retry/DLQ, событие один раз падает в FAILED (L3).
4. Различие ролей доступа (VIEWER действительно «только просмотр») — на backend не проверяется (A5).
5. Автоматическое удаление персональных данных по запросу (GDPR/UA) — заявка создаётся, но не обрабатывается (AG4).

**Три самые опасные проблемы (P0):**
1. **A5 + RBAC** — роль VIEWER не ограничивает запись ни на одном mutating endpoint — прямой риск несанкционированного изменения данных клиента сотрудником с «только просмотр» доступом.
2. **D1/H4 — «залипание» атрибуции при повторной подписке.** Из-за `@@unique([workspaceId, channelId, telegramUserId])` на `SubscriberProfile` и раннего `return` в `processSubscribe`, повторная подписка того же человека после отписки **не создаёт новое событие и не переатрибутируется** — агентство будет показывать клиенту неверный источник трафика для вернувшихся подписчиков.
3. **L3/L4/AI1 — отсутствие retry/backoff/DLQ во всех очередях** (доставка в рекламные кабинеты, retention, отчёты) плюс отключённая по умолчанию защита от быстрой отписки (`conversionDelayMinutes` по умолчанию = 0) — конверсии могут как теряться при сетевом сбое, так и уходить в рекламу для подписчиков, отписавшихся почти сразу.

---

## 2. Архитектура текущего продукта

```
Monorepo (pnpm workspaces)
├── apps/api   — NestJS + Fastify, порт 3001 (backend, Telegram-бот, очереди)
├── apps/web   — Next.js 15 + React 19 + Tailwind (кабинет), Vercel
├── packages/database — Prisma schema (PostgreSQL), ~30 моделей
└── packages/shared    — чистые функции: атрибуция, consent, crypto, tracking, интеграции (единственный код с unit-тестами)
```

- **БД:** PostgreSQL через Prisma, миграции — `prisma db push` (без каталога `migrations/`, см. `docs/TZ-DATABASE-BACKEND.md:54`) — то есть в проде нет управляемой истории миграций, только форсированное приведение схемы.
- **Очереди:** Redis + BullMQ, три очереди: `conversion-delivery`, `retention-check`, `bot-daily-report`. Ни одна не имеет `defaultJobOptions` (retry/backoff) — см. L3/AI1.
- **Telegram:** grammY, **один глобальный бот** (`TELEGRAM_BOT_TOKEN`) на все workspace одновременно (`apps/api/src/telegram/telegram.service.ts:18`). Webhook (prod) или polling (staging/локально). Реагирует только на чаты `type === 'channel'` — группы, супергруппы, ЛС, Telegram Business вне охвата.
- **Ad integrations:** Meta CAPI, GA4 Measurement Protocol, Google Ads (OAuth + `uploadClickConversions`), TikTok Events API — все реализованы как реальные server-side HTTP-вызовы с шифрованием токенов (AES-256-GCM) и consent-гейтингом перед отправкой.
- **Frontend:** Next.js App Router, авторизация через httpOnly cookie + JWT, прокси `/api/[...path]` на backend. Отдельный полностью изолированный «LOCAL_MODE» (localStorage-эмуляция без backend) — существует для демо на голом Vercel, не имеет отношения к реальному функционалу и не учитывается в оценке готовности.
- **CI/CD:** Dockerfile.api/.web, Railway (API) + Vercel (web), `railway.toml`. Нет GitHub Actions/CI-пайплайна с тестами в репозитории (не найдено `.github/workflows`).
- **Тесты:** только `packages/shared/src/__tests__/*.test.ts` (6 файлов, 370 строк, vitest) — покрывают чистые функции атрибуции/eligibility/retention/link-mode. **Ноль тестов в apps/api и apps/web** (ни unit, ни integration, ни e2e).

### Поток данных (фактический, по коду)

```
Реклама (Meta/Google/TikTok, UTM+clickid в URL)
  → GET /l/:slug или /r/:slug (tracking.controller.ts)
      → TrackingService.recordClick(): ClickEvent + ConsentEvent записаны в БД
      → InviteLinkService.createForClick(): per-click invite (member_limit=1) через Bot API
      → редирект (302, обычно мгновенный) на invite-ссылку Telegram
  → пользователь подписывается на канал вручную в Telegram
  → Telegram webhook chat_member → TelegramService.handleChatMemberUpdate()
      → MembershipEvent + SubscriberProfile созданы
      → AttributionService.attributeMembership(): 5-уровневый матчинг (exact/campaign/probabilistic/organic/unknown)
      → ConversionService.createSubscribeEvent(): ConversionEvent (PENDING/SKIPPED_*)
      → BullMQ 'conversion-delivery' → Meta/GA4/GoogleAds/TikTok (по eligibility/consent)
  → RetentionService (hourly cron): getChatMember → retainedD1/D7/D30 → доп. ConversionEvent при retained
  → DashboardService агрегирует всё в отчёты кабинета + Telegram daily digest (07:00 cron)
```

- **Пользователь создаётся:** `packages/database` `User` — при первом заходе через magic-link (`auth.service.ts:109-113`) или agency-инвайте.
- **Клик сохраняется:** `ClickEvent` (`tracking.service.ts:153-182`).
- **Telegram user ID сохраняется:** `MembershipEvent.telegramUserId` + `SubscriberProfile.telegramUserId` — **сырой** ID хранится в своей БД (не в рекламных платформах — туда уходит только `externalIdHash`, см. `crypto.ts:11-19`).
- **Сопоставление клика и подписки:** `AttributionService` + `packages/shared/src/attribution.ts` — через InviteLink → ClickEvent, либо probabilistic по времени.
- **Первоначальный источник хранится:** в `Attribution` (одна запись на `MembershipEvent`, **не версионируется** — см. P0 D1/H4).
- **Рекламные конверсии отправляются:** `ConversionDeliveryProcessor` (`conversion.processor.ts`).
- **Retention считается:** `RetentionService`, реальные вызовы `getChatMember`, не оценка.
- **Отчёты формируются:** `DashboardService` (веб) + `BotAdminService.buildDigest` (Telegram-бот).

---

## 3. Модульный аудит (сводно)

Полные доказательства (файл:строка) — в [`audit-matrix.json`](./audit-matrix.json)/[`audit-matrix.csv`](./audit-matrix.csv), 91 запись. Ниже — краткая сводка по модулям ТЗ.

| Модуль ТЗ | Средняя готовность | Ключевой вывод |
|---|---:|---|
| A. Пользователи/доступ/RBAC | ~50% | Auth и multi-workspace реальны; **роль VIEWER не соблюдается на backend** (P0); нет удаления сотрудника, 2FA, API-ключей, white-label |
| B. Подключение Telegram-ресурсов | ~55% | Публичные/приватные каналы — реально; группы/супергруппы/ЛС/Business — не поддерживаются вовсе |
| C. Пул ботов | ~10% | Один глобальный бот на всю платформу; сама команда это признаёт в `TZ-TELEGRAM-UA.md` как низкий приоритет — но это системный риск масштабирования |
| D. Telegram-события | ~35% | SUBSCRIBE/UNSUBSCRIBE и invite-атрибуция работают; **join_request отсутствует полностью**; custom goals/purchase события отсутствуют |
| E. Событийная модель | ~40% | ConversionEvent — сильная модель (idempotency key, статусы); ClickEvent/MembershipEvent — беднее (нет schema_version/timezone, нет unique на update_id) |
| F. Трекинговые ссылки | ~45% | Создание богатое (UTM/creative/link-mode); **нет редактирования/удаления/архивации/лимитов/QR** |
| G. Обработка кликов | ~55% | Захват всех рекламных ID и хешированного IP/UA — сильно; **гео не заполняется**; **`telegramOpenedAt` не работает в рекомендованном режиме мгновенного редиректа** (P0) |
| H. Атрибуционный движок | ~55% | Сам алгоритм — лучшая часть кодовой базы (протестирован); но **resubscribe ломает всё** (P0), нет ручной переатрибуции, BOT_START-атрибуция нерабочая |
| I. Mini App | 0% | Полностью отсутствует |
| J. Цель «Открыл Telegram» | ~35% | См. G5 — не работает по умолчанию |
| K. Антифрод | 0% | Полностью отсутствует, включая базовый rate-limit |
| L. Meta Ads | ~55% | CAPI реален; нет OAuth/Business Manager; **нет retry/DLQ** (P0); отмена при быстрой отписке работает только если явно включена задержка |
| M. Google Ads | ~60% | Наиболее полная интеграция (полный OAuth+refresh); нет enhanced conversions, нет adjustment/отзыва |
| N. TikTok Ads | ~50% | Events API реален; нет browser Pixel для дедупа |
| O. JS SDK | ~40% | Базовый скрипт есть; нет MutationObserver/SPA, нет публичного API |
| P. Диагностика | ~40% | Фрагментарно (bot-status, test-event на каждой платформе), нет единого health-дашборда |
| Q. Продвинутые конверсии | ~40% | Только числовая задержка + 4 фиксированные цели, нет визуального конструктора правил |
| R. Свои боты клиента | 0% | Модель в БД заведена, ни один сервис её не использует |
| S. Deep goals | 0% | Нет универсального API произвольной цели |
| T. CRM/бот-конструкторы | 0% | Полностью отсутствует (SendPulse/KeyCRM/Make/n8n/Zapier — 0 совпадений в коде) |
| U. Ежедневные отчёты | ~65% | Telegram-дайджест реально работает по cron; email-дайджест не реализован; нет per-workspace TZ/расписания |
| V. Карточка подписчика | ~80% | Богатое досье; нет поиска по email/телефону/CRM ID в вебе, нет merge дублей |
| W. Аналитика/Dashboard | ~65% | Хороший набор отчётов и CSV; нет XLSX/Sheets/period-comparison/пагинации |
| X. Сквозная аналитика (ROMI/LTV) | 0% | Полностью отсутствует |
| Y. API отчётности | ~10% | Внутренний REST есть, но публичного API с ApiKey/OpenAPI/пагинацией нет |
| Z. Лид-магниты | ~75% | Реально работает (проверка подписки, consent, дедуп выдачи); только текст+ссылка, общий бот на все workspace |
| AA. Цепочки сообщений | 0% | Отсутствует |
| AB. Рассылки | ~15% | Только таблицы в БД, кода отправки нет (подтверждено `REVERSE-ENGINEERING.md`) |
| AC. Аналитика лид-магнитов | ~40% | Только счётчик claims, нет детального отчёта |
| AD. Gated exit-ссылки | 0% | Отсутствует как отдельный модуль |
| AE. Конструктор лендингов | ~25% | Один статический HTML-шаблон с 2 текстовыми полями — не конструктор |
| AF. Биллинг | 0% | Полностью отсутствует — ни моделей, ни LiqPay/WayForPay/Fondy |
| AG. Безопасность/ПДн | ~55% | Шифрование секретов и webhook-secret реальны, но **оба имеют небезопасный default-fallback** (P0); нет rate-limit (P0); удаление данных не автоматизировано |
| AH. Админ-панель | ~10% | Только agency-CRUD, нет полноценной супер-админки |
| AI. Очереди/отказоустойчивость | ~55% | BullMQ используется правильно (клик не блокируется доставкой), но **ни retry, ни backoff, ни DLQ нигде не настроены** (P0) |
| AJ. Тесты | ~20% | Только unit-тесты чистых функций; **ноль тестов backend/frontend** |

---

## 4. Сквозные сценарии (Этап 3) — трассировка по коду

**Сценарий 1 — Meta Ads → клик → лендинг → Telegram → подписка → 24ч retention → серверная конверсия Meta → отчёт.**
Работает целиком: `tracking.controller.ts` → `ClickEvent` → invite → `chat_member` webhook → `Attribution` → `ConversionEvent(TG_Subscribe)` → BullMQ → `MetaService.sendEvent`. Через 24ч `RetentionService` (hourly cron) проверяет `getChatMember`, при `retained=true` создаёт `TG_Qualified_Subscribe_D1` → повторная доставка в Meta. Отчёт виден в `dashboard.service.ts:getOverview/getCampaignReports`. **Статус: Реализовано**, но без retry при сбое Meta API (см. L3) и без Meta browser Pixel для дедупа (L2).

**Сценарий 2 — Google Ads → gclid → бот → заявка → покупка → offline conversion → ROMI.**
Клик с `gclid` записывается (`ClickEvent.gclid`). «Запуск бота» (`/start`) фиксируется (`botStarted=true`). Но: 1) нет «заявки» (deep goal / custom lead) endpoint — модуль S отсутствует; 2) нет «покупки» как события — нет Purchase/Deal модели; 3) `GoogleAdsService.sendEvent` умеет слать только `TG_Subscribe`/`TG_Qualified_Subscribe_D*`/`LeadMagnet_Claimed`, не произвольную offline-конверсию покупки; 4) ROMI не считается вовсе (модуль X отсутствует). **Статус: Реализовано частично** — только первая половина цепочки (клик→бот), вторая половина (заявка→покупка→ROMI) отсутствует.

**Сценарий 3 — TikTok Ads → ttclid → Mini App → закрытый канал → join request → авто-принятие → подписка → TikTok Events API.**
`ttclid` захватывается. Mini App отсутствует (I1=0%). Закрытый канал с join request не поддерживается вовсе — нет подписки на `chat_join_request`, нет авто-принятия (D3/H5=0%). **Статус: Не реализовано** — сценарий физически невозможен в текущем коде на этапе «join request».

**Сценарий 4 — Пост → кнопка лид-магнита → проверка подписки → выдача материала → цепочка сообщений → заявка → CRM → покупка.**
Лид-магнит через deep-link `/start lm_slug` (не «кнопка под постом» — кнопки под существующим постом канала нет) → проверка `getChatMember` → выдача материала (только текст+ссылка) → `LeadMagnet_Claimed` конверсия. Дальше: цепочка сообщений отсутствует (AA=0%), CRM-передача отсутствует (T=0%), покупка не моделируется (X=0%). **Статус: Реализовано частично**, обрывается сразу после выдачи материала.

**Сценарий 5 — Подписался → отписался через 5 минут → конверсия не отправлена/отозвана.**
Работает **только если** на кампании явно выставлен `conversionDelayMinutes > 0` (`conversion.processor.ts:34-57`). При значении по умолчанию (`0`, см. `schema.prisma:193`) — конверсия уходит в очередь немедленно без проверки быстрой отписки. **Статус: Реализовано с ошибками** (P0, см. L4) — критично, так как поведение по умолчанию небезопасно.

**Сценарий 6 — Источник A → отписался → неделю спустя пришёл из источника B → повторно подписался → сохранены first/last touch корректно.**
Не работает: `SubscriberProfile` уникален навсегда по `(workspaceId, channelId, telegramUserId)`, а `TelegramService.processSubscribe` при существующем профиле делает ранний `return` (`telegram.service.ts:362-365`) — ни новый `MembershipEvent`, ни новая `Attribution`, ни новый `ConversionEvent` не создаются. Источник навсегда «залипает» на первой подписке. **Статус: Не реализовано / Реализовано с ошибками** (P0, см. D1/H4) — прямое нарушение ожидаемого поведения.

**Сценарий 7 — Webhook пришёл дважды → событие сохранено один раз → конверсия отправлена один раз.**
Косвенно защищено: `UnsubscribeEvent` имеет явный 60-секундный дедуп-guard (`telegram.service.ts:412-430`); `SubscribeEvent` защищён побочным эффектом уникальности `SubscriberProfile` (тем же механизмом, что ломает сценарий 6). Нет явного `@@unique` по `update_id`, дедупликация полагается на бизнес-эффект, а не на декларативный constraint БД. **Статус: Реализовано частично** — работает на практике для типового двойного webhook-деливери, но не является настоящей идемпотентностью по спецификации.

**Сценарий 8 — Рекламный API временно недоступен → retry → доставлено либо DLQ → ошибка видна.**
Не работает: BullMQ job добавляется без `attempts`/`backoff` (`conversion.service.ts:69-73`, `conversion.module.ts:7-11`) — при сбое `fetch()` в `MetaService/GoogleAdsService/TikTokService/GA4Service` результат `success:false` пишется в `ConversionDeliveryLog` один раз, статус конверсии становится `FAILED` навсегда, повторной попытки нет, dead-letter queue нет. Ошибка видна только в `dashboard.service.ts:getPixelDelivery` (нужно самостоятельно зайти и посмотреть), алертинга администратору нет. **Статус: Не реализовано** (P0, см. L3/AI1).

---

## 5. Скрытые технические риски

- **Race/логическая ошибка резабскрайба** (D1/H4/C3) — самый серьёзный риск для доверия к данным атрибуции.
- **Отсутствие retry/backoff/DLQ во всех трёх очередях** (conversion-delivery, retention-check, bot-daily-report) — единая причина сразу нескольких находок (L3, M2, N1-риск, AI1).
- **Небезопасные default-фоллбэки секретов**: `crypto.service.ts:10` (`ENCRYPTION_KEY` дефолт `'dev-key-change-in-production!!'`), `auth.module.ts:20` (`JWT_SECRET` дефолт `'dev-jwt-secret-change-me'`), `crypto.service.ts:33` (`HASH_SALT` дефолт `'dev-hash-salt'`) — если переменная окружения не будет установлена при деплое (человеческая ошибка на Railway/Vercel), продукт **тихо** запустится с публично известным дефолтным секретом, что скомпрометирует все зашифрованные access-токены интеграций и подделываемость JWT. Нет fail-fast проверки на старте.
- **Опциональный webhook secret** (`telegram.service.ts:464-468`) — при не заданном `TELEGRAM_WEBHOOK_SECRET` webhook принимает любой POST без проверки подписи.
- **Отсутствие rate limiting** на публичных endpoints (`/l/:slug`, `/r/:slug`, `/api/auth/magic-link`, `/telegram/webhook`) — открывает дорогу для click-спама (искажение аналитики и раздутие БД) и email-спама через magic-link endpoint.
- **`prisma db push` вместо `prisma migrate`** в проде (см. `TZ-DATABASE-BACKEND.md:54,218`) — нет управляемой истории миграций и предсказуемого отката схемы.
- **Global unauthenticated-by-workspace endpoint**: `POST /api/retention/run` (`retention.controller.ts`) не имеет `@RequiresWorkspace()` — любой аутентифицированный пользователь платформы может вручную запустить retention-проверку для **всех** workspace сразу (расходует Telegram API rate limit чужих ботов/каналов).
- **Один Telegram-бот на всю платформу** — единая точка отказа: если бот заблокирован/забанен/выключен в BotFather, аналитика **всех** клиентов агентства останавливается одновременно (не только у одного клиента).
- **Cascade-удаление на TrackingLink** (`onDelete: Cascade` на ClickEvent/InviteLink/Attribution по trackingLinkId) — сейчас не эксплуатируется (нет DELETE endpoint), но при добавлении удаления ссылок без предварительной смены на `SetNull` вся историческая аналитика удалится вместе со ссылкой.
- **Timezone** нигде не хранится как явное значение (только UTC `DateTime`) — ежедневный дайджест использует серверный `toLocaleDateString('uk-UA')`, что зависит от TZ процесса Node, а не от TZ клиента/канала.

---

## 6. Сравнительная матрица

См. [`audit-matrix.json`](./audit-matrix.json) (91 функция, полная схема со всеми полями ТЗ) и [`audit-matrix.csv`](./audit-matrix.csv) (тот же набор, для Excel/Sheets).

Сводка по приоритету:

| Приоритет | Количество | Смысл |
|---|---:|---|
| P0 — блокирует запуск / корректность данных | 16 | RBAC, resubscribe-баг, отсутствие retry/DLQ, антифрод/rate-limit, небезопасные secret-дефолты, отсутствие webhook-secret enforcement, join_request, тесты backend |
| P1 — критично для функционального аналога | 23 | Mini App, deep goals, свои боты клиента, CRM-коннекторы, биллинг, ручная переатрибуция, редактирование tracking-ссылок, аудит-лог полнота |
| P2 — важно для конкурентоспособности | 36 | White-label, конструктор лендингов, Google Sheets/XLSX, гео, cohort-отчёты, диагностика установки |
| P3 — улучшение | 16 | QR-коды, custom slug, доп. фильтры |

---

## 7. Разрывы для украинского рынка

| Требование UA-рынка | Статус |
|---|---|
| Украинская локализация интерфейса | Реализовано частично — UI и тексты бота на украинском (реальные строки в коде), но нет мультиязычности/переключателя языка |
| Meta Ads | Реализовано (CAPI), без OAuth Business Manager |
| Google Ads | Реализовано лучше остальных (полный OAuth) |
| TikTok Ads | Реализовано (Events API) |
| UAH как валюта | Реализовано — `Campaign.spendCurrency` default `"UAH"`, `ConversionEvent.currency` default `"UAH"` |
| LiqPay / WayForPay / Fondy | **Не реализовано** — 0 упоминаний в коде |
| ФОП/ТОВ реквизиты, ЄДРПОУ/РНОКПП | **Не реализовано** — нет биллинг-модуля вообще |
| SendPulse / Smart Sender | **Не реализовано** |
| KeyCRM | **Не реализовано** |
| Make / n8n / Zapier | **Не реализовано** (ни нативно, ни через универсальный outbound webhook) |
| Украинское законодательство о ПДн (аналог GDPR) | Реализовано частично — privacy policy/cookie notice/consent-log есть, но автоматизации удаления данных нет (AG4) |

**Вывод по UA-рынку:** рекламная часть (Meta/Google/TikTok/UAH) — сильная сторона продукта и уже фактически на уровне TGTrack или лучше (Google Ads OAuth полнее). Слабая сторона — весь блок монетизации и локальных бизнес-интеграций (биллинг, CRM, бот-конструкторы), без которых агентства не смогут ни платить за подписку сами, ни подключить клиентские CRM/боты.

---

## 8. План достижения функционального паритета

Без оценки сроков в днях (команда/скорость не анализировались) — только состав задач, зависимости и сложность (S/M/L/XL).

### Этап 1. Критическое ядро (устранить P0)
1. **RBAC-guard по ролям** (S) — `@Roles()` decorator + `RolesGuard`, запрет VIEWER на все non-GET маршруты. Зависимость: нет. Тесты: permission-тесты на каждый controller.
2. **Исправить resubscribe** (M) — снять «вечную» уникальность `SubscriberProfile` (например, уникальность на активную запись + история), пересмотреть `processSubscribe`/`processUnsubscribe`, чтобы повторная подписка создавала новое `MembershipEvent`+`Attribution`. Требует миграции схемы БД. Тесты: сценарий 6 e2e.
3. **Retry/backoff/DLQ на всех очередях** (M) — `defaultJobOptions: {attempts, backoff}` на `conversion-delivery`/`retention-check`/`bot-daily-report`, BullMQ failed-queue + admin endpoint для replay. Тесты: сценарий 8.
4. **Обязательная защита от быстрой отписки** (S) — минимальная задержка конверсии применяется всегда (не только когда `conversionDelayMinutes > 0`).
5. **Fail-fast на секретах** (S) — `ENCRYPTION_KEY`/`JWT_SECRET`/`HASH_SALT`/`TELEGRAM_WEBHOOK_SECRET` обязательны в `NODE_ENV=production` (throw при старте, если не заданы).
6. **Rate limiting** (S) — `@nestjs/throttler` минимум на `/l/`, `/r/`, `/api/auth/*`, `/telegram/webhook`.
7. **join_request поддержка** (L) — подписка на `chat_join_request`, `approveChatJoinRequest`/`declineChatJoinRequest`, привязка к invite-токену для авто-приёма закрытых каналов. Зависимость: расширение `MembershipEventType`, миграция.
8. **Backend-тесты** (L, сквозная задача) — webhook idempotency, RBAC, attribution e2e, retry/DLQ — минимум в рамках каждой P0-задачи выше.

### Этап 2. Коммерчески готовый MVP
1. **Редактирование/удаление/архивация tracking-ссылок** (S), с заменой `onDelete: Cascade` → `SetNull` на связанных таблицах перед добавлением delete.
2. **Ручная переатрибуция + пересчёт** (M) — endpoint + периодический recompute job.
3. **Telegram Mini App** (L) — `initData` HMAC-валидация, точная идентификация до подписки. Зависимость: фронтенд Mini App shell + backend verify endpoint.
4. **Биллинг-модуль** (XL) — модели Plan/Subscription/Payment, интеграция LiqPay/WayForPay, UAH, ФОП/ТОВ реквизиты, автопродление/grace period. Критично для монетизации.
5. **Data deletion worker** (M) — реальная обработка `DataDeletionRequest` (анонимизация/удаление связанных записей).
6. **Health/diagnostics dashboard** (M) — единая страница проверки: бот, интеграции, webhook, последние ошибки очередей.
7. **Аудит-лог на все мутации** (M) — interceptor вместо точечных вызовов.

### Этап 3. Паритет с TGTrack
1. **Свои боты клиента (BotConnection)** (XL) — активировать существующую модель `TelegramBotConnection`: сохранение токена, per-bot webhook роутинг, health-check, deep goal REST API, HMAC, rate limit, OpenAPI.
2. **Deep goals / custom goals API** (L) — универсальный `POST /api/goals`.
3. **CRM/бот-конструктор коннекторы** (L, по одному: SendPulse/KeyCRM/Make сначала — приоритет UA-рынка).
4. **Конструктор лендингов** (XL) — блочный редактор, темы, custom domain, A/B, мультиязычность.
5. **Цепочки сообщений** (L) — drip-последовательности с условиями/ветвлением.
6. **Массовые рассылки** (M) — оживить существующие модели `Mailing`/`MailingRecipient` реальным BullMQ-воркером с учётом Telegram rate limits и сегментацией.
7. **Пул ботов-агентов** (L) — снять зависимость от одного глобального токена, распределение каналов между несколькими ботами.
8. **Сквозная аналитика (ROMI/LTV)** (XL) — модели Revenue/Deal, импорт расходов/продаж, CPL/CAC/ROAS/LTV.
9. **Публичное API отчётности** (M) — ApiKey guard, OpenAPI, cursor pagination.
10. **Гео/фрод/сессии** (M) — geo-IP, visitorId/session, базовый fraud score, rate-limit по visitor.

### Этап 4. Преимущество над TGTrack
1. Privacy-by-design как маркетинговое УТП (уже частично сильная сторона — хешированные ID, consent-гейтинг) — довести до полной автоматизации GDPR/UA-комплаенса (retention policy, экспорт, удаление).
2. Мультивалютность отчётов (UAH/EUR/USD) с реальным биллингом.
3. White-label агентский кабинет с собственным доменом.
4. Визуальный конструктор правил конверсии (а не фиксированные 4 цели).

---

## 9. Список вопросов к владельцу продукта

Только то, что нельзя определить по коду/БД/документации:

1. Какой объём одновременных каналов/клиентов планируется на один Telegram-бот — стоит ли приоритизировать пул ботов (C1) выше, чем указано в `TZ-TELEGRAM-UA.md` (там помечено «низкий приоритет»)?
2. Есть ли уже юридически согласованный текст Политики конфиденциальности/Условий для UA (ФОП/ТОВ реквизиты компании), который нужно подставить в биллинг-модуль?
3. Какая платёжная система приоритетна для первого релиза биллинга — LiqPay, WayForPay или Fondy — и есть ли уже мерчант-аккаунт?
4. Нужен ли Mini App уже в MVP или можно откладывать до этапа паритета (влияет на приоритизацию P1 vs P2)?
5. Какие 1–2 CRM/бот-конструктора реально используют текущие потенциальные клиенты агентства (для приоритизации модуля T)?

---

## 10. Итоговые проценты

- **Общее функциональное соответствие TGTrack (по 91 проверенной функции, взвешенно по readiness):** **~35%**.
- **Готовность продукта для украинского рынка** (с учётом того, что рекламные интеграции Meta/Google/TikTok/UAH уже сильны, но биллинг/CRM/локальные бизнес-требования отсутствуют): **~40%** — рекламно-технический слой опережает бизнес-инфраструктурный (монетизация, локальные CRM) слой.

---

## Приложения

### Список изученных файлов (основные)
- `packages/database/prisma/schema.prisma` (полностью)
- `apps/api/src/**/*.ts` — все 79 файлов модулей auth, workspace, channel, campaign, tracking (+dto), telegram (+bot-admin, invite-link, bot-report), attribution, conversion, integrations/{meta,google-ads,ga4,tiktok}, dashboard, privacy, audit, agency, crypto, lead-magnet, retention, common (guards/decorators/mail/logger), health, main.ts, app.module.ts
- `packages/shared/src/*.ts` + `__tests__/*.test.ts` (все 6 тестов)
- `apps/web/src/app/**` — login, settings/team, links, agency/clients, api/[...path] proxy, api/auth/staging-login, api/local-login
- `apps/web/src/lib/local-store.ts`
- `README.md`, `AGENTS.md`, `docs/REVERSE-ENGINEERING.md`, `docs/TZ-TELEGRAM-UA.md`, `docs/TZ-DATABASE-BACKEND.md`
- `.env.example`, оба `package.json` (api/web), `docker-compose*.yml`

### Части проекта, к которым не было полного доступа / не дочитаны построчно
- Остальные страницы `apps/web/src/app/reports/*`, `integrations/{ga4,tiktok}/page.tsx`, `channels/[id]`, `campaigns/[id]`, `subscribers/page.tsx`, `onboarding`, `settings/{privacy,telegram}` — просмотрены по названию/структуре, не построчно; выводы по ним основаны на соответствующих backend-контроллерах.
- `docs/DEPLOY-GIT.md`, `docs/DEPLOY-SIMPLE.md`, `docs/DEPLOY-TEST.md`, `docs/USER-GUIDE.md` — не прочитаны в этом проходе (не влияют на функциональный, только на деплой-процесс).
- Не выполнялись: запуск БД/Redis, реальные вызовы Telegram/Meta/Google/TikTok API, сборка проекта, запуск тестов (`pnpm test`) — оценки по тестам основаны на наличии/отсутствии файлов, не на факте прогона.
- Нет доступа к production-окружению/секретам — оценки по env основаны только на `.env.example`.

### Функции, требующие ручного теста (не подтверждаются статическим анализом)
- Реальная доставка email через SMTP (`mail.service.ts`) — код полноценный, но фактическая работа зависит от корректности `SMTP_*` в проде.
- Поведение BullMQ при реальном падении Redis (заявлено, что API стартует, очереди «падают» — требует ручной проверки на стейджинге).
- Реальный Event Match Quality в Meta Events Manager и фактическое прохождение `test_event_code`.
- Поведение Telegram при `member_limit: 1` invite-ссылках под нагрузкой (гонки при одновременных подписках).
- Фактическое поведение `prisma db push` при конкурентных деплоях (риск, описанный в `TZ-DATABASE-BACKEND.md:250-256`, самими авторами).

### Файлы результата
1. Этот отчёт — `docs/audit/AUDIT-REPORT.md`
2. Машиночитаемая матрица — `docs/audit/audit-matrix.json`
3. CSV-версия — `docs/audit/audit-matrix.csv`
