#!/bin/bash
cd /home/z/my-project

# Set Neon PostgreSQL URL (overriding SQLite default)
export DATABASE_URL="postgresql://neondb_owner:npg_9oxIirae7DMG@ep-round-unit-as5bgjj8-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"
echo "DATABASE_URL=$DATABASE_URL" > .env

bun install
bun run db:push
# Start the dev server and keep it running
while true; do
  node node_modules/.bin/next dev -p 3000
  echo "[$(date)] Server crashed, restarting in 3s..." >> /home/z/my-project/dev.log
  sleep 3
done
