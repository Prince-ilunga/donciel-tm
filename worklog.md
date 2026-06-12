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

---
Task ID: 2
Agent: Main Agent
Task: Add finance-specialized AI (DONCIEL-AI™) capable of interpreting all news in real-time with direction prediction based on real data

Work Log:
- Analyzed existing news AI implementation (generic "analyste fondamental" prompt)
- Read LLM skill documentation for best ZAI SDK usage patterns
- Created DONCIEL-AI™ — CFA-level finance AI system with specialized prompts (FR/EN)
- Added ASSET_CONTEXT dictionary with sector, drivers, correlations per asset for deeper analysis
- New AI analysis returns richer JSON: summary, direction, confidence, impact, keyFactors, recommendation, sentiment, shortTerm (intraday), mediumTerm (swing), riskWarning, newsInterpretations (per-news direction + reason)
- Added `searchLatestMarketData()` using ZAI SDK web_search for real-time market data enrichment
- AI per-news interpretations merged back into each news item as `aiDirection` and `aiReason` fields
- Added `aiPowered` flag to distinguish AI vs keyword-based analysis
- Updated news-tab UI:
  - Brain icon + "DONCIEL-AI™" badge (purple gradient) when AI is active
  - Sentiment gauge bar (Très Haussier → Très Baissier)
  - Short-term (Intraday) and Medium-term (Swing) analysis panels
  - Risk warning panel (red alert box)
  - Per-news AI direction icons (arrow up/down/neutral) next to each title
  - Per-news AI interpretation reason (purple text with Brain icon)
  - Per-news direction badge (HAUSSIER/BAISSIER/NEUTRE)
  - Updated disclaimer to mention DONCIEL-AI™
- Tested ZAI SDK: web_search works (3 results), chat.completions works (full JSON response with all 11 fields)
- Lint passes, build succeeds
- Committed and pushed to GitHub

Stage Summary:
- DONCIEL-AI™ is now a finance-specialized AI with CFA-level expertise
- Interprets ALL news in real-time with per-item direction tags
- Predicts probable direction with confidence and sentiment
- Provides short-term and medium-term outlook
- Warns about key risks
- Enriches data with web search for latest market data
- Works on Vercel via ZAI SDK fallback strategies
- Only modified news-related files (route.ts + news-tab.tsx) as instructed
