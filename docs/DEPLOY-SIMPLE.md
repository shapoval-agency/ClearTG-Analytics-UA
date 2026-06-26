# Тільки Vercel (без Railway)

Поки бекенд не підключений — **кабінет на Vercel**, дані **у браузері** (localStorage).  
Один логін, без бази, без magic link, без Railway.

## Vercel

1. Repo → **Root Directory:** `apps/web`
2. **Environment Variables:**

| Variable | Value |
|----------|-------|
| `LOCAL_MODE` | `true` |
| `NEXT_PUBLIC_LOCAL_MODE` | `true` |
| `NEXT_PUBLIC_APP_URL` | `https://ваш-проект.vercel.app` |
| `LOCAL_LOGIN_EMAIL` | email адміна |
| `LOCAL_LOGIN_PASSWORD` | пароль |

**Нічого більше не потрібно** — без `API_INTERNAL_URL`, без Postgres.

3. Deploy → `/login` → увійти.

## Що працює зараз

- Вхід (email + пароль)
- Канали, кампанії, tracking-посилання — **зберігаються у вашому браузері**
- Meta Pixel / Token — теж у браузері
- URL для реклами: `https://ваш-vercel.vercel.app/l/xxxx` (збережеться, запрацює з беком)

## Що запрацює після підключення бека

- Кліки по `/l/` та `/r/`
- Telegram-бот і підписки
- Meta CAPI (тестові події)
- Реальна аналітика в «Огляд»

## Коли підключите бекенд

1. Підніміть API + Postgres (Railway, VPS, docker — як зручно)
2. У Vercel:
   - `LOCAL_MODE` → видалити або `false`
   - `NEXT_PUBLIC_LOCAL_MODE` → видалити
   - Додати `API_INTERNAL_URL` = URL вашого API
   - `NEXT_PUBLIC_API_URL` = URL Vercel (проксі)
3. На API: `STAGING_MODE=true`, ті самі `STAGING_LOGIN_EMAIL` / пароль
4. Redeploy Vercel

Дані з localStorage доведеться один раз завести в кабінеті знову (або зробимо імпорт пізніше).

## Локально

`apps/web/.env.local`:

```
LOCAL_MODE=true
NEXT_PUBLIC_LOCAL_MODE=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOCAL_LOGIN_EMAIL=test@cleartg.ua
LOCAL_LOGIN_PASSWORD=cleartg123
```

```bash
pnpm --filter @cleartg/web dev
```
