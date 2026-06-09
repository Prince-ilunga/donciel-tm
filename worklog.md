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
