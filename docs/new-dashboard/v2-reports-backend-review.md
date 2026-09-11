# v2-reports-backend-review — подготовка backend для /v2/reports

> Отчёт о выполнении: исправление подтверждённой ошибки + аддитивные фильтры/агрегация для отчётов. Frontend не трогался — ни одной страницы, графика, таблицы или UI-компонента.

Дата: 2026-09-11 · Ветка `main`, коммит на начало задачи `011373f`
Вход: [`v2-reports-plan.md`](./v2-reports-plan.md) (разделы 4 и 7)

---

## Изменено

### Изменённые файлы (5)

| Файл | Что изменилось |
|---|---|
| [apps/api/src/dashboard/dashboard.service.ts](../../apps/api/src/dashboard/dashboard.service.ts) | Багфикс `getCampaignReports()`; `from/to/channelId` в 5 методах; агрегация `reached`/`reachRate`; новый приватный `safeDivide()` |
| [apps/api/src/dashboard/dashboard.controller.ts](../../apps/api/src/dashboard/dashboard.controller.ts) | Новые `@Query('from')`, `@Query('to')`, `@Query('channelId')` на `overview`, `campaigns`, `tracking-links`; `from/to` добавлены к уже существующим `subscribers`, `unsubscribes` |
| [apps/api/src/attribution/attribution.service.ts](../../apps/api/src/attribution/attribution.service.ts) | `getAttributionStats()` принимает `channelId/from/to` — нужно было для согласованности `dataIntegrity` (см. «Исправленные ошибки») |
| [packages/shared/src/kyiv-time.ts](../../packages/shared/src/kyiv-time.ts) | Новая функция `kyivDateRange(from, to)` — общий помощник периода для всех отчётов |
| [apps/api/package.json](../../apps/api/package.json) | Новый скрипт `qa:smoke-reports` |

### Новые файлы (4)

| Файл | Назначение |
|---|---|
| [apps/api/scripts/qa/smoke-reports.ts](../../apps/api/scripts/qa/smoke-reports.ts) | Живой QA-скрипт против реального Postgres — второй слой автоматизации после `smoke-tracking-links.ts` |
| [apps/api/src/dashboard/dashboard.service.spec.ts](../../apps/api/src/dashboard/dashboard.service.spec.ts) | 15 мок-тестов на `DashboardService` |
| [apps/api/src/attribution/attribution.service.spec.ts](../../apps/api/src/attribution/attribution.service.spec.ts) | 4 мок-теста на `AttributionService.getAttributionStats` |
| [packages/shared/src/__tests__/kyiv-time.test.ts](../../packages/shared/src/__tests__/kyiv-time.test.ts) | Дополнено 8 тестами на `kyivDateRange` (был файл, тесты добавлены) |

**Не тронуто:** Prisma-схема, старый кабинет, `/l/:slug`/`/r/:slug`, `POST /telegram/webhook`, любые файлы `apps/web`. Новых таблиц, полей и миграций — ноль.

---

## API изменения

Все изменения аддитивные — без параметров поведение идентично тому, что было до этой задачи (проверено тестами «старый вызов с одним аргументом», см. раздел «Тесты»).

| Эндпоинт | Новые query-параметры | Было раньше |
|---|---|---|
| `GET /api/dashboard/overview` | `from`, `to`, `channelId` | ничего не принимал |
| `GET /api/dashboard/campaigns` | `from`, `to`, `channelId` | ничего не принимал |
| `GET /api/dashboard/tracking-links` | `from`, `to`, `channelId` | ничего не принимал |
| `GET /api/dashboard/subscribers` | `from`, `to` (добавлены к уже бывшим `channelId/status/search/attributionType/limit`) | `channelId` и остальные уже были |
| `GET /api/dashboard/unsubscribes` | `from`, `to` (добавлены к уже бывшим `channelId/search/limit`) | `channelId` уже был |

**`from`/`to`.** Календарная дата (`YYYY-MM-DD`) или любая ISO-строка — граница считается по **киевскому календарному дню** момента, а не по сырому UTC-срезу. `from` включает свой день с начала, `to` — включает свой день целиком (верхняя граница исключающая, следующий день с 00:00). Невалидная строка не роняет запрос 400 — игнорируется, как отсутствующий параметр (тот же принцип, что уже применялся к `attributionType`/`status` в этом контроллере).

**`channelId`.** Прямой фильтр на канал. Для `overview`/`campaigns`/`tracking-links` — не было вообще; теперь работает так же, как уже работал на `subscribers`/`unsubscribes`.

**Новые поля в ответах** `overview`, `campaigns`, `tracking-links`:

```jsonc
{
  "clicks": 10,
  "reached": 6,       // NEW — count(telegramOpenedAt IS NOT NULL)
  "reachRate": 0.6,   // NEW — reached / clicks, 0 при clicks=0
  // ...остальные поля без изменений
}
```

**`getAttributionStats()` (attribution.service.ts) — тоже получил `channelId/from/to`.** Не было явно в задаче, но необходимо: `getOverview()` передаёт туда те же `channelId/from/to`, иначе `dataIntegrity.missing` при применённом фильтре сравнивал бы отфильтрованные `subscribers` с нефильтрованной атрибуцией за всё время — новая ложная тревога вместо старой. Период фильтруется по `membershipEvent.occurredAt` (момент самой подписки), тем же полем, что и `subscribers` в `getOverview()`, — иначе числа в одном ответе считались бы по разным основаниям.

---

## Исправленные ошибки

### 1. `getCampaignReports()` — отписки считались по всему каналу, а не по кампании

**Было** ([dashboard.service.ts:125-127](../../apps/api/src/dashboard/dashboard.service.ts#L125) до правки, найдено при анализе 2026-09-11):

```ts
this.prisma.unsubscribeEvent.count({
  where: { channelId: campaign.channelId },   // ← campaignId нигде не участвует
}),
```

При двух активных кампаниях на одном канале обе строки в «Джерела» показывали бы **одинаковое** число отписок — суммарное по каналу, а не относящееся к конкретной кампании.

**Стало** — тот же паттерн, что уже был правильно реализован в `getTrackingLinkReports()`, применён через `campaignId` вместо `trackingLinkId`:

```ts
const unsubscribedWhere: Prisma.UnsubscribeEventWhereInput = {
  channelId: campaign.channelId,
  subscriberProfile: {
    membershipEvent: { attribution: { campaignId: campaign.id } },
  },
};
```

**Подтверждено:**
- юнит-тест на мок-Prisma — два разных числа для двух кампаний одного канала (`dashboard.service.spec.ts`);
- живой прогон против реального Postgres — `qa:smoke-reports`, кампания A показала `unsubscribes=1`, кампания B (тот же канал, без отписок) — `unsubscribes=0`.

**Известное ограничение, не новое.** Фильтр проходит через `UnsubscribeEvent.subscriberProfileId`, который опционален (см. комментарий в `getUnsubscribeFeed()` про fallback-профили). Если профиль не был привязан к событию отписки, такая отписка не попадёт ни в одну кампанию — то же ограничение, что уже принято для `getTrackingLinkReports()`, не добавлено заново.

### 2. Согласованность `dataIntegrity` при применённом фильтре

Не было в бэклоге задачи явно, найдено при реализации периода/канала для `getOverview()`. Если бы `subscribers`/`clicks`/`unsubscribes` стали фильтроваться по `channelId`/периоду, а `attributions` (из `getAttributionStats()`) — нет, баланс `dataIntegrity.missing` при применённом фильтре начал бы **врать**: сравнивал бы отфильтрованное число подписок с нефильтрованной атрибуцией за всё время воркспейса. Исправлено пробросом тех же `channelId/from/to` в `getAttributionStats()` (раздел «API изменения» выше).

---

## Тесты

### Юнит (мок-Prisma, `pnpm --filter @cleartg/api test`)

```
✓ src/attribution/attribution.service.spec.ts (4 tests)
✓ src/dashboard/dashboard.service.spec.ts (15 tests)
✓ src/tracking/tracking.service.spec.ts (4 tests)   — не менялся, прогнан как регресс

Test Files  3 passed (3)
     Tests  23 passed (23)
```

Покрыто: изоляция отписок по кампании (регресс на найденный баг), проброс `channelId`/`clickedAt`-диапазона в `where` для `getCampaignReports`/`getTrackingLinkReports`/`getSubscriberFeed`/`getUnsubscribeFeed`, расчёт `reached`/`reachRate` (включая деление на ноль), проброс фильтра в `getAttributionStats()`, и для каждого изменённого метода — отдельный тест «вызов без новых опций не меняет `where`».

### Чистая логика (`pnpm --filter @cleartg/shared test`)

```
✓ src/__tests__/kyiv-time.test.ts (14 tests)  — 6 старых + 8 новых на kyivDateRange
Test Files  10 passed (10)
     Tests  81 passed (81)
```

Новые тесты на `kyivDateRange`: один день, диапазон дней, только `from`, только `to`, отсутствие обоих (→ `undefined`), клик 23:59 / подписка 00:01 по разные стороны границы (тот же класс бага, что уже чинили в `formatDateUk`), полный ISO-таймстемп вместо голой даты, невалидная строка не 500 — тихо игнорируется.

### Живой прогон против реального Postgres

```
pnpm --filter @cleartg/api qa:smoke-reports
✅ Campaign A показує свою відписку (unsubscribes=1)
✅ Campaign B НЕ успадковує чужу відписку каналу (unsubscribes=0) — регрес на баг dashboard.service.ts
✅ Без фільтра clicks=3
✅ Без фільтра reached=2
✅ reachRate = 2/3
✅ З фільтром "сьогодні" clicks=2 (клік 10 днів тому відсічено)
✅ З фільтром "сьогодні" reached=1
✅ Виклик БЕЗ from/to — поведінка як була, clicks=3
✅ channelId=channel1 повертає A і B, без X з іншого каналу
✅ channelId=channel2 повертає лише Campaign X

✅ Всё сошлось: 10/10
```

Скрипт сам создаёт временный workspace/каналы/кампании/клики/подписки/отписки, вызывает `DashboardService` напрямую (без HTTP — дашборд-эндпоинты защищены `@RequiresWorkspace()`, поднимать auth/JWT ради этого не требовалось: под вопросом были именно Prisma-запросы, а не guard, которого не касались) и удаляет всё за собой. Проверено отдельно: после прогона `workspaces` с именем `QA Reports%` — 0 строк, `click_events` — 45 (без изменений, тот же счётчик, что был в базе до задачи).

### Сборка и типы

```
pnpm --filter @cleartg/api build   → exit 0 (prisma generate + shared build + nest build/tsc)
```
Дист пересобран заново (проверено по времени изменения файла и по наличию `reachRate`/`kyivDateRange` в скомпилированном `dist/dashboard/dashboard.service.js`) — типы проходят без единой ошибки по всей цепочке `packages/shared → packages/database → apps/api`.

### Что не проверялось и почему

- **`pnpm --filter @cleartg/api lint`** — не выполнилось: в этом окружении не установлен бинарник `eslint` (`sh: eslint: command not found`), причём как зависимость он не объявлен ни в одном `package.json` монорепозитория. Это не связано с текущей задачей и не является её регрессом — состояние окружения было таким и до неё. TypeScript-компилятор (строже большинства lint-правил на предмет типов) прошёл чисто.
- **`qa:smoke-tracking`** (регресс трекинг-ссылок) — не перезапускался. `tracking.service.ts`/`tracking.controller.ts` в этой задаче не менялись и не импортируют ничего из изменённых файлов; юнит-тест `tracking.service.spec.ts` прогнан и зелёный. Решил не поднимать второй раз дев-сервер ради проверки кода, которого не касались.
- **Регресс старого кабинета** (`/reports/*`, `getOverview()` без параметров и т.п.) — не проверялся вручную через браузер; полагаюсь на тест «старый вызов с одним аргументом» + факт, что все новые параметры строго необязательны и путь без них не меняет `where`.

---

## Что осталось

Не входило в эту задачу, зафиксировано на будущее (см. также [`v2-reports-plan.md`](./v2-reports-plan.md), разделы 4 и 6):

| Что | Где стоит |
|---|---|
| Экспорт отчёта (BOM, произвольный отчёт вместо только `subscribers`) | Конфликт MVP_SCOPE.md ↔ бриф — решение владельца, см. `v2-reports-plan.md` |
| Сравнение с предыдущим периодом (S1-21) | Предложено делать на фронте двумя вызовами того же API, не новым backend |
| N+1 в `getCampaignReports`/`getTrackingLinkReports` (по 5 запросов на строку теперь, было 4 — `reached` добавил ещё один) | Существующий долг S5-07, не увеличен качественно, только на один запрос на строку |
| Проверка старого unique-ограничения на staging/production | Вне доступа агента, нужен человек с доступом к этим базам |
| Живой resubscribe-сценарий на реальном трафике | Не менялось в этой задаче — код был и остаётся корректным по анализу, практикой не подтверждён (0 циклов в данных) |
| `Campaign.isActive`-фильтр в `getCampaignReports` может молча спрятать кампанию, если архивация кампаний появится в будущем | Сейчас безвредно — переключателя `isActive` нигде нет |

---

## Можно ли начинать frontend Reports

**Да.** Оба обязательных пункта из `v2-reports-plan.md` (раздел 4, «Обязательно для MVP») закрыты и подтверждены — юнит-тестами и живым прогоном против реального Postgres, не только чтением кода:

1. Баг с отписками в «Джерела» исправлен и покрыт регрессом.
2. `from/to/channelId` работают на всех пяти методах, которые нужны разделу «Звіти»; `reached/reachRate` считаются рядом с `clicks` там, где раньше их не было.

Фронтенд теперь может подключаться к честным данным без временных заглушек по этим трём пунктам. Не решено и не блокирует старт вёрстки, но требует внимания до релиза: конфликт по экспорту (нужно решение владельца) и два пункта из DATA TRUST, которые в принципе вне досягаемости бэкенд-кода (staging/prod-проверка, живой resubscribe).
