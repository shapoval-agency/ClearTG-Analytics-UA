# Project Passport

> Заполняется один раз для каждого проекта. Не храните здесь реальные пароли, ключи и секреты.

## Основное

- Название: ClearTG Analytics UA
- Назначение: честная аналитика рекламы, ведущей в Telegram-каналы/боты (атрибуция клика по рекламе → подписка/переход в бота, доставка конверсий в Meta/Google/TikTok, отчёты для агентства и клиента)
- Для кого: агентства и владельцы Telegram-каналов, которые льют рекламу (Meta/Google/TikTok) на канал или в личного/клиентского бота
- Главный результат пользователя: видит в кабинете и в Telegram-боте, из какой рекламы пришёл каждый подписчик, и это же уходит обратно в рекламные кабинеты как конверсия
- Текущий статус: beta (нишевый MVP — один канал/бот на клиента, ручной биллинг, без CRM/Mini App; см. docs/audit/AUDIT-REPORT.md)

## Технологии

- Frontend: Next.js 15 (App Router) + React 19 + Tailwind, apps/web, деплой на Vercel
- Backend: NestJS + Fastify, apps/api, деплой на VPS (pm2) / Railway
- Database: PostgreSQL через Prisma (packages/database), миграции — `prisma db push` (без каталога migrations/)
- Очереди: Redis + BullMQ (conversion-delivery, retention-check, bot-daily-report)
- Telegram: grammY — один глобальный админ-бот (webhook/polling) + отдельный рантайм клиентских ботов (apps/api/src/client-bot)
- CMS: —
- Hosting: Vercel (web) + VPS/Railway (api) + managed Postgres/Redis
- Package manager: pnpm (workspaces), packageManager закреплён как pnpm@9.15.0

## Как запустить локально

```bash
# установка
corepack enable && pnpm install

# запуск (api + web параллельно)
pnpm dev
# или по отдельности:
pnpm dev:api
pnpm dev:web

# тесты (только packages/shared — чистые функции атрибуции/трекинга/таймзоны)
pnpm --filter @cleartg/shared test

# сборка
pnpm build:all
```

- Local URL: web http://localhost:3000, api http://localhost:3001
- Test account: створюється через staging-login (`STAGING_LOGIN_EMAIL`/`STAGING_MODE=true` в apps/api/.env) або звичайний magic-link
- Test data: локальний Postgres/Redis через Homebrew або `pnpm docker:up`; workspace `slug: 'main'` використовується як дефолтний у staging-логіці бота
- Где смотреть логи: локально — вывод `pnpm dev`; на VPS — `pm2 logs cleartg-api`

## Ключевые пользовательские сценарии

1. Реклама (Meta/Google/TikTok) → клік по `/l/:slug` → редирект на invite-посилання Telegram → підписка на канал → атрибуція джерела → конверсія назад у рекламний кабінет.
2. Власник підключає Telegram-канал (додає бота адміном) → канал і підписки/відписки з'являються в кабінеті та в Telegram-боті автоматично.
3. Щоденний дайджест у Telegram-боті: окреме повідомлення по кожному каналу з активністю, підписники/відписки згруповані по джерелу трафіку.
4. Клієнт підключає власного Telegram-бота (не адмін-бот) → переходи через `/start` трекаються й атрибутуються до рекламної кампанії.
5. Агентство дивиться дашборд (Огляд, підписники, відписки, tracking-посилання, кампанії) і досьє конкретного підписника з джерелом атрибуції.

## Критические данные

- Какие данные нельзя потерять: ClickEvent, MembershipEvent/SubscriberProfile/UnsubscribeEvent, Attribution, ConversionEvent (та їх статуси) — це основа аналітики й білінгу довіри клієнта
- Какие расчёты должны быть абсолютно точными: атрибуція джерела кліку (packages/shared/src/attribution.ts), таймзонові межі "вчора"/дня (packages/shared/src/kyiv-time.ts — Europe/Kyiv, є DST), дедуплікація підписки/відписки при швидких повторних циклах
- Какие внешние интеграции используются: Meta Conversions API, Google Ads API (OAuth) + GA4 Measurement Protocol, TikTok Events API, Telegram Bot API (grammY)

## Запрещённые действия без владельца

- production-деплой;
- удаление или изменение реальных данных;
- реальные платежи;
- изменение секретов;
- опасные миграции;
- изменение прав доступа;
- прямі виклики до продакшн Telegram-бота (webhook/токен) без явного дозволу — вже траплялося випадкове `deleteWebhook()` на проді при локальному тесті зі staging-конфігом;
- другие:

## Известные ограничения

- Один глобальний адмін-бот на всю платформу (не пул ботів на клієнта) — окремо обговорювалось з ПМ як архітектурне питання.
- Роль VIEWER не обмежує запис на backend (P0 з аудиту, ще не виправлено).
- Немає retry/backoff/DLQ в чергах доставки конверсій — збій API рекламної платформи губить подію.
- Join request (заявки на вступ до закритого каналу) не підтримується.
- Редагування/видалення tracking-посилань — тільки архівація, без повного редагування.
- Немає CI (GitHub Actions) з тестами в репозиторії — лише локальний `pnpm --filter @cleartg/shared test`.

## Что не входит в текущую версию

- Білінг (повністю відсутній, оплата ручна).
- CRM/бот-конструктори (SendPulse, KeyCRM, Make, n8n).
- Telegram Mini App.
- Антифрод.
- Конструктор лендингів, масові розсилки (таблиці в БД є, коду відправки немає).
