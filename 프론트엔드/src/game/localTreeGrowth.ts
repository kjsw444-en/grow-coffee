import { GROWTH_PER_WATER } from './constants';
import { roundGrowth } from './passiveGrowth';

const KEY_PREFIX = 'grow-coffee:local-tree-growth:';

export function readLocalTreeGrowth(userId: string) {
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${userId}`);
    if (!raw) return 0;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 100) return 0;
    return roundGrowth(parsed);
  } catch {
    return 0;
  }
}

export function writeLocalTreeGrowth(userId: string, growth: number) {
  try {
    const value = roundGrowth(growth);
    if (value <= 0 || value >= 100) {
      sessionStorage.removeItem(`${KEY_PREFIX}${userId}`);
      return;
    }
    sessionStorage.setItem(`${KEY_PREFIX}${userId}`, String(value));
  } catch {
    // sessionStorage unavailable — in-memory only for this tab
  }
}

export function clearLocalTreeGrowth(userId: string) {
  try {
    sessionStorage.removeItem(`${KEY_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}

/** 100% 확정 API 호출 시 — 서버에 아직 반영 안 된 로컬 물주기 횟수 */
export function getPendingLocalWaters(holdStartGrowth: number, serverGrowth: number) {
  const holdWaters = Math.floor(roundGrowth(holdStartGrowth) / GROWTH_PER_WATER);
  const serverWaters = Math.floor(roundGrowth(serverGrowth) / GROWTH_PER_WATER);
  return Math.max(0, holdWaters - serverWaters);
}

export function isHybridLocalTreeGrowth(growth: number) {
  const value = roundGrowth(growth);
  return value > 0 && value < 100;
}
