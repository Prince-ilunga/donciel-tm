# Task 4 - Frontend Agent: MARCHÉ Tab Rewrite

## Task
Completely rewrite the news tab component as MARCHÉ (Market) tab with 4 sub-tabs.

## Files Modified
- `/src/components/news/news-tab.tsx` — Complete rewrite (684 → 1603 lines)

## Key Decisions
1. **Export name preserved**: `NewsTab` kept for backward compatibility with main-app.tsx
2. **API response shapes matched**: Carefully analyzed existing API routes to ensure component data bindings match:
   - Calendar: `events[]` with `{ time, currency, impact, event, actual, forecast, previous, country }` → normalized to `{ title, date, time, currency, impact, countryFlag, forecast, previous, actual }`
   - Sentiment: flat structure with `fearGreed`, `vix`, `smartMoney`, `retail`, `contrarianSignal`, `overallSentiment`, `interpretation`
   - Briefing: `summary`, `asia`, `today`, `keyLevels` (string[]), `scenarios` (object[]), `riskEvents` (string[])
3. **No recharts dependency**: Replaced BarChart with CSS-based bar chart in AnalysisSubTab for lighter bundle
4. **Hooks rules compliance**: Moved `useMemo` before early returns in AlertsSubTab to fix react-hooks/rules-of-hooks lint error
5. **CountdownTimer**: Real-time countdown with 1-second interval, auto-cleanup on unmount

## Sub-tab Architecture
- `CalendarSubTab` — Fetches `/api/market/calendar`, auto-refreshes 5min
- `AnalysisSubTab` — Preserves existing `/api/news` integration with all features
- `SentimentSubTab` — Fetches `/api/market/sentiment`, auto-refreshes 5min
- `AlertsSubTab` — Fetches both `/api/market/briefing` AND `/api/market/calendar` in parallel

## Verification
- ✅ ESLint passes with zero errors
- ✅ Next.js build succeeds (all routes present)
- ✅ Dev server returns 200 at localhost:3000
- ✅ Work record appended to worklog.md
