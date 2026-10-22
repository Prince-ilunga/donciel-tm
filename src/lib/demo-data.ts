// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Compte démo public
// Un compte partagé "demo@donciel.tm" contenant un jeu de
// données réaliste (10 trades ICT + captures) pour permettre
// aux visiteurs de tester l'application sans créer de compte.
//
// Sécurité :
//  - Le compte démo est en LECTURE SEULE : toutes les mutations
//    (POST/PUT/DELETE trades, notes, playbooks, uploads…)
//    sont refusées via isDemoAccount() + requireNotDemo().
//  - La route /api/demo/login est rate-limitée pour éviter
//    les abus.
// ─────────────────────────────────────────────────────────────

import demoData from './demo-data.json';

export const DEMO_EMAIL = 'demo@donciel.tm';
export const DEMO_NAME = 'Compte Démo';

export interface DemoScreenshot {
  type: string;
  url: string;
}

export interface DemoTrade {
  date: string;
  pair: string;
  direction: string;
  session: string | null;
  marketCondition: string | null;
  setup: string | null;
  entryModel: string | null;
  structure: string | null;
  confluence: string | null;
  timeframe: string | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  exitPrice: number | null;
  entryTime: string | null;
  exitTime: string | null;
  lotSize: number | null;
  pnl: number | null;
  rr: number | null;
  result: string | null;
  duration: string | null;
  emotions: string | null;
  mistakes: string | null;
  lessons: string | null;
  notes: string | null;
  newsEnabled: boolean;
  screenshots: DemoScreenshot[];
}

export const DEMO_TRADES: DemoTrade[] = demoData as DemoTrade[];

/** true si l'utilisateur connecté est le compte démo partagé */
export function isDemoAccount(email?: string | null): boolean {
  return email === DEMO_EMAIL;
}
