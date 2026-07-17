#!/usr/bin/env bash
set -e

echo "==> Setting up NexusOS..."

# 1. Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env from .env.example"
else
  echo "    .env already exists, skipping"
fi
cp .env apps/api/.env
cp .env apps/web/.env.local

# 2. Install dependencies
echo "==> Installing dependencies..."
pnpm install

# 3. Start Docker services
echo "==> Starting PostgreSQL and Redis..."
docker compose up -d
sleep 3

# 4. Push database schema
echo "==> Syncing database schema..."
pnpm --filter @nexusos/database exec prisma db push

echo ""
echo "Setup complete! Now run:"
echo "  Terminal 1: node apps/api/dist/main.js  (or: pnpm --filter @nexusos/api build && node apps/api/dist/main.js)"
echo "  Terminal 2: PORT=3000 pnpm --filter @nexusos/web dev"
echo ""
echo "  API  -> http://localhost:4000"
echo "  Web  -> http://localhost:3000"
