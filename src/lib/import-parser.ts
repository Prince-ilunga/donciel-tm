// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Import parser (MetaTrader 5 HTML & CSV générique)
// Fonctions 100% pures, sans dépendance : utilisées par
// l'API /api/import (serveur) et pré-analysables côté client.
// ─────────────────────────────────────────────────────────────

export type ImportMode = 'MT5_HTML' | 'CSV';

export interface ParsedTradePreview {
  date: string; // ISO local YYYY-MM-DDTHH:mm:ss (heure du broker)
  pair: string; // normalisée (XAUUSD, EURUSD, US30…)
  direction: 'LONG' | 'SHORT';
  session: string; // ASIE, LONDON, OVERLAP, NEW YORK, MACRO PEU CHER
  marketCondition: 'CONTINUATION' | 'RETRACEMENT';
  timeframe: string; // défaut 'M5'
  entryPrice: number;
  stopLoss: number; // 0 si inconnu
  takeProfit: number; // 0 si inconnu
  exitPrice: number | null;
  entryTime: string | null; // 'HH:mm'
  exitTime: string | null; // 'HH:mm'
  duration: string | null; // '1h 23m' ou '23m'
  lotSize: number | null;
  rr: number | null; // |TP-entrée|/|entrée-SL| ; -1 si LOSS sans SL
  pnl: number | null; // profit net du rapport (commission+swap+profit si MT5)
  result: 'WIN' | 'LOSS' | 'BE';
  volume: number | null;
  comment?: string | null;
}

export interface ParseResult {
  trades: ParsedTradePreview[];
  warnings: string[];
}

export const MAX_IMPORT_WARNINGS = 10;
export const MAX_IMPORT_TRADES = 2000;

// ─── Warnings (plafonnés) ──────────────────────────────────────

interface WarningSink {
  messages: string[];
  truncated: boolean;
}

function addWarning(sink: WarningSink, msg: string): void {
  if (sink.messages.length < MAX_IMPORT_WARNINGS) {
    sink.messages.push(msg);
  } else {
    sink.truncated = true;
  }
}

function finalizeWarnings(sink: WarningSink): string[] {
  if (!sink.truncated) return sink.messages;
  const kept = sink.messages.slice(0, MAX_IMPORT_WARNINGS - 1);
  kept.push('… autres avertissements masqués');
  return kept;
}

// ─── Nombres tolérants (« 1 234,56 » → 1234.56) ────────────────

/**
 * Parse un nombre au format européen ou américain.
 * - Espaces insécables / apôtres = séparateurs de milliers
 * - « 1.234,56 » / « 1 234,56 » → 1234.56 ; « 1,234,567.89 » → 1234567.89
 * - decimalCommaHint : force la virgule comme décimale (CSV « ; » européen)
 */
export function parseFlexibleNumber(
  raw: string | null | undefined,
  decimalCommaHint = false
): number | null {
  if (raw === null || raw === undefined) return null;
  let s = raw
    .replace(/[\u00A0\u202F\u2009\u2007\u2060]/g, '') // espaces insécables
    .replace(/['\s]/g, '')
    .trim();
  if (!s) return null;
  s = s.replace(/[^\d.,+\-]/g, ''); // retire $, €, USD…
  if (!s || !/\d/.test(s)) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(/,/g, '.'); // 1.234.567,89
    } else {
      s = s.replace(/,/g, ''); // 1,234,567.89
    }
  } else if (hasComma) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, ''); // 1,234,567 (milliers US)
    } else if (/^\d{1,2},\d{1,2}$/.test(s) || decimalCommaHint) {
      s = s.replace(',', '.'); // décimale européenne
    } else {
      s = s.replace(/,/g, ''); // 1,234 → 1234 (défaut US)
    }
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s) && (s.match(/\./g) || []).length >= 2) {
    s = s.replace(/\./g, ''); // 1.234.567 (milliers EU sans virgule)
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ─── Dates ─────────────────────────────────────────────────────

export interface ParsedDateInfo {
  iso: string; // YYYY-MM-DDTHH:mm:ss
  ms: number; // horodatage local (pour durées)
  time: string | null; // 'HH:mm' ou null si date seule
}

function mkDateInfo(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  hasTime: boolean
): ParsedDateInfo | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  if (y < 1990 || y > 2100) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    iso: `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`,
    ms: new Date(y, mo - 1, d, h, mi, s).getTime(),
    time: hasTime ? `${pad(h)}:${pad(mi)}` : null,
  };
}

/** Date MetaTrader 5 : « 2024.01.15 08:30:00 » (aussi - et /) */
export function parseMt5Date(raw: string): ParsedDateInfo | null {
  const m = /^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(
    raw.trim()
  );
  if (!m) return null;
  const hasTime = m[4] !== undefined;
  return mkDateInfo(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0),
    hasTime
  );
}

/** Date CSV : ISO, MT5, « 15/01/2024 08:30 » (jour d'abord par défaut) */
export function parseCsvDate(raw: string): ParsedDateInfo | null {
  const v = raw.trim();
  let m = /^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
  if (m) {
    const hasTime = m[4] !== undefined;
    return mkDateInfo(
      Number(m[1]), Number(m[2]), Number(m[3]),
      Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0),
      hasTime
    );
  }
  m = /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let day = a;
    let month = b;
    if (a <= 12 && b > 12) {
      day = b;
      month = a;
    }
    const hasTime = m[4] !== undefined;
    return mkDateInfo(
      Number(m[3]), month, day,
      Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0),
      hasTime
    );
  }
  return null;
}

// ─── Session, durée, RR, résultat ──────────────────────────────

/** Session dérivée de l'heure : ASIE <7h, LONDON 7-12h, OVERLAP 12-16h, NEW YORK 16-21h, sinon MACRO PEU CHER */
export function deriveSessionFromISO(iso: string): string {
  const h = Number(iso.slice(11, 13));
  if (!Number.isFinite(h)) return 'OVERLAP';
  if (h < 7) return 'ASIE';
  if (h < 12) return 'LONDON';
  if (h < 16) return 'OVERLAP';
  if (h < 21) return 'NEW YORK';
  return 'MACRO PEU CHER';
}

/** Durée lisible « 1h 23m » / « 23m » ; null si négative ou invalide */
export function formatDuration(fromMs: number, toMs: number): string | null {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  const diff = Math.round((toMs - fromMs) / 60000);
  if (diff < 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** RR préview : ratio planifié si SL>0 et TP>0 ; -1 si LOSS sans SL ; sinon null */
export function computePreviewRR(
  entry: number,
  stopLoss: number,
  takeProfit: number,
  result: 'WIN' | 'LOSS' | 'BE'
): number | null {
  if (stopLoss > 0 && takeProfit > 0) {
    const risk = Math.abs(entry - stopLoss);
    if (risk <= 0) return result === 'LOSS' ? -1 : null;
    return Math.round((Math.abs(takeProfit - entry) / risk) * 100) / 100;
  }
  return result === 'LOSS' ? -1 : null;
}

function deriveResult(
  pnl: number | null,
  direction: 'LONG' | 'SHORT',
  entry: number,
  exit: number | null
): 'WIN' | 'LOSS' | 'BE' {
  if (pnl !== null) {
    return pnl > 0.005 ? 'WIN' : pnl < -0.005 ? 'LOSS' : 'BE';
  }
  if (exit !== null) {
    const diff = direction === 'LONG' ? exit - entry : entry - exit;
    return diff > 0 ? 'WIN' : diff < 0 ? 'LOSS' : 'BE';
  }
  return 'BE';
}

// ─── Normalisation des paires ──────────────────────────────────

const PAIR_ALIASES: Array<[string, string]> = [
  ['XAUUSD', 'XAUUSD'], ['GOLD', 'XAUUSD'], ['XAU', 'XAUUSD'],
  ['XAGUSD', 'XAGUSD'], ['SILVER', 'XAGUSD'], ['XAG', 'XAGUSD'],
  ['US100', 'US100'], ['NAS100', 'US100'], ['NASDAQ', 'US100'], ['USTEC', 'US100'], ['NDX', 'US100'], ['NAS', 'US100'],
  ['US30', 'US30'], ['DOW', 'US30'], ['DJI', 'US30'], ['DJ30', 'US30'],
  ['US500', 'US500'], ['SP500', 'US500'], ['SPX', 'US500'],
  ['GER40', 'GER40'], ['DE40', 'GER40'], ['DAX', 'GER40'], ['DE30', 'GER40'],
  ['UK100', 'UK100'], ['FTSE', 'UK100'],
  ['JP225', 'JP225'], ['NIKKEI', 'JP225'], ['JPN225', 'JP225'],
  ['BTCUSD', 'BTCUSD'], ['BTC', 'BTCUSD'],
  ['ETHUSD', 'ETHUSD'], ['ETH', 'ETHUSD'],
];

/**
 * Normalise un symbole broker : uppercase, retire suffixes/prefixes
 * (« EURUSD.a », « GBPJPY.m », « XAUUSD+ », « #US30 », « EURUSD.pro »),
 * puis résout les alias (XAU/GOLD→XAUUSD, US30/DOW/DJI→US30, DE40/DAX→GER40…).
 */
export function normalizePair(raw: string): string {
  let s = (raw ?? '').toString().trim().toUpperCase();
  if (!s) return '';
  s = s.replace(/^[#.\-_\s]+/, ''); // prefix broker (#US30)
  s = s.replace(/[+.\-_=].*$/, ''); // suffix broker (EURUSD.a, XAUUSD+)
  s = s.replace(/[^A-Z0-9]/g, ''); // alphanumérique seul
  if (!s) return '';

  for (const [k, v] of PAIR_ALIASES) {
    if (s === k) return v;
  }
  // suffixe collé sans séparateur (US30CASH, EURUSDmicro, NAS100Cash…)
  for (const [k, v] of PAIR_ALIASES) {
    if (s.startsWith(k) && s.length - k.length <= 6) return v;
  }
  if (/^[A-Z]{6}$/.test(s)) return s; // paire forex standard
  return s;
}

// ─── Assemblage d'un trade ─────────────────────────────────────

interface PreviewBuildInput {
  dateInfo: ParsedDateInfo;
  pairRaw: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  exitPrice: number | null;
  exitTime?: string | null;
  exitMs?: number | null;
  lotSize?: number | null;
  pnl?: number | null;
  comment?: string | null;
}

function buildPreview(i: PreviewBuildInput): ParsedTradePreview {
  const stopLoss = i.stopLoss ?? 0;
  const takeProfit = i.takeProfit ?? 0;
  const result = deriveResult(i.pnl ?? null, i.direction, i.entryPrice, i.exitPrice);
  const duration =
    i.exitMs != null && i.exitMs >= i.dateInfo.ms ? formatDuration(i.dateInfo.ms, i.exitMs) : null;
  return {
    date: i.dateInfo.iso,
    pair: normalizePair(i.pairRaw),
    direction: i.direction,
    session: deriveSessionFromISO(i.dateInfo.iso),
    marketCondition: 'CONTINUATION',
    timeframe: 'M5',
    entryPrice: i.entryPrice,
    stopLoss,
    takeProfit,
    exitPrice: i.exitPrice,
    entryTime: i.dateInfo.time,
    exitTime: i.exitTime ?? null,
    duration,
    lotSize: i.lotSize ?? null,
    rr: computePreviewRR(i.entryPrice, stopLoss, takeProfit, result),
    pnl: i.pnl ?? null,
    result,
    volume: i.lotSize ?? null,
    comment: i.comment ?? null,
  };
}

// ─── Extraction HTML (DOM-lite, sans jsdom) ────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 && n < 65536 ? String.fromCharCode(n) : ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRe = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function normHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Résout un libellé d'en-tête (EN/FR) vers une clé canonique */
const HEADER_SYNONYMS: Record<string, string> = {
  // Table "Deals"
  time: 'time', temps: 'time', heure: 'time', date: 'time', datetime: 'time',
  deal: 'deal', deals: 'deals', ticket: 'deal',
  symbol: 'symbol', symbole: 'symbol', instrument: 'symbol', actif: 'symbol', paire: 'symbol',
  item: 'symbol', market: 'symbol', marche: 'symbol', asset: 'symbol',
  type: 'type', sens: 'type',
  direction: 'direction',
  volume: 'volume', lots: 'volume', taille: 'volume',
  size: 'volume', vol: 'volume', qty: 'volume', quantity: 'volume', quantite: 'volume',
  price: 'price', prix: 'price', cours: 'price',
  order: 'order', ordre: 'order',
  commission: 'commission',
  swap: 'swap',
  profit: 'profit', gains: 'profit', pnl: 'profit',
  balance: 'balance', solde: 'balance',
  comment: 'comment', commentaire: 'comment', commentaires: 'comment', note: 'comment', notes: 'comment',
  // Table "Positions"
  opentime: 'opentime', ouverture: 'opentime', heuredouverture: 'opentime',
  tempsdouverture: 'opentime', datetimedouverture: 'opentime',
  openprice: 'openprice', prixdouverture: 'openprice', prixouverture: 'openprice',
  closetime: 'closetime', fermeture: 'closetime', heuredeloture: 'closetime',
  heuredelcloture: 'closetime', tempsdefermeture: 'closetime', heuredecloture: 'closetime',
  closeprice: 'closeprice', prixdefermeture: 'closeprice', prixcloture: 'closeprice', prixdecloture: 'closeprice',
  position: 'position',
  sl: 'sl', stoploss: 'sl',
  tp: 'tp', takeprofit: 'tp', target: 'tp',
};

function headerKey(raw: string): string {
  const n = normHeader(raw);
  return HEADER_SYNONYMS[n] ?? n;
}

interface ColumnMap {
  [canonical: string]: number;
}

/** Cherche dans une ligne toutes les colonnes demandées ; null si une requise manque */
function findHeaderIndex(
  cells: string[],
  required: string[],
  optional: string[]
): ColumnMap | null {
  const map: ColumnMap = {};
  let foundRequired = 0;
  for (let i = 0; i < cells.length; i++) {
    const key = headerKey(cells[i]);
    if (!key) continue;
    if (required.includes(key) && map[key] === undefined) {
      map[key] = i;
      foundRequired++;
    } else if (optional.includes(key) && map[key] === undefined) {
      map[key] = i;
    }
  }
  return foundRequired === required.length ? map : null;
}

function parseMt5TypeCell(raw: string): 'buy' | 'sell' | null {
  const v = raw.trim().toLowerCase();
  if (v === 'buy') return 'buy';
  if (v === 'sell') return 'sell';
  return null;
}

function parseMt5DirCell(raw: string): 'in' | 'out' | 'in/out' | null {
  const v = raw.trim().toLowerCase();
  if (v.includes('in/out')) return 'in/out';
  if (v.startsWith('in')) return 'in';
  if (v.startsWith('out')) return 'out';
  return null;
}

// ─── Parser MT5 (HTML) ─────────────────────────────────────────

interface Mt5Deal {
  iso: string;
  ms: number;
  time: string | null;
  symbol: string;
  type: 'buy' | 'sell';
  dir: 'in' | 'out' | 'in/out';
  volume: number | null;
  price: number | null;
  commission: number;
  swap: number;
  profit: number;
  comment: string | null;
}

function cellAt(map: ColumnMap, cells: string[], key: string): string {
  const idx = map[key];
  if (idx === undefined) return '';
  return cells[idx] ?? '';
}

/**
 * Parse un rapport MetaTrader 5 (HTML).
 * 1. Table "Positions" (Open Time / Close Price / S/L / T/P) si présente — la plus riche.
 * 2. Sinon table "Deals" (in/out) avec association OUT → IN (même symbole, type opposé).
 */
export function parseMT5Html(content: string): ParseResult {
  const sink: WarningSink = { messages: [], truncated: false };
  const rows = extractRows(content);

  const fromPositions = parsePositionsRows(rows, sink);
  if (fromPositions.length > 0) {
    return {
      trades: fromPositions.slice(0, MAX_IMPORT_TRADES),
      warnings: finalizeWarnings(sink),
    };
  }

  const fromDeals = parseDealsRows(rows, sink);
  return {
    trades: fromDeals.slice(0, MAX_IMPORT_TRADES),
    warnings: finalizeWarnings(sink),
  };
}

/** Table "Closed Deals" vue Positions : Open Time | Position | Symbol | Type | Volume | Open Price | S/L | T/P | Close Time | Close Price | Commission | Swap | Profit */
function parsePositionsRows(rows: string[][], sink: WarningSink): ParsedTradePreview[] {
  const REQUIRED = ['opentime', 'symbol', 'type', 'openprice', 'closeprice'];
  const OPTIONAL = ['position', 'volume', 'sl', 'tp', 'closetime', 'commission', 'swap', 'profit', 'comment'];

  let headerMap: ColumnMap | null = null;
  let headerIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    const m = findHeaderIndex(rows[i], REQUIRED, OPTIONAL);
    if (m) {
      headerMap = m;
      headerIdx = i;
      break;
    }
  }
  if (!headerMap || headerIdx < 0) return [];

  const trades: ParsedTradePreview[] = [];
  let openSkipped = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = rows[i];
    const dateInfo = parseMt5Date(cellAt(headerMap, cells, 'opentime'));
    const type = parseMt5TypeCell(cellAt(headerMap, cells, 'type'));
    if (!dateInfo || !type) continue; // séparateur / fin de table / autre section

    const entryPrice = parseFlexibleNumber(cellAt(headerMap, cells, 'openprice'));
    if (entryPrice === null) continue;

    const closePriceRaw = cellAt(headerMap, cells, 'closeprice');
    const exitPrice = parseFlexibleNumber(closePriceRaw);
    const closeInfo = cellAt(headerMap, cells, 'closetime')
      ? parseMt5Date(cellAt(headerMap, cells, 'closetime'))
      : null;
    if (exitPrice === null && !closeInfo) {
      openSkipped++; // position toujours ouverte
      continue;
    }

    const commission = parseFlexibleNumber(cellAt(headerMap, cells, 'commission')) ?? 0;
    const swap = parseFlexibleNumber(cellAt(headerMap, cells, 'swap')) ?? 0;
    const profit = parseFlexibleNumber(cellAt(headerMap, cells, 'profit')) ?? 0;
    const lotSize = parseFlexibleNumber(cellAt(headerMap, cells, 'volume'));
    const stopLoss = parseFlexibleNumber(cellAt(headerMap, cells, 'sl')) ?? 0;
    const takeProfit = parseFlexibleNumber(cellAt(headerMap, cells, 'tp')) ?? 0;
    const comment = cellAt(headerMap, cells, 'comment') || null;

    trades.push(
      buildPreview({
        dateInfo,
        pairRaw: cellAt(headerMap, cells, 'symbol'),
        direction: type === 'buy' ? 'LONG' : 'SHORT',
        entryPrice,
        stopLoss,
        takeProfit,
        exitPrice,
        exitTime: closeInfo?.time ?? null,
        exitMs: closeInfo?.ms ?? null,
        lotSize,
        pnl: commission + swap + profit,
        comment,
      })
    );
    if (trades.length >= MAX_IMPORT_TRADES) break;
  }

  if (openSkipped > 0) {
    addWarning(sink, `${openSkipped} position(s) encore ouverte(s) ignorée(s) (pas de clôture)`);
  }
  return trades.sort((a, b) => a.date.localeCompare(b.date));
}

/** Table "Deals" : Time | Deal | Symbol | Type | Direction | Volume | Price | Order | Commission | Swap | Profit | Balance | Comment */
function parseDealsRows(rows: string[][], sink: WarningSink): ParsedTradePreview[] {
  const REQUIRED = ['time', 'symbol', 'type', 'direction'];
  const OPTIONAL = ['deal', 'deals', 'volume', 'price', 'order', 'commission', 'swap', 'profit', 'balance', 'comment'];

  let headerMap: ColumnMap | null = null;
  let headerIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    const m = findHeaderIndex(rows[i], REQUIRED, OPTIONAL);
    if (m) {
      headerMap = m;
      headerIdx = i;
      break;
    }
  }

  const deals: Mt5Deal[] = [];
  if (headerMap && headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const cells = rows[i];
      const dateInfo = parseMt5Date(cellAt(headerMap, cells, 'time'));
      if (!dateInfo) continue; // fin de table ou ligne décorative
      const type = parseMt5TypeCell(cellAt(headerMap, cells, 'type'));
      const dir = parseMt5DirCell(cellAt(headerMap, cells, 'direction'));
      if (!type || !dir) continue; // balance / credit / autres
      deals.push({
        iso: dateInfo.iso,
        ms: dateInfo.ms,
        time: dateInfo.time,
        symbol: cellAt(headerMap, cells, 'symbol'),
        type,
        dir,
        volume: parseFlexibleNumber(cellAt(headerMap, cells, 'volume')),
        price: parseFlexibleNumber(cellAt(headerMap, cells, 'price')),
        commission: parseFlexibleNumber(cellAt(headerMap, cells, 'commission')) ?? 0,
        swap: parseFlexibleNumber(cellAt(headerMap, cells, 'swap')) ?? 0,
        profit: parseFlexibleNumber(cellAt(headerMap, cells, 'profit')) ?? 0,
        comment: cellAt(headerMap, cells, 'comment') || null,
      });
    }
  } else {
    // Fallback positionnel : layout standard MT5
    for (const cells of rows) {
      if (cells.length < 11) continue;
      const dateInfo = parseMt5Date(cells[0] ?? '');
      const type = parseMt5TypeCell(cells[3] ?? '');
      const dir = parseMt5DirCell(cells[4] ?? '');
      if (!dateInfo || !type || !dir) continue;
      deals.push({
        iso: dateInfo.iso,
        ms: dateInfo.ms,
        time: dateInfo.time,
        symbol: cells[2] ?? '',
        type,
        dir,
        volume: parseFlexibleNumber(cells[5] ?? ''),
        price: parseFlexibleNumber(cells[6] ?? ''),
        commission: parseFlexibleNumber(cells[8] ?? '') ?? 0,
        swap: parseFlexibleNumber(cells[9] ?? '') ?? 0,
        profit: parseFlexibleNumber(cells[10] ?? '') ?? 0,
        comment: (cells[12] ?? '').trim() || null,
      });
    }
  }

  if (deals.length === 0) return [];

  // Association OUT → IN le plus proche (même symbole, type opposé)
  const trades: ParsedTradePreview[] = [];
  const openIns: Array<Mt5Deal & { matched: boolean }> = [];
  for (const deal of deals) {
    if (deal.dir === 'in') {
      openIns.push({ ...deal, matched: false });
      continue;
    }
    if (deal.dir === 'out' || deal.dir === 'in/out') {
      let matchIdx = -1;
      for (let k = openIns.length - 1; k >= 0; k--) {
        const cand = openIns[k];
        if (!cand.matched && cand.symbol === deal.symbol && cand.type !== deal.type) {
          matchIdx = k;
          break;
        }
      }
      if (matchIdx >= 0) {
        const tin = openIns[matchIdx];
        tin.matched = true;
        const pnl = tin.commission + tin.swap + deal.commission + deal.swap + deal.profit;
        trades.push(
          buildPreview({
            dateInfo: { iso: tin.iso, ms: tin.ms, time: tin.time },
            pairRaw: tin.symbol,
            direction: tin.type === 'buy' ? 'LONG' : 'SHORT',
            entryPrice: tin.price ?? deal.price ?? 0,
            exitPrice: deal.price ?? tin.price ?? null,
            exitTime: deal.time,
            exitMs: deal.ms,
            lotSize: tin.volume ?? deal.volume,
            pnl,
            comment: deal.comment ?? tin.comment,
          })
        );
      } else {
        addWarning(
          sink,
          `Sortie ${deal.symbol || '?'} (${deal.iso.replace('T', ' ')}) sans entrée correspondante — ignorée`
        );
      }
      if (deal.dir === 'in/out') {
        // un deal in/out ouvre aussi une nouvelle position (retournement / renforcement)
        openIns.push({ ...deal, matched: false });
      }
    }
  }

  for (const d of openIns) {
    if (!d.matched) {
      addWarning(
        sink,
        `Position ${d.symbol || '?'} ouverte le ${d.iso.replace('T', ' ')} sans sortie détectée — trade ignoré`
      );
    }
  }

  return trades.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Parser CSV générique ──────────────────────────────────────

type CsvField =
  | 'date'
  | 'pair'
  | 'direction'
  | 'entryPrice'
  | 'stopLoss'
  | 'takeProfit'
  | 'exitPrice'
  | 'lotSize'
  | 'pnl'
  | 'comment'
  | 'exitTime';

const CSV_FIELDS: CsvField[] = [
  'date', 'pair', 'direction', 'entryPrice', 'stopLoss',
  'takeProfit', 'exitPrice', 'lotSize', 'pnl', 'comment', 'exitTime',
];

/** Synonymes d'en-têtes tolérants (normalisés : minuscules, a-z uniquement) */
const CSV_SYNONYMS: Record<CsvField, string[]> = {
  date: ['date', 'time', 'datetime', 'opentime', 'opendate', 'opened', 'opendatetime', 'heure', 'datedouverture', 'temps'],
  pair: ['symbol', 'pair', 'instrument', 'ticker', 'asset', 'market', 'item', 'actif', 'symbole', 'paire'],
  direction: ['type', 'side', 'direction', 'longshort', 'buysell', 'sens'],
  entryPrice: ['openprice', 'entryprice', 'entry', 'open', 'in', 'inprice', 'price', 'entrypx', 'prixdouverture', 'prixouverture', 'prixdentree', 'prixentree'],
  exitPrice: ['closeprice', 'exitprice', 'exit', 'close', 'out', 'outprice', 'prixdefermeture', 'prixcloture', 'prixdecloture', 'prixdesortie', 'prixsortie'],
  stopLoss: ['sl', 'stop', 'stoploss', 'stoplossprice', 'stopprice', 'slprice', 'stoplossprix'],
  takeProfit: ['tp', 'target', 'takeprofit', 'takeprofitprice', 'targetprice', 'objectif'],
  lotSize: ['volume', 'lots', 'lot', 'lotsize', 'size', 'qty', 'quantity', 'vol', 'taille'],
  pnl: ['profit', 'pnl', 'pl', 'netpnl', 'netprofit', 'profitloss', 'profitusd', 'pnlusd', 'gains'],
  comment: ['comment', 'comments', 'notes', 'note', 'remarks', 'commentaire', 'commentaires'],
  exitTime: ['exittime', 'closetime', 'closedate', 'heurefermeture', 'tempsdefermeture'],
};

/** Fallback positionnel si aucun en-tête reconnu */
const CSV_POSITIONAL: Partial<Record<CsvField, number>> = {
  date: 0,
  pair: 1,
  direction: 2,
  lotSize: 3,
  entryPrice: 4,
  stopLoss: 5,
  takeProfit: 6,
  exitPrice: 7,
  pnl: 8,
  comment: 9,
};

function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  let inQuotes = false;
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of firstLine) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch in counts) {
      counts[ch]++;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 && sorted[0][1] > 0 ? sorted[0][0] : ',';
}

/** Tokeniseur CSV compatible guillemets RFC4180 ("", retours ligne dans quotes) */
function tokenizeCsv(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushRow = () => {
    row.push(field);
    field = '';
    if (row.length > 1 || row[0].trim() !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

function mapCsvHeader(cells: string[]): Partial<Record<CsvField, number>> {
  const map: Partial<Record<CsvField, number>> = {};
  const used = new Set<number>();
  for (const field of CSV_FIELDS) {
    for (const syn of CSV_SYNONYMS[field]) {
      const idx = cells.findIndex((c, i) => !used.has(i) && normHeader(c) === syn);
      if (idx >= 0) {
        map[field] = idx;
        used.add(idx);
        break;
      }
    }
  }
  return map;
}

function mapCsvDirection(raw: string): 'LONG' | 'SHORT' | null {
  const v = raw.trim().toLowerCase();
  if (['buy', 'b', 'long', 'l', '1', 'true'].includes(v)) return 'LONG';
  if (['sell', 's', 'short', '0', 'false'].includes(v)) return 'SHORT';
  return null;
}

/**
 * Parse un CSV générique de trades.
 * - Séparateur auto («,», «;» ou tabulation), guillemets RFC4180 supportés
 * - En-têtes tolérants (synonymes FR/EN) ; sinon mode positionnel :
 *   date, paire, direction, lot, entrée, SL, TP, sortie, PnL, commentaire
 * - Lignes sans date + paire → ignorées avec warning (max 10)
 */
export function parseGenericCsv(content: string): ParseResult {
  const sink: WarningSink = { messages: [], truncated: false };
  const delimiter = detectDelimiter(content);
  const rows = tokenizeCsv(content, delimiter);
  if (rows.length === 0) return { trades: [], warnings: finalizeWarnings(sink) };

  const decimalCommaHint = delimiter === ';'; // CSV européen « ; » → virgule décimale probable

  let headerMap: Partial<Record<CsvField, number>> | null = null;
  let dataStart = 0;
  const mapped = mapCsvHeader(rows[0]);
  if (mapped.date !== undefined && mapped.pair !== undefined) {
    headerMap = mapped;
    dataStart = 1;
  } else {
    addWarning(
      sink,
      'En-têtes CSV non reconnus — mode positionnel appliqué (date, paire, direction, lot, entrée, SL, TP, sortie, PnL, commentaire)'
    );
  }

  const trades: ParsedTradePreview[] = [];
  for (let i = dataStart; i < rows.length; i++) {
    const cells = rows[i];
    const get = (field: CsvField): string => {
      const idx = headerMap ? headerMap[field] : CSV_POSITIONAL[field];
      return idx !== undefined ? (cells[idx] ?? '').trim() : '';
    };

    const dateInfo = parseCsvDate(get('date'));
    const pairRaw = get('pair');
    const direction = mapCsvDirection(get('direction'));
    const entryPrice = parseFlexibleNumber(get('entryPrice'), decimalCommaHint);

    if (!dateInfo || !pairRaw || !direction || entryPrice === null) {
      if (cells.some((c) => c.trim().length > 0)) {
        addWarning(sink, `Ligne ${i + 1} ignorée : date et/ou paire introuvable`);
      }
      continue;
    }

    const stopLoss = parseFlexibleNumber(get('stopLoss'), decimalCommaHint) ?? 0;
    const takeProfit = parseFlexibleNumber(get('takeProfit'), decimalCommaHint) ?? 0;
    const exitPrice = parseFlexibleNumber(get('exitPrice'), decimalCommaHint);
    const lotSize = parseFlexibleNumber(get('lotSize'), decimalCommaHint);
    const pnl = parseFlexibleNumber(get('pnl'), decimalCommaHint);
    const exitInfo = get('exitTime') ? parseCsvDate(get('exitTime')) : null;
    const comment = get('comment') || null;

    trades.push(
      buildPreview({
        dateInfo,
        pairRaw,
        direction,
        entryPrice,
        stopLoss,
        takeProfit,
        exitPrice,
        exitTime: exitInfo?.time ?? null,
        exitMs: exitInfo?.ms ?? null,
        lotSize,
        pnl,
        comment,
      })
    );
    if (trades.length >= MAX_IMPORT_TRADES) {
      addWarning(sink, `Import limité aux ${MAX_IMPORT_TRADES} premiers trades`);
      break;
    }
  }

  return {
    trades: trades.sort((a, b) => a.date.localeCompare(b.date)),
    warnings: finalizeWarnings(sink),
  };
}
