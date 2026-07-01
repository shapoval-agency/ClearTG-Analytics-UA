# ТЗ: Підключення БД та бекенду (ClearTG Analytics UA)

**Версія:** 1.1  
**Дата:** 2026-06-24  
**Статус:** Готово до впровадження  

---

## 1. Мета

Підключити **production/staging бекенд** (`apps/api`) до постійної **PostgreSQL** та **Redis**, щоб:

- зберігати канали, підписників, відписки, атрибуцію, кліки;
- працював Telegram-бот (webhook у проді, polling — лише локально);
- кабінет на Vercel отримував реальні дані через API (не `LOCAL_MODE`).

**Локально вже працює:** Postgres + Redis (Homebrew), `DATABASE_URL` у `.env`, polling бота.

---

## 2. Архітектура

```
Користувач → Vercel (apps/web)
                 │  /api/*, /l/*, /r/*, /telegram/webhook
                 ▼  (API_INTERNAL_URL)
            Railway / VPS (apps/api)
                 ├── PostgreSQL  ← основні дані (Prisma)
                 └── Redis       ← черги (BullMQ: CAPI, retention)
```

| Компонент | Технологія | Обовʼязковість |
|-----------|------------|----------------|
| API | NestJS + Fastify, порт `3001` | Так |
| БД | PostgreSQL 16, Prisma | Так |
| Черги | Redis 7, BullMQ | Так (доставка в Meta/Google; без Redis API стартує, але черги впадуть) |
| Web | Next.js на Vercel | Окремо (не в цьому ТЗ) |

---

## 3. Що зберігається в PostgreSQL

Схема: `packages/database/prisma/schema.prisma` (~30 таблиць).

**Критичні для поточного MVP:**

| Група | Таблиці | Призначення |
|-------|---------|-------------|
| Auth | `users`, `magic_link_tokens`, `workspace_members` | Вхід, workspace |
| Telegram | `channels`, `membership_events`, `subscriber_profiles`, `unsubscribe_events` | Канали, підписки/відписки |
| Аналітика | `tracking_links`, `click_events`, `attributions`, `invite_links` | Джерела, кліки |
| Інтеграції | `meta_integrations`, `conversion_events`, … | CAPI (пізніше) |

**Міграції:** зараз використовується `prisma db push` (немає папки `migrations/`). При деплої Docker entrypoint сам накочує схему.

---

## 4. Змінні оточення (бекенд)

### 4.1. Обовʼязкові

| Змінна | Приклад | Опис |
|--------|---------|------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/cleartg?schema=public` | Postgres. Для Railway часто додати `&sslmode=require` |
| `REDIS_URL` | `redis://default:pass@host:6379` | Redis для BullMQ |
| `JWT_SECRET` | `openssl rand -hex 32` | Сесії API |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | Шифрування токенів інтеграцій |
| `HASH_SALT` | `openssl rand -hex 32` | Hash external_id для Meta |
| `TELEGRAM_BOT_TOKEN` | від @BotFather | Бот |
| `TELEGRAM_BOT_USERNAME` | `TimeKairos_bot` | Без `@` |
| `TELEGRAM_WEBHOOK_SECRET` | випадковий рядок | Перевірка webhook |
| `TELEGRAM_WEBHOOK_URL` | `https://домен/telegram/webhook` | Публічний HTTPS |
| `NODE_ENV` | `staging` / `production` | |
| `API_PORT` | `3001` | |

### 4.2. Для staging / тесту

| Змінна | Значення |
|--------|----------|
| `STAGING_MODE` | `true` |
| `STAGING_LOGIN_EMAIL` | email тестового адміна |
| `STAGING_LOGIN_PASSWORD` | пароль для `/login` |
| `AGENCY_ADMIN_EMAIL` | email оператора агентства (доступ ADMIN до всіх кабінетів клієнтів) |
| `TELEGRAM_USE_POLLING` | `true` — **тільки локально**. На Railway: `false` або не задавати |

### 4.3. CORS і посилання (після Vercel)

| Змінна | Приклад |
|--------|---------|
| `NEXT_PUBLIC_APP_URL` | `https://xxx.vercel.app` |
| `NEXT_PUBLIC_API_URL` | той самий (для CORS) |

### 4.4. Де задавати

| Середовище | Файл / місце |
|------------|----------------|
| Локально | `.env`, `apps/api/.env` (синхронізувати) |
| Docker staging | `.env.staging` + `docker-compose.staging.yml` |
| Railway | Variables сервісу API + Reference на Postgres/Redis |

---

## 5. Варіанти підключення БД

### Варіант A — Railway (рекомендовано для швидкого старту)

Вже описано в `docs/DEPLOY-GIT.md`.

1. Railway → New Project → GitHub repo  
2. **+ PostgreSQL**, **+ Redis**  
3. Сервіс API з `Dockerfile.api` / `railway.toml`  
4. `DATABASE_URL` ← Reference Postgres  
5. `REDIS_URL` ← Reference Redis  
6. Решта секретів — вручну  
7. Generate Domain → підставити в Vercel `API_INTERNAL_URL` і `TELEGRAM_WEBHOOK_URL`

**Плюси:** мінімум DevOps, автодеплой з Git.  
**Мінуси:** вартість, залежність від платформи.

### Варіант B — VPS + Docker Compose

Файл `docker-compose.staging.yml` — готовий шаблон (Postgres + Redis + API + Web).

```bash
cp .env.staging.example .env.staging
# заповнити секрети
pnpm staging:up
```

**Плюси:** повний контроль, одна машина.  
**Мінуси:** SSL, бекапи, оновлення — на вас.

### Варіант C — Локально (вже є)

```bash
# Postgres + Redis (Homebrew або docker compose up)
pnpm db:push    # схема
pnpm db:seed    # test@cleartg.ua (OWNER) + agency@cleartg.ua (ADMIN) + workspace main
pnpm dev        # API + Web
```

`DATABASE_URL=postgresql://cleartg:cleartg_dev@localhost:5432/cleartg?schema=public`

---

## 6. Процедура першого підключення (production/staging)

### 6.1. Створити БД

- Postgres 16+, база `cleartg`, користувач з правами `CREATE` на схему `public`.
- Redis 7+ без кластера (один інстанс достатньо для MVP).

### 6.2. Застосувати схему

**Автоматично (Docker/Railway):** `scripts/entrypoint-api.sh` виконує:

```bash
npx prisma db push --skip-generate   # до 30 спроб з паузою
npx tsx prisma/seed.ts               # мінімальний seed
node apps/api/dist/main.js
```

**Вручну (з ноутбука до віддаленої БД):**

```bash
cd packages/database
DATABASE_URL="postgresql://..." npx prisma db push
DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts
```

### 6.3. Перевірити підключення

```bash
curl https://ВАШ-API/health
# {"status":"ok","telegramBot":true,...}

# Staging login
curl -X POST https://ВАШ-API/api/auth/staging-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@cleartg.ua","password":"..."}'
```

### 6.4. Telegram

| Режим | Коли | Дія |
|-------|------|-----|
| Polling | Локально, `TELEGRAM_USE_POLLING=true` | Webhook не потрібен |
| Webhook | Railway/Vercel | `setWebhook` на `https://домен/telegram/webhook` |

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<домен>/telegram/webhook&secret_token=<SECRET>"
```

### 6.5. Звʼязок з Vercel

У Vercel ( `apps/web` ):

```env
API_INTERNAL_URL=https://ваш-api.railway.app
NEXT_PUBLIC_APP_URL=https://ваш-проект.vercel.app
NEXT_PUBLIC_API_URL=https://ваш-проект.vercel.app
```

Без `API_INTERNAL_URL` кабінет піде в `LOCAL_MODE` (дані в браузері).

---

## 7. Безпека та експлуатація

| Вимога | Рішення |
|--------|---------|
| Секрети не в Git | `.env*` у `.gitignore` |
| TLS до Postgres | `sslmode=require` (Railway/Neon/Supabase) |
| Бекапи Postgres | Railway: автобекапи; VPS: `pg_dump` cron |
| Ротація `JWT_SECRET` | Скине всі сесії — планувати |
| Доступ до БД | Тільки з API-сервісу, не публічний порт |

**Рекомендація на майбутнє:** перейти з `db push` на `prisma migrate deploy` для контрольованих змін схеми.

---

## 8. Критерії приймання (чеклист)

- [ ] `GET /health` → `status: ok`, `telegramBot: true`
- [ ] `pnpm db:studio` або SQL: таблиці `channels`, `subscriber_profiles` існують
- [ ] Вхід у кабінет (`STAGING_MODE` або magic link)
- [ ] Канал зʼявляється в **Канали** після додавання бота адміном
- [ ] Підписка/відписка в Telegram → **Учасники** оновлюються
- [ ] `GET /api/dashboard/subscribers` з авторизацією повертає JSON
- [ ] Redis: черга conversion не падає при старті API (логи без `ECONNREFUSED` на 6379)
- [ ] Після рестарту API дані зберігаються (перевірка Postgres, не in-memory)

---

## 9. Оцінка трудозатрат

| Етап | Час | Хто |
|------|-----|-----|
| Railway: Postgres + Redis + API | 1–2 год | DevOps / розробник |
| Vercel env + redeploy | 30 хв | |
| Webhook Telegram | 15 хв | |
| Smoke-тест (канал, підписка, відписка) | 30 хв | |
| **Разом** | **~3–4 год** | |

Локальне підключення БД **вже виконано** — залишається перенести те саме на хостинг.

---

## 10. Ризики

| Ризик | Мітигація |
|-------|-----------|
| `db push` змінює схему без історії | Зробити бекап перед деплоєм; потім `migrate` |
| Два API з різними `.env` | Один інстанс на Railway; локально — один `pnpm dev` |
| Бот на polling + webhook одночасно | На проді: `TELEGRAM_USE_POLLING=false`, один webhook |
| Пустий `API_INTERNAL_URL` на Vercel | Кабінет у fake LOCAL_MODE — перевірити env |

---

## 11. Повʼязані документи

- `docs/DEPLOY-GIT.md` — покроковий Railway + Vercel  
- `docs/DEPLOY-SIMPLE.md` — лише Vercel без бека (не для продакшену з ботом)  
- `docs/REVERSE-ENGINEERING.md` — логіка продукту  
- `.env.example` — повний список змінних  
- `docker-compose.yml` / `docker-compose.staging.yml` — локально / VPS  

---

## 12. Наступний крок (рішення замовника)

Обрати варіант хостингу:

1. **Railway** — швидко, вже підготовлений `Dockerfile.api`  
2. **VPS + docker-compose.staging** — якщо є свій сервер  
3. **Залишитись локально** — тільки для розробки, не для клієнта  

Після вибору — виконати чеклист з розділу 8.

---

## 13. Мульти-тенант: модель агентства

### 13.1. Концепція

Один оператор агентства керує **кількома кабінетами клієнтів**. Кожен клієнт — окремий `workspace` з повною ізоляцією даних (канали, підписники, кампанії).

| Роль у workspace | Хто | Права |
|------------------|-----|-------|
| **OWNER** | Клієнт (власник бізнесу) | Повний доступ, запрошення команди |
| **ADMIN** | Агентство (`AGENCY_ADMIN_EMAIL`) | Те саме, що OWNER для операційної роботи |
| **MEMBER** | Співробітник клієнта | Редагування |
| **VIEWER** | Аналітик | Лише перегляд |

Один `User` може бути учасником **кількох** workspace (наприклад, агентство — ADMIN у 5 клієнтів).

### 13.2. Потік онбордингу клієнта

```
1. Агентство логіниться (AGENCY_ADMIN_EMAIL + STAGING_LOGIN_PASSWORD у staging)
2. /agency/clients → «Створити кабінет»
   POST /api/agency/clients { name, ownerEmail }
3. API створює:
   - workspace (новий slug)
   - User(ownerEmail) → OWNER
   - Agency user → ADMIN
4. Клієнт отримує magic link на ownerEmail (prod) або staging-login (якщо email у STAGING_LOGIN_EMAIL)
5. Агентство перемикає кабінет у sidebar (cookie cleartg_workspace)
6. Додає бота в канал клієнта → дані пишуться в workspace клієнта
```

### 13.3. API (нові ендпоінти)

| Метод | Шлях | Опис | Workspace header |
|-------|------|------|------------------|
| `GET` | `/api/agency/clients` | Список кабінетів (де user = ADMIN) | Ні |
| `POST` | `/api/agency/clients` | Створити кабінет клієнта | Ні |
| `GET` | `/api/workspaces/current/members` | Учасники поточного кабінету | Так (`x-workspace-id`) |
| `POST` | `/api/workspaces/current/members` | Запросити учасника | Так |

`GET /api/auth/me` повертає `isAgencyAdmin: boolean` та масив `workspaces` з ролями.

### 13.4. Змінні оточення (агентство)

| Змінна | Приклад | Опис |
|--------|---------|------|
| `AGENCY_ADMIN_EMAIL` | `agency@cleartg.ua` | Email оператора; лише цей user може `POST /api/agency/clients` |

У staging той самий `STAGING_LOGIN_PASSWORD` для `AGENCY_ADMIN_EMAIL` і `STAGING_LOGIN_EMAIL`.

### 13.5. UI

| Сторінка | Призначення |
|----------|-------------|
| `/agency/clients` | Список клієнтів + форма створення (тільки `isAgencyAdmin`) |
| Sidebar switcher | Перемикання між workspace (cookie `cleartg_workspace`) |
| `/settings/team` | Список учасників + запрошення (OWNER/ADMIN) |

### 13.6. Seed (локально)

```bash
pnpm db:seed
```

Створює:

- `test@cleartg.ua` — OWNER workspace `main`
- `agency@cleartg.ua` — ADMIN того ж workspace
- Пароль staging для обох: `STAGING_LOGIN_PASSWORD`

### 13.7. Критерії приймання (агентство)

- [ ] Логін `agency@cleartg.ua` → пункт меню «Клієнти агентства»
- [ ] Створення нового кабінету → зʼявляється в списку і в switcher
- [ ] Перемикання кабінету → dashboard показує дані обраного workspace
- [ ] Клієнт (`OWNER`) не бачить `/agency/clients`
- [ ] `POST /api/agency/clients` від не-агентства → 403

### 13.8. Обмеження MVP

- Один глобальний Telegram-бот (`TELEGRAM_BOT_TOKEN`) на всі workspace
- Немає окремого бота на клієнта (схема `TelegramBotConnection` — на майбутнє)
- Auto-register каналу в STAGING привʼязує до workspace staging-користувача — при кількох клієнтах краще синхронізувати канал вручну з обраного кабінету
