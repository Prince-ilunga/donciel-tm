import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the contract size (lot multiplier) for a trading pair.
 * This determines how many units one standard lot represents.
 * 
 * - XAUUSD: 1 lot = 100 troy ounces
 * - US30: 1 lot = $5 per point (common for most brokers)
 * - US100/NAS100: 1 lot = $20 per point (common for most brokers)
 * - Forex pairs (EURUSD, GBPUSD, etc.): 1 lot = 100,000 units
 * - Default: 1 (indices or custom pairs)
 */
export function getContractSize(pair: string): number {
  const p = pair.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Gold
  if (p === 'XAUUSD') return 100;
  
  // US30 (Dow Jones) - $5 per point per standard lot
  if (p === 'US30' || p === 'US30CASH' || p === 'US30USD') return 5;
  
  // US100/NAS100 (Nasdaq) - $20 per point per standard lot
  if (p === 'US100' || p === 'NAS100' || p === 'US100CASH' || p === 'NAS100CASH') return 20;
  
  // Forex pairs - 1 standard lot = 100,000 units
  const forexPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF',
    'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'NZDJPY', 'CADJPY', 'CHFJPY',
    'EURAUD', 'EURNZD', 'GBPAUD', 'GBPNZD', 'AUDNZD', 'NZDCAD', 'CADCHF',
    'AUDCAD', 'AUDCHF', 'EURNOK', 'EURSEK', 'GBPCAD', 'GBPCHF', 'NZDCHF',
    'USDMXN', 'USDNOK', 'USDSEK', 'USDZAR', 'USDSGD', 'USDHKD', 'USDCNH'];
  if (forexPairs.includes(p)) return 100000;
  
  // Default for unknown pairs (indices, crypto, etc.)
  return 1;
}

/**
 * Calculate P&L, Risk, or Reward in dollars using proper contract size.
 * Formula: priceDifference * lotSize * contractSize
 */
export function calculateDollarAmount(priceDiff: number, lotSize: number, pair: string): number {
  return priceDiff * lotSize * getContractSize(pair);
}
