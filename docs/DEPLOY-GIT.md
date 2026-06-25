# Деплой без Docker на компе: GitHub → Vercel + Railway

**Только Vercel — не взлетит.** Кабинет на Vercel, API + база + Redis на Railway.  
Docker на твоём Mac **не нужен** — Railway сам соберёт образ из Git.

В итоге у начальника **один адрес**: `https://ваш-проект.vercel.app`

---

## Схема

```
Начальник → https://xxx.vercel.app
                 ├── /login, /dashboard     (Vercel)
                 ├── /l/slug, /r/slug       (прокси → Railway)
                 └── /api/...               (прокси → Railway)
                                          ↓
                                    Railway API
                                    Postgres + Redis
```

---

## Шаг 1 — GitHub

```bash
cd cleartg
git init
git add .
git commit -m "staging deploy"
git remote add origin https://github.com/ВАШ_АККАУНТ/cleartg-analytics.git
git push -u origin main
```

---

## Шаг 2 — Railway (API + база) ~10 мин

1. [railway.app](https://railway.app) → Login with GitHub  
2. **New Project** → **Deploy from GitHub repo** → выбрать репозиторий  
3. Railway создаст сервис из `Dockerfile.api` (файл `railway.toml` уже в репо)  
4. **+ New** → **Database** → **PostgreSQL**  
5. **+ New** → **Database** → **Redis**  
6. Открыть сервис **API** → **Variables** → **Add Reference**:
   - `DATABASE_URL` ← Postgres
   - `REDIS_URL` ← Redis  
7. Добавить переменные вручную (секреты: `openssl rand -hex 32`):

```env
NODE_ENV=staging
STAGING_MODE=true
API_PORT=3001

JWT_SECRET=...
ENCRYPTION_KEY=...
HASH_SALT=...

TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=ваш_бот
TELEGRAM_WEBHOOK_SECRET=случайная_строка

# Пока оставьте пустым — подставите после Vercel (шаг 3)
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_URL=
TELEGRAM_WEBHOOK_URL=
```

8. **Settings** → **Networking** → **Generate Domain**  
   Скопируйте URL, например: `https://cleartg-api-production.up.railway.app`

9. Дождаться деплоя (логи: `ClearTG API running on port 3001`)

---

## Шаг 3 — Vercel (кабинет) ~5 мин

1. [vercel.com](https://vercel.com) → Login with GitHub  
2. **Add New Project** → импорт того же репозитория  
3. **Root Directory** → `apps/web` → Continue  
   (если Root не задан — сработает `vercel.json` в корне репо)  
4. **Build Command**: `pnpm --filter @cleartg/web build`  
   **НЕ** `pnpm run build` — он собирает API и падает на Prisma  
5. **Environment Variables**:

```env
NEXT_PUBLIC_APP_URL=https://ВАШ-ПРОЕКТ.vercel.app
NEXT_PUBLIC_API_URL=https://ВАШ-ПРОЕКТ.vercel.app
API_INTERNAL_URL=https://cleartg-api-production.up.railway.app

NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=ваш_бот
```

> `API_INTERNAL_URL` — приватный URL Railway. Vercel проксирует `/api`, `/l`, `/r` на него.

5. **Deploy**

6. После деплоя скопируйте реальный Vercel URL и **вернитесь в Railway** → обновите:

```env
NEXT_PUBLIC_APP_URL=https://ваш-проект.vercel.app
NEXT_PUBLIC_API_URL=https://ваш-проект.vercel.app
TELEGRAM_WEBHOOK_URL=https://ваш-проект.vercel.app/telegram/webhook
```

Railway перезапустит API автоматически.

---

## Шаг 4 — Telegram webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://ваш-проект.vercel.app/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

---

## Шаг 5 — Начальник

1. Открыть `https://ваш-проект.vercel.app/login`  
2. Ввести email → **ссылка появится на странице** (`STAGING_MODE`)  
3. Настроить канал, кампании, ссылки, Meta  

**Tracking-ссылка для рекламы** (тот же домен):

```
https://ваш-проект.vercel.app/l/demo123
```

---

## Стоимость

| Сервис | Тест |
|--------|------|
| Vercel | Бесплатно (hobby) |
| Railway | ~$5 кредитов/мес на старте, потом ~$5–10/мес |
| Домен | Не обязателен |

---

## Если что-то не работает

| Симптом | Решение |
|---------|---------|
| Логин — ошибка сети | Проверить `API_INTERNAL_URL` на Vercel |
| Magic link не открывается | В Railway: `NEXT_PUBLIC_APP_URL` = Vercel URL |
| `/l/...` 404 | Railway API не запущен или неверный `API_INTERNAL_URL` |
| Подписки не считаются | Webhook + бот админ в канале |
| CORS | `NEXT_PUBLIC_APP_URL` на Railway = Vercel URL |

Логи Railway: сервис API → **Deployments** → **View logs**

---

## Почему не «только Vercel»

| Компонент | Vercel | Нужно |
|-----------|--------|-------|
| Next.js кабинет | ✅ | ✅ |
| NestJS API 24/7 | ❌ serverless | Railway |
| Postgres | ❌ | Railway Postgres |
| Redis / очереди CAPI | ❌ | Railway Redis |
| Telegram webhook | ⚠️ только через прокси | Railway + rewrite |

Когда тест пройдёт — можно перенести Postgres на Neon, API оставить на Railway, домен прикрутить к Vercel.
