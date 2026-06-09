---
Task ID: 1
Agent: main
Task: Fix RR PAR TRADE and CUMULE RR ISOLÉ charts placement, data, and titles + Fix screenshots not appearing in trade detail dialog

Work Log:
- Explored codebase to find chart and screenshot code locations
- Analyzed user screenshot with VLM to identify actual issues (charts showing "Aucune donnée", no screenshots visible)
- Found root cause for charts: `useTrades()` hook never called `refetchTrades()` in dialog, so `allTrades` was always empty
- Found CUMULÉ ISOLÉ chart was using last 10 trades data instead of cumulative RR from first trade to current trade
- Fixed i18n key from `cumuleIsole` to `cumuleRRIsole` with new French title "CUMULE RR ISOLÉ"
- Fixed CUMULE RR ISOLÉ chart to show "depuis le premier trade" instead of "10 derniers trades" badge
- Fixed CUMULE RR ISOLÉ data computation to show cumulative RR from first trade up to current trade
- Added `refetchTrades()` call when dialog opens to populate `allTrades` for chart data
- Fixed screenshot `onError` handler to show placeholder icon instead of hiding broken images
- Added `resolveScreenshotUrl` helper for cleaner URL resolution
- Fixed `/api/screenshots/[filename]` route to check local filesystem FIRST before redirecting to Cloudinary
- This fixes the case where screenshots were stored locally before Cloudinary was configured

Stage Summary:
- trade-detail-dialog.tsx: Fixed chart data loading, renamed CUMULE RR ISOLÉ, fixed screenshot error handling
- i18n.ts: Changed `cumuleIsole` → `cumuleRRIsole` (French: "CUMULE RR ISOLÉ", English: "ISOLATED CUMULATIVE RR")
- /api/screenshots/[filename]/route.ts: Check local files before Cloudinary redirect
---
Task ID: 1
Agent: Main
Task: Fix Cloudinary screenshot/video upload and display pipeline

Work Log:
- Traced complete upload pipeline: setup-tab → POST /api/trades → POST /api/upload → Cloudinary/local → DB Screenshot record → GET /api/trades/{id} → trade-detail-dialog
- Found root cause: Cloudinary env vars (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are NOT configured, causing fallback to local filesystem which doesn't work on Vercel
- Found secondary issue: File inputs only accepted images (accept="image/*"), no video support
- Found secondary issue: Screenshot viewer only rendered <img>, not <video> for video files
- Found secondary issue: No clear error message when Cloudinary is not configured on Vercel

Fixes Applied:
1. src/app/api/upload/route.ts - Added Vercel detection + clear error when Cloudinary not configured; Added proper content type detection for videos
2. src/components/shared/trade-detail-dialog.tsx - Added isVideoUrl() helper; Render <video> for video URLs; Updated section title to "Captures & Vidéos"
3. src/components/journal/journal-tab.tsx - Same video support as trade-detail-dialog
4. src/components/shared/screenshot-viewer.tsx - Added video playback support in fullscreen viewer
5. src/components/setup/setup-tab.tsx - Changed accept="image/*" to accept="image/*,video/*"; Added video preview in form
6. src/app/api/screenshots/[filename]/route.ts - Added video content types and proper Cloudinary video URL redirect
7. src/app/api/videos/stream/route.ts - Added local filesystem support with range requests; Added Cloudinary redirect fallback
8. .env - Added Cloudinary env var template with instructions

Stage Summary:
- All code fixes are complete and lint-clean
- User MUST configure Cloudinary env vars on Vercel for screenshots/videos to persist
- Without Cloudinary on Vercel, uploads will now return a clear 503 error instead of silently failing
- Video support is now complete end-to-end: upload → Cloudinary → display → fullscreen viewer
