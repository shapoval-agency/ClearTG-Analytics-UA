#!/bin/sh
set -e

echo "Preparing database..."
cd /app/packages/database

for i in $(seq 1 30); do
  if npx prisma db push --skip-generate; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Database not reachable"
    exit 1
  fi
  echo "Waiting for database ($i/30)..."
  sleep 2
done

echo "Seeding demo data..."
npx tsx prisma/seed.ts || true

echo "Starting API on port ${API_PORT:-3001}..."
cd /app
exec node apps/api/dist/main.js
