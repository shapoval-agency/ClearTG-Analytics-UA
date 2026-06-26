# Тест для одного адміна: Vercel + Railway

Повноцінний продукт — реальна БД, бот, Meta, tracking-лінки. Один логін/пароль.

## Архітектура

| Сервіс | Де | Що |
|--------|-----|-----|
| Кабінет | **Vercel** (`apps/web`) | UI, проксі `/api`, `/l/`, `/r/` на Railway |
| API + бот | **Railway** (`Dockerfile.api`) | NestJS, Telegram webhook, tracking |
| Postgres | Railway plugin | Дані |
| Redis | Railway plugin | Черги |

## 1. Railway

1. New Project → Deploy from GitHub → репозиторій ClearTG
2. Додайте **PostgreSQL** і **Redis**
3. Сервіс API: Dockerfile `Dockerfile.api`, **Generate Domain** (напр. `https://xxx.up.railway.app`)
4. Variables (Raw Editor — **References**, не текст "PostgreSQL"):

```
DATABASE_URL          → ${{Postgres.DATABASE_URL}}
REDIS_URL             → ${{Redis.REDIS_URL}}
STAGING_MODE          = true
NODE_ENV              = staging
API_PORT              = 3001
JWT_SECRET            = <openssl rand -hex 32>
ENCRYPTION_KEY        = <openssl rand -hex 32>
HASH_SALT             = <openssl rand -hex 32>
STAGING_LOGIN_EMAIL   = boss@ваша-компанія.ua
STAGING_LOGIN_PASSWORD = ваш-надійний-пароль
NEXT_PUBLIC_APP_URL   = https://ваш-проект.vercel.app
TELEGRAM_BOT_TOKEN    = <від @BotFather>
TELEGRAM_BOT_USERNAME = ваш_бот
TELEGRAM_WEBHOOK_SECRET = <random>
TELEGRAM_WEBHOOK_URL  = https://xxx.up.railway.app/telegram/webhook
```

5. Після деплою перевірте: `https://xxx.up.railway.app/health`

При старті API сам робить `db push` + seed (користувач + workspace).

## 2. Vercel

1. Import repo, **Root Directory:** `apps/web`
2. Environment Variables:

```
API_INTERNAL_URL      = https://xxx.up.railway.app
NEXT_PUBLIC_APP_URL   = https://ваш-проект.vercel.app
NEXT_PUBLIC_API_URL   = https://ваш-проект.vercel.app
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = ваш_бот
```

`NEXT_PUBLIC_API_URL` = Vercel URL, бо `/l/` і `/api/` проксуються на Railway через rewrites.

3. Deploy → відкрийте `/login`

## 3. Вхід

Email і пароль з `STAGING_LOGIN_EMAIL` / `STAGING_LOGIN_PASSWORD` на Railway.

## 4. Перший тест (покроково)

1. **Увійти** в кабінет на Vercel
2. **Канали** → додати бота адміном у свій Telegram-канал → канал з'явиться в списку
3. **Кампанії** → створити кампанію Meta
4. **Посилання** → створити landing `/l/...` для Meta Ads
5. **Meta** → ввести Pixel ID + Access Token → «Тестова подія»
6. Вставити tracking URL у рекламу Meta, клікнути → підписатися на канал → перевірити **Огляд**

Tracking URL виглядає так: `https://ваш-проект.vercel.app/l/xxxxxxxxxx`

## 5. Telegram webhook

Після зміни `TELEGRAM_WEBHOOK_URL` перезапустіть деплой Railway. Webhook реєструється при старті API (якщо є токен).

## Локально

```bash
docker compose up -d
cp .env.example .env   # STAGING_MODE=true, TELEGRAM_BOT_TOKEN=...
pnpm install && pnpm db:push && pnpm --filter @cleartg/database exec tsx prisma/seed.ts
pnpm dev
```

Login: `test@cleartg.ua` / `cleartg123` (дефолт, якщо не задано STAGING_LOGIN_*)
