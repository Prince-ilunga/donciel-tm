---
Task ID: 1
Agent: Main Agent
Task: Fix user-requested bugs in EXÉCUTION DONCIEL, DONCIEL SETUP, and trade detail dialog

Work Log:
- Changed TOTAL_TRADES_TARGET from 500 to 300 in execution-tab.tsx
- Changed "Nombre de trades" display to just "N trades" format in setup-tab.tsx
- Added timing (session) filter to TradeVerificationList in setup-tab.tsx
- Fixed useMemo dependency issue (filters object → destructured values) to pass lint
- Fixed trade detail dialog (trade-detail-dialog.tsx) with multiple improvements:
  - Added proper error state with `error` useState
  - Made fetchTrade properly handle API errors (non-ok responses, invalid data)
  - Added DialogDescription components (with sr-only) to satisfy Radix UI requirements
  - Removed aria-describedby={undefined} in favor of proper DialogDescription
  - Added error UI with AlertTriangle icon and close button
  - Added setError(null) on dialog close and state reset

Stage Summary:
- 4 bugs fixed as requested by user
- All lint checks pass
- Dev server running on port 3000

---
Task ID: 2-5
Agent: Main Agent
Task: Fix SAISIE DES TRADES, DÉTAILS COMPLET D'UN TRADE, DISTRIBUTION RR, and VIDEOS DU SETUP

Work Log:

**Fix 2a: Calculator RR adjustment** (setup-tab.tsx)
- Added RR adjustment logic in `calculateAuto()` to match backend behavior:
  - When resultLabel is "LOSS" → rr = -1
  - When resultLabel is "BE" → rr = 0
  - When resultLabel is "WIN" → keeps calculated RR
  - When no exit price → shows raw RR (reward/risk)

**Fix 2b: Remove amountToWin field** (setup-tab.tsx + trade-detail-dialog.tsx)
- Removed `amountToWin` from TradeFormData interface
- Removed `amountToWin: ""` from initialFormData
- Removed `amountToWin` from handleSubmit tradeData object
- Removed amountToWin form input from the trade form dialog
- Removed Amount to Win card from Key Metrics section in trade-detail-dialog.tsx
- Removed amountToWin ParamCard from Price Parameters section in trade-detail-dialog.tsx
- Removed amountToWin from TradeDetail interface

**Fix 2c: Change screenshots from analysis to context/entry/exit** (setup-tab.tsx + trade-detail-dialog.tsx + i18n.ts)
- Renamed `analysisFile` → `contextFile` in TradeFormData and initialFormData
- Renamed `analysisRef` → `contextRef` useRef
- Changed upload type from "analysis" to "context" in handleSubmit
- Added screenshot upload section at end of form dialog with 3 upload buttons:
  - "Contexte" (context) with file preview thumbnail
  - "Entrée" (entry) with file preview thumbnail
  - "Sortie" (exit) with file preview thumbnail
  - Each has an X button to remove selected file
- Changed screenshot label display in trade-detail-dialog.tsx to handle both "context" and "analysis" types → displays "Contexte"
- Added `contextScreenshot` translation key to i18n.ts (fr: "Contexte", en: "Context")

**Fix 3a: Replace CSS variables with hex colors in charts** (trade-detail-dialog.tsx)
- Replaced `var(--color-profit, #22c55e)` with `#22c55e` in bar chart and line chart
- Replaced `var(--color-loss, #ef4444)` with `#ef4444` in bar chart
- Replaced `var(--color-gold, #eab308)` with `#eab308` in bar chart

**Fix 3b: Fix cumulative RR calculation** (trade-detail-dialog.tsx)
- Changed `totalCumulativeRR` from sum of ALL trades to cumulative RR up to and including the current trade
- Now iterates through sorted trades, accumulating RR, and stops when reaching the current trade's ID

**Fix 4: Update movingAverage20 translations** (i18n.ts)
- French: "Moyenne Mobile (20 Trades)" → "MOYENNE DE RR CUMULÉ DE (20 TRADES)"
- English: "Moving Average (20 Trades)" → "CUMULATIVE RR AVERAGE OF (20 TRADES)"

**Fix 5: Add Video button visibility** (videos-tab.tsx)
- Changed condition from `{isAdmin && (` to `{user && (` so the Add Video button is visible for all logged-in users, not just admins

Stage Summary:
- All 6 fixes applied across 4 files
- All lint checks pass
- Dev server running on port 3000
