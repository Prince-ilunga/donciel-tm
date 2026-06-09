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
