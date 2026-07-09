# ClearTG Analytics UA — Telegram-функціонал (UA-ринок)

**Версія:** 1.0  
**Фокус:** Україна — Meta, Google, TikTok, Telegram Ads. **Без** інтеграцій РФ (Яндекс, VK).

---

## Що реалізовано

### Telegram-бот (як у TGTrack)

| Функція | Статус |
|---------|--------|
| Головне меню (/start) | ✅ кнопки |
| Привʼязка кабінету | ✅ Налаштування → Telegram-бот |
| Звіт за вчора / 24 год | ✅ /report + кнопки |
| Щоденний звіт о 7:00 | ✅ в Telegram |
| Список каналів | ✅ /channels |
| Досьє по @username | ✅ |
| Досьє по пересланому повідомленню | ✅ |
| Авто-підключення каналу при додаванні бота | ✅ |
| /help, /cabinet, /menu | ✅ |

- Синхронізація каналу в **production** (`POST /api/channels/sync-telegram`) — @username або chat id
- Перевірка прав бота (`GET /api/channels/:id/bot-status`)
- Webhook + polling (локально)
- Підписки / відписки через `chat_member`
- Agency model: окремі кабінети клієнтів

### Атрибуція
- Tracking-links `/l/` (paid) та `/r/` (organic)
- Per-click invite → точна атрибуція (~98%)
- UTM + **postNumber** + **creativeTag** на посиланні
- Probabilistic / organic / unknown
- Подія **«Відкрив Telegram»** (`telegramOpenedAt` на кліку)

### Лендинги
- Серверний landing на `/l/` та `/r/`
- **Embed-скрипт** `cleartg.js` для Tilda, Taplink, WordPress
- Копіювання скрипта в кабінеті → Посилання

### Звіти
- Dashboard + retention D1/D7/D30
- **Щоденний звіт за вчора** на огляді
- **Досьє підписника** `/subscribers/:id`
- **Експорт CSV** учасників
- Звіти по джерелах, підписках, pixel delivery

### Рекламні інтеграції (UA)
| Платформа | Статус |
|-----------|--------|
| Meta CAPI | ✅ |
| Google Ads | ✅ |
| GA4 | ✅ |
| TikTok Events API | ✅ |
| Telegram Ads (мітки) | ✅ enum + shortlink |
| Яндекс / VK | ❌ навмисно (не UA-пріоритет) |

### Маркетингові налаштування
- **Затримка конверсії** (`conversionDelayMinutes` на кампанії) — не відправляти в рекламу, якщо відписався швидко
- Lead magnets з перевіркою підписки
- Consent / GDPR (хеш IP, external_id)

---

## Що залишилось на наступні етапи

| Модуль | Пріоритет |
|--------|-----------|
| Головний бот з меню (як TGTrack) | Середній |
| Пул агент-ботів | Низький |
| Групи, лички, Telegram Business | Низький |
| API для чужих ботів клієнта | Середній |
| Deep goals | Середній |
| Автоприйом у закритий канал | Середній |
| Email щоденний digest | Низький |
| ROMI / продажі | Низький |

---

## Ключові env (UA deploy)

```env
# Vercel
API_INTERNAL_URL=https://api.railway.app
NEXT_PUBLIC_APP_URL=https://xxx.vercel.app
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YourBot

# Railway
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=https://xxx.vercel.app/telegram/webhook
AGENCY_ADMIN_EMAIL=agency@company.ua
STAGING_MODE=true  # для тестового логіну
```

---

## Embed-скрипт (приклад)

```html
<script src="https://ваш-домен.vercel.app/cleartg.js"
  data-slug="abc123xyz"
  data-app-url="https://ваш-домен.vercel.app"
  defer></script>
```

Усі посилання `t.me/...` на сторінці ведуть через `/l/{slug}` з UTM з URL лендингу.

---

## Позиціонування

**ClearTG Analytics UA** — платформа атрибуції Telegram-реклами для України:  
**клік → відкриття Telegram → підписка → утримання → конверсія в Meta/Google/TikTok**.

Не «бот статистики», а інструмент для агентств і власників каналів, які оптимізують рекламу по **якості підписників**, а не по кліках.
