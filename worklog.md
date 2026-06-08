---
Task ID: 1
Agent: Main Agent
Task: Implement DONCIEL application updates - EXÉCUTION DONCIEL tab, SETUP tab, trade detail charts, new trade fields

Work Log:
- Updated Prisma schema with new Trade fields: structure (HAUSSIÈRE/BAISSIÈRE/RANGE), entryModel (ANGLOBANTE/LOT À 3 BOUGIES/MARKET SHIFT), amountToWin
- Ran db:push to sync database schema
- Added comprehensive i18n translations for FR and EN (new navigation keys, setup tab keys, trade field keys, chart labels)
- Updated Zustand store: added 'execution' and 'setup' to TabId type, changed default tab to 'execution'
- Updated hooks.ts: added structure, entryModel, amountToWin to Trade interface
- Updated API routes (POST and PUT) to handle new trade fields (structure, entryModel, amountToWin)
- Created EXÉCUTION DONCIEL tab (execution-tab.tsx): progression tracking with 8 cycles, Phase Initiale, Phase 1 (4×25), Phase 2 (4×50), metrics cards
- Created SETUP tab (setup-tab.tsx): DONCIEL SETUP and SETUP PERSONNALISÉ cards, sub-interfaces for VÉRIFICATION and SAISIE DES TRADES, trade verification list with filters, trade form dialog
- Updated dashboard-tab.tsx: added structure, entryModel, amountToWin to TradeFormData, initial data, form UI, and submit handler
- Created trade-detail-dialog.tsx: added SVG bar chart (RR PAR TRADE), SVG line chart (CUMULÉ ISOLÉ), CUMULÉ TOTAL DE RR card, new trade context section (structure, entryModel), amountToWin in key metrics
- Updated main-app.tsx: navigation now starts with EXÉCUTION DONCIEL and SETUP tabs, removed Dashboard from navigation
- Created Progress UI component (progress.tsx)
- Verified with agent-browser: Execution tab renders correctly with cycle progressions, Setup tab shows both setup cards, Saisie dialog includes all new fields

Stage Summary:
- All 3 major features implemented: EXÉCUTION DONCIEL tab, SETUP tab with sub-interfaces, trade detail enhancements
- New trade fields added throughout the stack (schema → API → hooks → form → detail dialog)
- Charts added to trade detail dialog (RR bar chart, cumulative line chart, total cumulative RR)
- Application compiles and runs without errors
- Default landing tab changed from Dashboard to EXÉCUTION DONCIEL
