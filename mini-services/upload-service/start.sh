#!/bin/bash
# Start the upload service and keep it running
cd "$(dirname "$0")"

# Kill any existing instance
pkill -f "upload-service/index.ts" 2>/dev/null
sleep 1

# Start the service with setsid to fully detach
setsid bun index.ts > /tmp/upload-service.log 2>&1 &

echo "Upload service started"
sleep 2

# Verify it's running
if curl -s http://localhost:3031/health > /dev/null 2>&1; then
  echo "✓ Upload service is healthy on port 3031"
else
  echo "✗ Upload service failed to start"
  cat /tmp/upload-service.log
fi
