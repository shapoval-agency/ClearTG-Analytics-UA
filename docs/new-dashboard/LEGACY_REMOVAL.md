# LEGACY_REMOVAL — как удалить старый кабинет

> Старый кабинет — архив: не развиваем, только читаем и берём нужное в `/v2`.
> Главный кабинет — `/v2`: туда ведут `/`, вход и онбординг.

Последнее обновление: 2026-11-20

---

## Где лежит старый кабинет

Весь код, который принадлежит только старому кабинету, собран в три папки:

| Папка | Что внутри |
|---|---|
| `apps/web/src/app/(legacy)/` | Страницы: `/dashboard`, `/channels`, `/links`, `/campaigns`, `/subscribers`, `/reports/*`, `/integrations/*`, `/lead-magnets`, `/settings/*`, `/agency/*` + `layout.tsx` со старым меню (`AppShell`) |
| `apps/web/src/components/legacy/` | Компоненты старого кабинета, включая `local/` (LOCAL_MODE) |
| `apps/web/src/lib/legacy/` | `actions.ts`: server actions старого кабинета |

`(legacy)` — это route group Next.js: скобки в URL не попадают, поэтому все старые адреса работают как раньше.

**Правило зависимостей:** старый код может импортировать общий код и `/v2`, а `/v2` и общий код **никогда** не импортируют ничего из `legacy`. Проверить так:

```bash
grep -rnE "legacy" apps/web/src --include='*.ts' --include='*.tsx' \
  | grep -vE "^apps/web/src/(app/\(legacy\)|components/legacy|lib/legacy)/"
```

В выводе должны остаться только комментарии и константа `LEGACY_DASHBOARD_HREF` в `components/v2/Shell.tsx`.

## Общий код (не удалять)

| Файл | Кто использует |
|---|---|
| `app/layout.tsx` | корневой: только html/body, шрифт, стили |
| `app/page.tsx`, `login/`, `auth/`, `onboarding/`, `privacy/`, `terms/`, `cookies/`, `api/` | вход, онбординг, публичные страницы, API-прокси, экспорт CSV |
| `lib/account-actions.ts` | `logoutAction`, `createWorkspaceAction` (`/v2` и онбординг) |
| `lib/api.ts`, `session.ts`, `api-origin.ts`, `labels.ts` | `/v2` |
| `components/TelegramBindButton.tsx` | `/v2` (настройки дайджеста) |
| `lib/local-mode.ts`, `lib/local-store.ts`, `components/LocalInit.tsx` | страница входа в LOCAL_MODE |

## Удаление — пошагово

1. Поставить тег-архив, чтобы старый код всегда можно было достать:
   ```bash
   git tag legacy-dashboard && git push origin legacy-dashboard
   ```
2. Удалить три папки:
   ```bash
   git rm -r "apps/web/src/app/(legacy)" apps/web/src/components/legacy apps/web/src/lib/legacy
   ```
3. Убрать ссылку «Старий кабінет» в `apps/web/src/components/v2/Shell.tsx`: константу `LEGACY_DASHBOARD_HREF` и `<Link>` с ней. Если ссылку забыть, ничего не сломается, она просто будет вести на 404.
4. Проверить:
   ```bash
   pnpm --filter @cleartg/web build
   pnpm --filter @cleartg/web exec tsc --noEmit
   ```

**Удаление уже проверено (2026-11-20):** три папки временно убирались, после чего `next build` собрал 17/17 страниц (`/`, вход, онбординг, весь `/v2`), а `tsc --noEmit` прошёл без ошибок. Потом папки вернули на место.

## Что учесть при удалении (необязательная зачистка)

- **Агентская панель** `/agency/clients` живёт только в старом кабинете. `app/api/auth/staging-login/route.ts` отправляет агентского админа без workspace на `/agency/clients`. Перед удалением нужно решить, где агентская панель будет в `/v2`, или сменить редирект.
- **LOCAL_MODE** (DEC-006: не переносится). `app/api/local-login/route.ts` ведёт на `/dashboard`. После удаления LOCAL_MODE останется только на странице входа. Можно удалить целиком: `lib/local-mode.ts`, `lib/local-store.ts`, `components/LocalInit.tsx`, `app/api/local-login/` и ветку `localMode` в `login/`.
- **Middleware**: ветка `/agency` в `apps/web/src/middleware.ts` станет лишней, но ничего не ломает.
- **Чистые адреса**: после удаления `/v2/channels` и остальные разделы можно перенести на `/channels` и т. д. Это отдельная задача: нужны редиректы со старых `/v2/*`.
- **Функции, которых ещё нет в `/v2`** (интеграции Meta/GA4/Google Ads/TikTok, лид-магниты, кампании, команда, аудит, свой бот): см. `MVP_SCOPE.md` → «Что остаётся в старом кабинете». Удалять старый кабинет — только когда они перенесены или осознанно отменены.
