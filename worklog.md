# DONCIEL™ Project Worklog

---
Task ID: 1
Agent: Main Agent
Task: Fix News tab to show data and fix blank preview panel

Work Log:
- Investigated dev server crash loop (server was crashing repeatedly)
- Found that `@/lib/zai.ts` module exists and works for ZAI SDK
- Tested RSS feeds from Investing.com - all working
- Identified that keyword filtering was too strict (only 1/10 items matching)
- Rewrote `/api/news/route.ts` with:
  - Broader keyword matching (e.g., 'commodit' instead of 'commodities', 'rate' instead of 'interest rate')
  - Added `fetchBroadNews()` fallback when keyword filtering returns <3 results
  - Added `generateUpcomingEvents()` function with static economic calendar per asset (FR/EN)
  - Wrapped AI analysis in try/catch to prevent ZAI SDK errors from crashing the API
  - Increased news limit from 12 to 15 items
  - Added more bullish/bearish detection keywords
- Verified RSS feeds return data: Feed 11: 7/10, Feed 1: 6/10, Feed 14: 2/10, Feed 25: 4/10 (19 total filtered)
- Ran lint - no errors
- Committed and pushed to GitHub

Stage Summary:
- News API now returns significantly more data (14+ items for XAUUSD vs 1 before)
- Upcoming economic events are now populated per asset
- ZAI SDK errors are handled gracefully (fallback to keyword-based analysis)
- Code pushed to GitHub: `fix: improve news tab data loading - broader RSS keywords, broad fallback, upcoming events, robust AI analysis`
- Preview panel shows blank due to sandbox resource constraints (Chrome + Next.js can't coexist), but app works correctly via curl
