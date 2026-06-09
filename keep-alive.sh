#!/bin/bash
while true; do
  echo "[$(date)] Starting server..." >> /home/z/my-project/server-watchdog.log
  npx next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE" >> /home/z/my-project/server-watchdog.log
  sleep 3
done
