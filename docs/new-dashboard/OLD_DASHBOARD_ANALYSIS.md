# OLD_DASHBOARD_ANALYSIS — карта существующего кабинета

> **Это анализ, а не план переписывания.** Файл фиксирует, что уже работает, что можно переиспользовать и что нельзя трогать.
> Старый кабинет остаётся рабочим продуктом, пока новый не заменит его функционально.

Дата анализа: 2026-09-10 · Ветка: `main` · Последний коммит: `f36d409`
Источники: код репозитория, `docs/audit/AUDIT-REPORT.md` (аудит 91 функции от 2026-07-20), `docs/audit/audit-matrix.csv`, `.qa/PROJECT.md`

---

## 1. Общая карта

```
apps/web (Next.js 15 App Router)          apps/api (NestJS + Fastify)
├── AppShell — плоское меню из 19 пунктов ├── 20 модулей
├── 24 страницы кабинета                  ├── ~60 HTTP-эндпоинтов
└── прокси /api/[...path] ──────────────► └── 3 очереди BullMQ
                                                    │
              packages/shared ◄─────────────────────┤ чистая бизнес-логика
              packages/database ◄───────────────────┘ Prisma, ~30 моделей
```

---

## 2. Разделы кабинета (что видит пользователь)

Навигация задана одним массивом в [AppShell.tsx](../../apps/web/src/components/AppShell.tsx) — **плоский список из 19 пунктов** без группировки.

| # | Пункт меню | Маршрут | Файл | Что делает |
|---|---|---|---|---|
| 1 | Огляд | `/dashboard` | [page.tsx](../../apps/web/src/app/dashboard/page.tsx) | KPI, атрибуция, retention, delivery, баннер «Технічна нестиковка» |
| 2 | Канали | `/channels`, `/channels/[id]` | [channels/](../../apps/web/src/app/channels/) | Список каналов, карточка, статус бота, архив/удаление |
| 3 | Учасники | `/subscribers`, `/subscribers/[id]` | [subscribers/](../../apps/web/src/app/subscribers/) | Лента подписчиков + досье, фильтры, экспорт CSV |
| 4 | Кампанії | `/campaigns`, `/campaigns/[id]` | [campaigns/](../../apps/web/src/app/campaigns/) | CRUD кампаний, бюджет, окно атрибуции |
| 5 | Посилання | `/links` | [links/](../../apps/web/src/app/links/) | Создание tracking-ссылок и standalone invite, список, архив |
| 6 | Lead Magnets | `/lead-magnets` | [lead-magnets/](../../apps/web/src/app/lead-magnets/) | Создание лид-магнита (текст + ссылка) |
| 7 | Звіти | `/reports/overview` | [reports/overview/](../../apps/web/src/app/reports/overview/) | Сводный отчёт |
| 8 | Джерела (CR) | `/reports/sources` | [reports/sources/](../../apps/web/src/app/reports/sources/) | Клики / подписки / CR по источникам |
| 9 | Підписки | `/reports/subscriptions` | [reports/subscriptions/](../../apps/web/src/app/reports/subscriptions/) | Лента подписок |
| 10 | Переходи в бота | `/reports/bot-starts` | [reports/bot-starts/](../../apps/web/src/app/reports/bot-starts/) | Клик → `/start` по боту клиента |
| 11–14 | Meta / Google Ads / GA4 / TikTok | `/integrations/*` | [integrations/](../../apps/web/src/app/integrations/) | Подключение и тестовое событие |
| 15 | Свій бот | `/integrations/own-bot` | [own-bot/](../../apps/web/src/app/integrations/own-bot/) | Подключение бота клиента по токену |
| 16 | Команда | `/settings/team` | [settings/team/](../../apps/web/src/app/settings/team/) | Приглашение участников |
| 17 | Telegram-бот | `/settings/telegram` | [settings/telegram/](../../apps/web/src/app/settings/telegram/) | Привязка Telegram-аккаунта |
| 18 | Приватність | `/settings/privacy` | [settings/privacy/](../../apps/web/src/app/settings/privacy/) | Запросы на удаление данных, consent-log |
| 19 | Аудит | `/settings/audit-log` | [settings/audit-log/](../../apps/web/src/app/settings/audit-log/) | Журнал действий |
| + | Клієнти агентства | `/agency/clients` | [agency/clients/](../../apps/web/src/app/agency/clients/) | Только для `isAgencyAdmin` |

Не в меню: `/reports/attribution-confidence`, `/reports/pixel-delivery`, `/reports/retention`, `/login`, `/onboarding`, `/privacy`, `/terms`, `/cookies`.

### Проблемы навигации (зафиксированы, не чиним в старом кабинете)

1. **19 плоских пунктов** — прямое нарушение правила ТЗ «не плодить разделы».
2. **4 отдельных пункта под рекламные интеграции** + «Свій бот» = 5 из 19 пунктов на одну сущность «Интеграции».
3. **Отчёты размазаны**: 3 отчёта в меню, 3 отчёта существуют, но в меню их нет.
4. **Нет группировки** — «Аудит» и «Огляд» визуально равнозначны.

---

## 3. Backend: модули и эндпоинты

`apps/api/src` — 20 NestJS-модулей.

### Ядро домена

| Модуль | Эндпоинты | Что внутри |
|---|---|---|
| `tracking/` | `GET /l/:slug`, `GET /r/:slug`, `GET /cleartg.js`, `POST /api/tracking/open/:clickId`, CRUD `/api/tracking-links` (+ `PATCH :id/archive`, `PATCH :id/activate`, `DELETE :id`, `GET :slug/embed`) | Запись клика, создание per-click invite, редирект. **Ядро продукта.** |
| `telegram/` | `POST /telegram/webhook`, `/api/invite-links` (`GET`, `POST`, `PATCH :id/revoke`) | grammY, обработка `chat_member`, дайджест, health-check invite-ссылок |
| `attribution/` | — (сервис) | 5-уровневый матчинг клика и подписки |
| `conversion/` | — (сервис + BullMQ processor) | Формирование и доставка конверсий |
| `retention/` | `POST /api/retention/run` | Hourly cron, `getChatMember` → D1/D7/D30 |
| `channel/` | `/api/channels` (`GET`, `GET :id`, `GET :id/bot-status`, `POST`, `POST sync-telegram`, `PATCH :id/archive`, `PATCH :id/activate`, `DELETE :id`) | Подключение каналов и проверка прав бота |
| `campaign/` | `/api/campaigns` (`GET`, `GET :id`, `POST`) | Кампании. **Редактирования нет.** |
| `dashboard/` | `/api/dashboard/*`: `overview`, `campaigns`, `tracking-links`, `subscribers`, `subscribers/:id`, `subscribers/export.csv`, `unsubscribes`, `bot-starts`, `pixel-delivery`, `daily-digest` | Вся агрегация отчётов |
| `client-bot/` | `/api/client-bots` (`GET`, `POST`, `DELETE :id`) | Боты клиента: подключение по токену, отдельный рантайм |

### Интеграции

| Модуль | Эндпоинты | Статус по аудиту |
|---|---|---|
| `integrations/meta/` | `GET`, `POST`, `POST test-event` | CAPI 75%, дедупликация Pixel+server 50% |
| `integrations/google-ads/` | `GET`, `POST`, `GET auth-url`, `GET callback`, `POST test-event` | 80% — **полный OAuth, самая зрелая интеграция** |
| `integrations/ga4/` | `GET`, `POST`, `POST test-event` | Measurement Protocol, работает |
| `integrations/tiktok/` | `GET`, `POST`, `POST test-event` | Events API 75% |

### Платформа

| Модуль | Эндпоинты |
|---|---|
| `auth/` | `POST magic-link`, `POST staging-login`, `GET verify`, `GET me`, `GET telegram-bind-link` |
| `workspace/` | `GET /api/workspaces`, `GET :id`, `POST`, `GET/POST current/members` |
| `agency/` | `GET/POST /api/agency/clients`, `DELETE clients/:workspaceId` |
| `lead-magnet/` | `GET`, `POST /api/lead-magnets` |
| `privacy/` | `POST data-deletion`, `GET consent-log` |
| `audit/` | `GET /api/audit-log` |
| `crypto/`, `prisma/`, `common/` | AES-256-GCM, гварды `JwtAuthGuard` / `WorkspaceGuard`, логгер, почта |

### Очереди BullMQ

| Очередь | Триггер | Файл |
|---|---|---|
| `conversion-delivery` | Создание конверсии | [conversion.processor.ts](../../apps/api/src/conversion/conversion.processor.ts) |
| `retention-check` | Hourly cron | [retention.processor.ts](../../apps/api/src/retention/retention.processor.ts) |
| `bot-daily-report` | Cron 07:00 | [bot-report.processor.ts](../../apps/api/src/telegram/bot-report.processor.ts) |

Плюс `invite-link-health` — пассивная проверка живости invite-ссылок.

> ⚠️ Ни одна очередь не имеет `defaultJobOptions` (retry/backoff/DLQ). Сбой рекламного API = событие один раз падает в `FAILED`.

---

## 4. Данные

Схема: [packages/database/prisma/schema.prisma](../../packages/database/prisma/schema.prisma), 827 строк, ~30 моделей. Полное описание сущностей — в [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md#4-основные-сущности).

### Что реально наполняется данными

| Группа | Модели | Используется |
|---|---|---|
| Доступ | `User`, `MagicLinkToken`, `Workspace`, `WorkspaceMember` | ✅ |
| Telegram | `Channel`, `TelegramBotConnection`, `BotStartEvent` | ✅ |
| Кампании и ссылки | `Campaign`, `TrackingLink`, `InviteLink` | ✅ |
| События | `ClickEvent`, `MembershipEvent`, `UnsubscribeEvent`, `SubscriberProfile` | ✅ |
| Атрибуция | `Attribution`, `ConsentEvent` | ✅ |
| Конверсии | `ConversionEvent`, `ConversionDeliveryLog` | ✅ |
| Интеграции | `MetaIntegration`, `GoogleAdsIntegration`, `GA4Integration`, `TikTokIntegration` | ✅ |
| Лид-магниты | `LeadMagnet`, `LeadMagnetClaim` | ✅ |
| Приватность | `DataDeletionRequest`, `DataExportRequest`, `AuditLog` | частично |

### Модели без кода — готовый задел, **новые таблицы не создавать**

| Модель | Что это | Задача из бэклога |
|---|---|---|
| `Mailing`, `MailingRecipient`, `MailingStatus` | Рассылки: таблицы есть, кода отправки нет | S4-07 … S4-10 |
| `ApiKey` | Ключи API: модель есть, эндпоинтов нет | S4-13 |
| `WebhookEventRaw` | Сырые вебхуки для отладки/идемпотентности | S1-25, E2 |

### Поля и enum'ы, которые уже закрывают будущие задачи

| Что нужно по ТЗ | Что уже есть в схеме |
|---|---|
| Заявки в закрытый канал (S2-14, S2-15) | `MembershipEventType.JOIN_REQUEST_APPROVED` / `JOIN_REQUEST_DECLINED` |
| «Дошёл до Telegram» (S2-10 … S2-13) | `ClickEvent.telegramOpenedAt` |
| Задержка конверсии (S3-09) | `Campaign.conversionDelayMinutes` |
| Суперцель (S3-16, S3-17) | `Campaign.targetEvent` (`SUBSCRIBE`/`RETAINED_D1`/`RETAINED_D7`/`LEAD_MAGNET_CLAIMED`) |
| Посев / standalone invite (S1-07) | `InviteLinkSource.STANDALONE` + `InviteLink.name` |
| Переход на пост (S1-14) | `TrackingLink.postNumber`, `TrackingLink.landingPostUrl` |
| Переход в бота / личку (S2-03, S2-05) | `DestinationMode.BOT_START` / `CLIENT_BOT_START` / `PERSONAL_CHAT` |
| Метка креатива (S1-13) | `TrackingLink.creativeTag` |

---

## 5. Что можно переиспользовать

### 🟢 Переиспользовать без изменений — это ядро ценности продукта

| Что | Где | Почему |
|---|---|---|
| **Движок атрибуции** | [packages/shared/src/attribution.ts](../../packages/shared/src/attribution.ts) + `attribution/attribution.service.ts` | 90% готовности, покрыт unit-тестами, 5 уровней доверия |
| **Захват клика** | [tracking.service.ts](../../apps/api/src/tracking/tracking.service.ts) | 85%, все рекламные идентификаторы, есть тесты и smoke-скрипт |
| **Per-click invite** | [invite-link.service.ts](../../apps/api/src/telegram/invite-link.service.ts) | Механизм точной атрибуции, 85% |
| **Доставка в рекламные кабинеты** | `integrations/{meta,ga4,google-ads,tiktok}` | 75–80%, реальные server-side вызовы, consent-гейтинг |
| **Retention D1/D7/D30** | `retention/` | Реальные `getChatMember`, не оценка |
| **Работа со временем** | [packages/shared/src/kyiv-time.ts](../../packages/shared/src/kyiv-time.ts) | Europe/Kyiv с DST — уже исправленный источник багов |
| **Шифрование и хеширование** | [packages/shared/src/crypto.ts](../../packages/shared/src/crypto.ts), `crypto/crypto.service.ts` | AES-256-GCM, `externalIdHash` |
| **Вся схема БД** | `packages/database` | Общая для обоих кабинетов |

### 🟡 Переиспользовать логику, интерфейс делать заново

| Что | Где | Что не так |
|---|---|---|
| Агрегация отчётов | [dashboard.service.ts](../../apps/api/src/dashboard/dashboard.service.ts) | Запросы рабочие; подача в UI — плоские таблицы без вывода |
| Проверка баланса событий | `getOverview()` → `dataIntegrity` | Логика уже есть (`S1-25`), но подаётся как красный баннер без объяснения, что делать |
| Ежедневный дайджест | [bot-report.processor.ts](../../apps/api/src/telegram/bot-report.processor.ts), [channel-digest.ts](../../packages/shared/src/channel-digest.ts) | Работает (70%), нет настроек частоты/времени |
| Досье подписчика | `getSubscriberDossier()` + `/subscribers/[id]` | 80%, хорошая база для карточки из S2-22 |
| Форматирование и ярлыки | [labels.ts](../../apps/web/src/lib/labels.ts) | `attributionTypeLabel`, `confidenceLabelUk`, `formatDateUk`, `sourceSummary` — переносим целиком |
| UI-примитивы | [ui.tsx](../../apps/web/src/components/ui.tsx) | Базовый набор, но без состояний `empty`/`loading`/`error` |

### 🔴 Не переиспользовать

| Что | Почему |
|---|---|
| `AppShell.tsx` — плоское меню из 19 пунктов | Противоречит правилу «не плодить разделы» |
| **LOCAL_MODE**: [local-mode.ts](../../apps/web/src/lib/local-mode.ts), [local-store.ts](../../apps/web/src/lib/local-store.ts), [useLocalData.ts](../../apps/web/src/hooks/useLocalData.ts), [components/local/](../../apps/web/src/components/local/) | Полностью изолированная localStorage-эмуляция без backend, существует для демо на голом Vercel. По аудиту — «не имеет отношения к реальному функционалу» |
| `cleartg.js` в текущем виде | 40% готовности, ключевая часть точной атрибуции — переделываем (S1-15 … S1-18) |
| Разбиение отчётов по отдельным страницам | 6 страниц `/reports/*` вместо одного раздела с фильтрами |

---

## 6. Что нельзя трогать

> Изменения здесь ломают работающий продукт у живых клиентов или уничтожают данные.

### 🚫 Абсолютный запрет без владельца продукта

| Что | Файл / место | Почему |
|---|---|---|
| **Публичные маршруты трекинга** `/l/:slug`, `/r/:slug` | [tracking.controller.ts](../../apps/api/src/tracking/tracking.controller.ts) | Эти URL уже вшиты в запущенные рекламные кампании. Изменение = мёртвый трафик |
| **Telegram webhook** `POST /telegram/webhook` | [telegram.controller.ts](../../apps/api/src/telegram/telegram.controller.ts) | Настроен на стороне Telegram. Уже был инцидент со случайным `deleteWebhook()` на проде |
| **Продакшн-токен бота** | `TELEGRAM_BOT_TOKEN` | Один бот на всю платформу — падение останавливает аналитику **всех** клиентов |
| **Имена полей и таблиц в Prisma** | `schema.prisma` | Миграции идут через `db push` без истории — откатить нечем |
| **Имена переменных окружения** | `.env.example` | Завязаны на Railway/Vercel |
| **Формат `externalIdHash`** | [crypto.ts](../../packages/shared/src/crypto.ts) | Смена соли/алгоритма обнулит сопоставление во всех рекламных кабинетах |

### ⚠️ Трогать только осознанно

| Что | Риск |
|---|---|
| `onDelete: Cascade` на `TrackingLink` | Удаление ссылки уносит `ClickEvent`, `InviteLink`, `Attribution` — всю историю. Только архивация |
| `@@unique([botConnectionId, telegramUserId])` на `BotStartEvent` | Дедупликация повторных `/start` |
| `Attribution.membershipEventId @unique` | Одна атрибуция на событие. Переатрибуция (H3, S1-10) потребует продуманного решения, а не снятия ограничения |
| Логика `processSubscribe` | Здесь жил P0-баг «залипания» атрибуции при повторной подписке (частично исправлен `e0a3cb8`) |
| Consent-гейтинг перед отправкой в рекламу | Юридическое требование, не оптимизация |

---

## 7. Состояние по данным аудита

Аудит от 2026-07-20, 91 функция. **Взвешенная готовность против TGTrack ≈ 35%**, готовность для рынка Украины ≈ 40%.

| Категория | Кол-во | Комментарий |
|---|---:|---|
| Реализовано (≥75%) | 21 | Ядро: клик, атрибуция, invite, retention, доставка в Meta/GA4/Ads/TikTok, шифрование, досье |
| Реализовано частично | 24 | Работает кусок сценария, не хватает надёжности или интерфейса |
| Реализовано с ошибками | 7 | Формально работает, но ломает корректность данных |
| Не реализовано / заготовка | 39 | Биллинг, CRM-коннекторы, Mini App, антифрод, join request, пул ботов, цепочки, рассылки |

### Сильные стороны

- Рекламный слой (Meta / Google Ads / TikTok / GA4 / UAH) — на уровне TGTrack или лучше (Google Ads OAuth полнее).
- Движок атрибуции с честными уровнями доверия — это и есть отличие продукта.
- Приватность: хеши вместо сырых ID, шифрование токенов, consent-log.

### Слабые стороны

- Нет монетизации и локальных бизнес-интеграций (биллинг, CRM, бот-конструкторы).
- Нет устойчивости: retry/DLQ, rate limiting, пул ботов, тесты backend.
- Интерфейс показывает данные, но не помогает принять решение.

### P0-находки аудита и их текущий статус

| # | Находка | Задача | Статус на 2026-09-10 |
|---|---|---|---|
| 1 | `VIEWER` не ограничивает запись на backend | S5-05 | ❌ Открыта |
| 2 | Повторная подписка не переатрибутируется | S1-03 | ⚠️ Частично (`e0a3cb8`) — **требует перепроверки** |
| 3 | Нет retry/backoff/DLQ в очередях | S3-04 | ❌ Открыта |
| 4 | «Открыл Telegram» не заполняется | S2-10 | ✅ Исправлено (`4b53f4c`, 2026-09-10) |
| 5 | Нет rate limiting на публичных эндпоинтах | — | ❌ Открыта |
| 6 | Join request не поддерживается | S2-14, S2-15 | ❌ Открыта |
| 7 | Нет тестов backend | — | ⚠️ Первый слой для tracking-ссылок (`f36d409`) |

### Что изменилось после даты аудита

Аудит датирован 2026-07-20, но работа продолжалась. Закрыто с тех пор:

- Архивация и удаление tracking-ссылок (`655e1e5`, `27a16aa`) — закрывает F2 из аудита.
- Архивация и удаление каналов (`e3b7bff`).
- Standalone invite-ссылки для посевов и переход на конкретный пост (`78a5902`).
- Отслеживание переходов в бота клиента (`01a533b`) и в личный чат (`a0568cd`).
- Дайджест переписан на отдельные сообщения по каналам с группировкой по источникам (`83386be`, `954c460`).
- Исправлены таймзонные баги (`c1c66c9`, `1812c8b`).
- Фильтры на страницах отчётов и подписчиков (`5f2769e`, `84e74c4`).
- `telegramOpenedAt` теперь срабатывает на мгновенных редиректах (`4b53f4c`).
- Первый слой автотестов для tracking-ссылок (`f36d409`).

> **Вывод:** оценки аудита по модулям F (ссылки), G5/J1 (открыл Telegram), R1 (свой бот) и U1 (дайджест) устарели в лучшую сторону. Перед реализацией любой задачи проверять **код**, а не только матрицу аудита.

---

## 8. Как пользоваться этим документом

Перед реализацией любой задачи из бэклога:

1. Найти функцию в разделах 2–4 — есть ли она уже.
2. Проверить раздел 5 — можно ли переиспользовать логику.
3. Проверить раздел 6 — не задевает ли задача защищённые части.
4. Проверить раздел 7 — не устарела ли оценка аудита (смотреть код и `git log`).
5. Записать вывод в [`current-task.md`](./current-task.md), статус — в [`MIGRATION_MAP.md`](./MIGRATION_MAP.md).
