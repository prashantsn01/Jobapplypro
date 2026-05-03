#!/bin/sh
# server/scripts/start.sh
# Render runs this as the start command.
# 1. Applies any pending migrations (safe — idempotent)
# 2. Seeds portal shortcuts if DB is empty
# 3. Starts the Node server

set -e

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "🌱 Running seed (upsert — safe to re-run)..."
node prisma/seed.js || echo "⚠️  Seed failed (non-fatal)"

echo "🚀 Starting server..."
exec node index.js
