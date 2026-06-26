# Тільки Vercel (без Railway)

Дані **у браузері**. Один логін. Без Postgres.

## Vercel — Environment Variables

| Variable | Приклад | НЕ так |
|----------|---------|--------|
| `LOCAL_LOGIN_EMAIL` | `boss@company.ua` | ~~email админа~~ |
| `LOCAL_LOGIN_PASSWORD` | `MySecretPass123` | ~~пароль~~ |

Опційно (автовключення і так спрацює, якщо немає `API_INTERNAL_URL`):

| Variable | Value |
|----------|-------|
| `LOCAL_MODE` | `true` |
| `NEXT_PUBLIC_APP_URL` | `https://clear-tg-analytics-ua-web.vercel.app` |

**Не додавайте** `API_INTERNAL_URL`, якщо бека ще немає.

У Vercel достатньо **двох** змінних (як на скріншоті):

- `LOCAL_LOGIN_EMAIL`
- `LOCAL_LOGIN_PASSWORD`

Обидві — для **Production** (і Preview за бажанням). Після зміни → **Redeploy**.

## Вхід

1. Відкрийте `/login`
2. Має бути текст: **«Вхід (дані зберігаються у браузері)»** — якщо «Вхід для тестування», зробіть redeploy
3. Email і пароль **точно як у Vercel** (регістр email не важливий)

## Помилка в консолі Chrome

`A listener indicated an asynchronous response...` — це **розширення браузера** (AdBlock, Meta Pixel Helper тощо), не наш сайт. Ігноруйте або спробуйте інкогніто.

## Локально

`apps/web/.env.local`:

```
LOCAL_LOGIN_EMAIL=boss@company.ua
LOCAL_LOGIN_PASSWORD=MySecretPass123
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
pnpm --filter @cleartg/web dev
```
