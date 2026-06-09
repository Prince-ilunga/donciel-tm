#!/bin/bash
cd /home/z/my-project
bun install
bun run db:push
# Start the dev server and keep it running
while true; do
  node node_modules/.bin/next dev -p 3000
  echo "[$(date)] Server crashed, restarting in 3s..." >> /home/z/my-project/dev.log
  sleep 3
done
