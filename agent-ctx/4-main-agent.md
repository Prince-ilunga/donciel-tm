---
Task ID: 4
Agent: Main Agent
Task: Update 3 API route files for Marché tab (calendar, sentiment, briefing)

Work Log:
- Read worklog.md to understand previous work (Task 3 added RSS fallbacks)
- Read all 3 API route files to understand current implementation
- Updated /src/app/api/market/calendar/route.ts:
  a) Fixed week data: Broadened RSS date filtering to include current week + 2 days back + 7 days forward (instead of strict Mon-Fri only)
  b) Added interpretation, direction, impactedPairs to each event:
     - interpretation: French/EN explanation of market impact per event type
     - direction: HAUSSIER/BAISSIER/NEUTRE based on event type
     - impactedPairs: Currency pairs relevant to event (e.g., USD events → EUR/USD, XAU/USD)
  c) Updated ZAI SDK prompt to request interpretation/direction/impactedPairs in JSON
  d) Added fallback enrichment: ZAI events missing these fields get them from keyword analysis
  e) Fixed French: Added FRENCH_EVENT_TRANSLATIONS map with 30+ economic term translations
  f) Added translateEventName() function that replaces English terms with French equivalents
  g) Added `asset` query parameter: Returns `assetEvents` array filtered for XAUUSD/EURUSD/GBPUSD/US30/US100
  h) Added ASSET_PAIR_MAP and filterEventsForAsset() helper
  i) Cache key now includes asset when provided

- Updated /src/app/api/market/sentiment/route.ts:
  a) Added `asset` query parameter: Returns `assetSentiment` object with direction/confidence/interpretation
  b) Fixed French labels: NEUTRAL → NEUTRE when lang=fr for smartMoney/retail direction
  c) Fixed French confidence: high→élevée, medium→moyenne, low→faible when lang=fr
  d) Added ASSET_KEYWORD_MAP with asset-specific bullish/bearish/keywords for all 5 assets
  e) Added computeAssetSentiment() function that derives per-asset sentiment from RSS text
  f) Updated ZAI SDK prompt FR to request NEUTRE (not NEUTRAL) and French confidence labels
  g) All contrarianSignal and interpretation text fully in French when lang=fr
  h) Cache key now includes asset when provided

- Updated /src/app/api/market/briefing/route.ts:
  a) Added `asset` query parameter: Returns `assetBriefing` with keyLevels/scenarioAdjustment/riskEvents
  b) Added ASSET_BRIEFING_DATA map with FR/EN key levels, scenario adjustments, risk keywords for all 5 assets
  c) Added generateAssetBriefing() function
  d) Fixed French: key levels use "Or" instead of "Gold", "Résistance" labels, French number formatting (2 300 not 2300)
  e) Fixed French: Default risk events fully in French when lang=fr
  f) Updated 500 error response to use French text
  g) Cache key now includes asset when provided

- All routes: ZAI SDK path still works, RSS fallback still works
- Build compiles successfully (next build)
- Lint passes with no errors (bun run lint)

Stage Summary:
- All 3 API routes updated with asset query parameter support
- French language fully respected in all RSS fallback paths
- Calendar events now include interpretation, direction, impactedPairs
- Asset-specific sentiment and briefing data available for XAUUSD/EURUSD/GBPUSD/US30/US100
- No breaking changes to existing response structure (new fields added only)
