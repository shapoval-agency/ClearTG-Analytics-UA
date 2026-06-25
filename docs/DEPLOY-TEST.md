# Тестовый выкат для начальника (15 минут)

Один сервер, одна команда. Postgres и Redis поднимаются сами — думать о них не нужно.

## Что получится

| URL | Для чего |
|-----|----------|
| `http://ВАШ_IP:3000` | Кабинет (логин, кампании, ссылки, Meta) |
| `http://ВАШ_IP:3001/l/demo123` | Тестовая tracking-ссылка для рекламы |

**Логин:** любой email → на странице сразу появится **ссылка для входа** (SMTP не нужен, включён `STAGING_MODE`).

---

## Шаг 1 — Сервер

Подойдёт любой VPS с Docker (Hetzner CX22, DigitalOcean, Timeweb и т.д.):

- Ubuntu 22/24
- 2 GB RAM
- Открыты порты **3000** и **3001** в firewall

На сервере:

```bash
curl -fsSL https://get.docker.com | sh
```

---

## Шаг 2 — Залить код

```bash
git clone <ваш-репозиторий> cleartg
cd cleartg
cp .env.staging.example .env.staging
```

Отредактируйте `.env.staging` — **обязательно**:

```env
# Замените на публичный IP сервера
NEXT_PUBLIC_APP_URL=http://185.12.34.56:3000
NEXT_PUBLIC_API_URL=http://185.12.34.56:3001

JWT_SECRET=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 32>
HASH_SALT=<openssl rand -hex 32>

TELEGRAM_BOT_TOKEN=<от @BotFather>
TELEGRAM_BOT_USERNAME=ваш_бот
TELEGRAM_WEBHOOK_SECRET=<любая случайная строка>
TELEGRAM_WEBHOOK_URL=http://185.12.34.56:3001/telegram/webhook

STAGING_MODE=true
```

---

## Шаг 3 — Запуск

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

Первый раз сборка ~5–10 минут. Потом:

```bash
docker compose -f docker-compose.staging.yml logs -f api
```

Ждём строку `ClearTG API running on port 3001`.

---

## Шаг 4 — Telegram webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=http://185.12.34.56:3001/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

> Telegram принимает webhook только по **HTTPS**. Если бот не видит подписки — используйте Cloudflare Tunnel (шаг 5b) или домен с SSL.

---

## Шаг 5 — Начальник заходит

1. Открыть `http://ВАШ_IP:3000/login`
2. Ввести свой email (например `boss@company.ua`)
3. Нажать ссылку **на той же странице** (staging mode)
4. Создать workspace или использовать demo после seed
5. В кабинете: **Каналы** → **Кампании** → **Посилання** → **Integrations → Meta**

Демо-ссылки после seed:

- Paid: `http://ВАШ_IP:3001/l/demo123`
- Organic: `http://ВАШ_IP:3001/r/organic-demo`

---

## Шаг 5b — HTTPS без домена (Cloudflare Tunnel)

Если нужен webhook и нормальные cookies:

```bash
# на сервере
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared

./cloudflared tunnel --url http://localhost:3000   # кабинет
./cloudflared tunnel --url http://localhost:3001   # API (второй терминал)
```

Обновите `.env.staging` на выданные `https://....trycloudflare.com` URL и пересоберите **только web**:

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build web api
```

---

## Шаг 6 — Бот в канале

1. Создать тестовый Telegram-канал
2. Добавить бота **администратором** (право видеть участников)
3. В кабинете привязать канал (или обновить demo-канал на реальный chat id)

---

## Полезные команды

```bash
# логи
docker compose -f docker-compose.staging.yml logs -f

# перезапуск
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build

# остановить
docker compose -f docker-compose.staging.yml down

# снести данные и начать заново
docker compose -f docker-compose.staging.yml down -v
```

---

## Что тестирует начальник

- [ ] Вход в кабинет по magic link
- [ ] Создание кампании Meta
- [ ] Копирование `/l/...` ссылки в объявление
- [ ] Клик по ссылке → переход в Telegram
- [ ] Подписка на канал → цифра в отчётах
- [ ] Meta pixel + test event в Integrations

---

## Когда пойдёте в прод

Тот же код, но:

- домен + SSL (Caddy/nginx)
- `STAGING_MODE=false` + SMTP для писем
- managed Postgres (Neon/Railway) вместо docker volume
- отдельный домен для трекинга (`t.yourdomain.com`)

Сейчас для внутреннего теста **этого compose достаточно**.
