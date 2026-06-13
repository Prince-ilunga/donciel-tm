---
Task ID: 1
Agent: main
Task: Fix MARCHÉ tab - weekly filter ("Cette Semaine") not displaying data for Calendar, Sentiment, Alertes, and Statistiques sub-tabs

Work Log:
- Analyzed screenshots showing all 4 sub-tabs displaying empty/fallback data when "Cette Semaine" was selected
- Tested API routes directly - Calendar returned empty events for period=week, while Sentiment and Briefing returned real data
- Identified root causes: (1) Calendar API wasn't effectively retrieving weekly events, (2) Frontend didn't reset loading state when period changed, showing stale data
- Fixed Calendar API: added date-specific search queries with actual week date range, second supplementary search for weekly events, ForexFactory weekly view URL, investing.com calendar as additional source, and date field (YYYY-MM-DD) in LLM output
- Fixed frontend: added `useEffect(() => { setLoading(true); }, [period])` to all 4 sub-tabs (Calendar, Sentiment, Alertes, Statistiques) to properly show loading skeleton when period changes
- Fixed Calendar sub-tab weekEvents filter: changed from "now to +7 days" to "Monday to Friday of current week" using useMemo before early returns
- Added day-grouped event display for weekly Calendar view with day names (Lundi-Vendredi), today/past indicators
- Increased cache duration for weekly data (10-15 min vs 5 min for daily)
- Verified with agent browser: all 4 sub-tabs now show real, different data when "Cette Semaine" is selected
- Pushed to GitHub

Stage Summary:
- Calendar API now returns 8-12 events for weekly period with proper dates
- All 4 sub-tabs properly show loading state when switching between Aujourd'hui/Cette Semaine
- Calendar weekly view groups events by day with visual indicators
- Sentiment shows different values: VIX 17.68→23.06, RISK-ON→RISK-OFF for weekly view
- Alertes shows "Briefing Hebdomadaire" with additional risk events for weekly view
- Statistiques shows 8 events/4 high impact for weekly vs 3 events for daily
