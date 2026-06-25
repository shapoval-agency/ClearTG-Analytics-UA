# ClearTG Analytics UA

**Чесна аналітика Telegram-реклами для України** — privacy-by-design SaaS для атрибуції підписок, retention-аналітики та server-side передачі подій у Meta CAPI, GA4 Measurement Protocol, Google Ads та TikTok Events API.

## Архітектура (модель tgtrack для UA)

```
Реклама → /l/{slug} або /r/{slug}
    → фіксація кліку (UTM, fbclid, gclid)
    → унікальна invite-ссилка Telegram (на клік)
    → auto-redirect у канал (302, непомітно для користувача)
    → бот бачить invite_link при підписці → точна атрибуція
    → Meta CAPI / GA4 / Google Ads / TikTok
```

### Режими посилань

| Режим | URL | Поведінка |
|-------|-----|-----------|
| **Landing** | `/l/{slug}` | Paid: Meta, Google, TikTok |
| **Shortlink** | `/r/{slug}` | Influencer, organic |

- За замовчуванням: `autoRedirect=true` — миттєвий перехід у Telegram після кліку
- `usePerClickInvite=true` — унікальна invite на клік для точної атрибуції (>95%)
- `autoRedirect=false` — режим з кнопкою (fallback)
- `redirectDelayMs` — затримка перед redirect (0 = миттєво)

### Звіти

- `GET /api/dashboard/campaigns` — кліки, підписки, CR по кампаніях
- `GET /api/dashboard/tracking-links` — звіт по кожному посиланню
- UI: `/reports/sources`

## Принципи

- Privacy by design, consent-aware tracking, data minimization
- Тільки офіційний Telegram Bot API (без userbot, MTProto, парсингу)
- Без російських інтеграцій та залежностей
- Сирий Telegram ID не передається в рекламні платформи
- Кожна зовнішня подія має legal basis, consent status і delivery log

## Стек

| Шар | Технологія |
|-----|-----------|
| Monorepo | pnpm workspaces |
| Backend | NestJS + Fastify |
| Telegram | grammY |
| DB | PostgreSQL + Prisma |
| Queue | Redis + BullMQ |
| Frontend | Next.js 15 + Tailwind |
| Tests | Vitest |

## Швидкий старт

### 1. Інфраструктура

```bash
cp .env.example .env
docker compose up -d
```

### 2. Залежності

```bash
corepack enable
pnpm install
```

### 3. База даних

```bash
pnpm db:push
pnpm --filter @cleartg/database exec ts-node prisma/seed.ts
```

### 4. Запуск

```bash
pnpm dev
```

- **Login:** http://localhost:3000/login
- **Dashboard:** http://localhost:3000/dashboard (після magic link)
- **API:** http://localhost:3001
- **Demo landing (Meta):** http://localhost:3001/l/demo123
- **Demo shortlink (organic):** http://localhost:3001/r/organic-demo

#### Magic link (dev)

1. Відкрийте `/login`, введіть email
2. У dev-режимі посилання з’явиться на сторінці та в логах API
3. Після кліку — створення workspace на `/onboarding` (якщо перший вхід)

### 5. Тести

```bash
pnpm test
```

## Структура monorepo

```
apps/
  api/          # NestJS backend
  web/          # Next.js dashboard
packages/
  database/     # Prisma schema
  shared/       # Attribution engine, consent, crypto utils
```

## API Endpoints (MVP)

| Method | Path | Опис |
|--------|------|------|
| POST | `/api/auth/magic-link` | Запросити magic link |
| GET | `/api/auth/verify?token=` | Підтвердити вхід |
| GET | `/api/auth/me` | Поточний користувач + workspaces |
| GET | `/l/:slug` | Tracking + auto-redirect у Telegram (paid) |
| GET | `/r/:slug` | Tracking shortlink + redirect (organic) |
| GET | `/api/dashboard/campaigns` | Звіт: кліки / підписки / CR по кампаніях |
| GET | `/api/dashboard/tracking-links` | Звіт по tracking-посиланнях |
| POST | `/telegram/webhook` | Telegram Bot webhook |
| GET | `/api/dashboard/overview` | Метрики dashboard |
| POST | `/api/workspaces` | Створити workspace |
| POST | `/api/tracking-links` | Створити tracking link |
| POST | `/api/integrations/meta/test-event` | Meta CAPI test |
| POST | `/api/integrations/ga4/test-event` | GA4 test event |
| POST | `/api/privacy/data-deletion` | Запит на видалення |
| POST | `/api/retention/run` | Ручний запуск retention check |
| GET/POST | `/api/lead-magnets` | Lead magnet CRUD |

Передайте `x-workspace-id` header для workspace-scoped endpoints.

## Attribution Engine

Типи атрибуції:
- `EXACT_CLICK_INVITE` — invite link створений під конкретний click
- `CAMPAIGN_INVITE` — invite link прив'язаний до кампанії
- `PROBABILISTIC` — часове зіставлення
- `ORGANIC` — без рекламного кліку
- `UNKNOWN` — джерело невизначене

Рівні впевненості в UI: exact, high, medium, low, unknown.

## Retention (D1 / D7 / D30)

- BullMQ cron щогодини перевіряє підписників через `getChatMember`
- Оновлює `retainedD1/D7/D30` на профілі
- Для retained → `TG_Qualified_Subscribe_D1/D7/D30` у ConversionEvent → Meta/GA4

## Lead Magnet (opt-in)

1. Адмін створює lead magnet у `/lead-magnets`
2. Користувач відкриває `t.me/bot?start=lm_{slug}`
3. Бачить текст згоди → підписується на канал вручну
4. Надсилає **ПОГОДЖУЮСЬ** → перевірка підписки → матеріал + `LeadMagnet_Claimed` event

## Integrations

| Платформа | Статус |
|-----------|--------|
| Meta Pixel + CAPI | ✅ MVP |
| GA4 Measurement Protocol | ✅ MVP |
| Google Ads Offline Conversions | ✅ OAuth + UploadClickConversions |
| TikTok Events API | ✅ MVP |

## Compliance (UA)

- Privacy Policy, Terms of Service, Cookie Notice — `/privacy`, `/terms`, `/cookies`
- Consent log на кожен клік
- Data deletion / export requests
- Audit log
- IP hash only, encrypted tokens at rest

## Environment

Див. `.env.example`. Обов'язково змініть:
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `HASH_SALT`
- `TELEGRAM_BOT_TOKEN`

## License

Proprietary — ClearTG Analytics UA
