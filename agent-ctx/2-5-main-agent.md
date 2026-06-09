# Task 2-5: Fix SAISIE DES TRADES, DÉTAILS COMPLET, DISTRIBUTION RR, VIDEOS

## Summary
Applied 6 fixes across 4 files as specified in the task requirements.

## Files Modified
- `src/components/setup/setup-tab.tsx` - Fix 2a, 2b, 2c
- `src/components/shared/trade-detail-dialog.tsx` - Fix 2b, 2c, 3a, 3b
- `src/lib/i18n.ts` - Fix 4, added contextScreenshot key
- `src/components/videos/videos-tab.tsx` - Fix 5

## Changes Detail

### Fix 2a: Calculator RR logic
- Added RR adjustment in `calculateAuto()` when resultLabel is determined:
  - LOSS → rr = -1
  - BE → rr = 0
  - WIN → keeps raw RR
  - No result (no exit price) → shows raw reward/risk ratio

### Fix 2b: Removed amountToWin field
- Removed from TradeFormData interface, initialFormData, handleSubmit, form UI, and trade detail dialog

### Fix 2c: Screenshots renamed from analysis to context
- analysisFile → contextFile in form
- Upload type "analysis" → "context"
- Added screenshot upload section with 3 buttons (Contexte, Entrée, Sortie) with previews
- Trade detail dialog displays "Contexte" for both "context" and legacy "analysis" types
- Added contextScreenshot translation key

### Fix 3a: CSS variables → hex colors in SVG charts
- Replaced all var(--color-*) with direct hex values

### Fix 3b: Cumulative RR per trade
- Changed from sum of all trades to cumulative RR up to current trade

### Fix 4: movingAverage20 translations
- Updated to uppercase "MOYENNE DE RR CUMULÉ DE (20 TRADES)" / "CUMULATIVE RR AVERAGE OF (20 TRADES)"

### Fix 5: Add Video button
- Changed from admin-only to all logged-in users

## Lint Status
- All lint checks pass
