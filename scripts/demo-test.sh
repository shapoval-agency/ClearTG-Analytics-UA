#!/usr/bin/env bash
# Демо-тест ClearTG Analytics UA (модель tgtrack)
# Запуск: bash scripts/demo-test.sh

set -euo pipefail
API="${API_URL:-http://localhost:3001}"
DB="${DATABASE_URL:-postgresql://cleartg:cleartg_dev@localhost:5432/cleartg}"

echo "══════════════════════════════════════════"
echo " ClearTG Demo Test"
echo " API: $API"
echo "══════════════════════════════════════════"

echo ""
echo "1) Health check"
curl -sS "$API/health" | head -c 200
echo ""

echo ""
echo "2) Симуляція кліку з Meta (UTM + fbclid)"
curl -sS -D - "$API/l/demo123?utm_source=meta&utm_campaign=summer2025&fbclid=DEMO_FBCLID_$(date +%s)" -o /dev/null | grep -iE '^(HTTP|location)' || true

echo ""
echo "3) Симуляція organic shortlink"
curl -sS -D - "$API/r/organic-demo?utm_source=influencer" -o /dev/null | grep -iE '^(HTTP|location)' || true

echo ""
echo "4) Останні кліки в БД"
psql "$DB" -c "SELECT utm_source, utm_campaign, fbclid, to_char(clicked_at, 'HH24:MI:SS') AS time FROM click_events ORDER BY clicked_at DESC LIMIT 5;"

echo ""
echo "5) Налаштування tracking-посилань"
psql "$DB" -c "SELECT slug, link_mode, auto_redirect, destination_mode FROM tracking_links;"

echo ""
echo "6) Звіт по кампаніях (кліки → підписки → CR)"
psql "$DB" -c "
SELECT c.name,
  (SELECT COUNT(*) FROM click_events ce WHERE ce.campaign_id = c.id) AS clicks,
  (SELECT COUNT(*) FROM attributions a WHERE a.campaign_id = c.id) AS subscribers,
  ROUND(
    (SELECT COUNT(*)::numeric FROM attributions a WHERE a.campaign_id = c.id) /
    NULLIF((SELECT COUNT(*) FROM click_events ce WHERE ce.campaign_id = c.id), 0) * 100, 1
  ) AS cr_percent
FROM campaigns c;
"

echo ""
echo "7) Invite links (потрібен TELEGRAM_BOT_TOKEN + бот-адмін каналу)"
psql "$DB" -c "SELECT COUNT(*) AS invite_links FROM invite_links;"

echo ""
echo "══════════════════════════════════════════"
echo " Відкрий у браузері: $API/l/demo123"
echo " Звіти (після логіну): http://localhost:3000/reports/sources"
echo "══════════════════════════════════════════"
