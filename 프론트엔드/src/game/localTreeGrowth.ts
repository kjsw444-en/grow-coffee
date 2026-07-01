import { GROWTH_PER_WATER } from './constants';
import { roundGrowth } from './passiveGrowth';

const KEY_PREFIX = 'grow-coffee:local-tree-growth:';

function readStorage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function readLocalTreeGrowth(userId: string) {
  const storage = readStorage();
  if (!storage) return 0;

  try {
    const raw = storage.getItem(`${KEY_PREFIX}${userId}`);
    if (!raw) return 0;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 100) return 0;
    return roundGrowth(parsed);
  } catch {
    return 0;
  }
}

export function writeLocalTreeGrowth(userId: string, growth: number) {
  const storage = readStorage();
  if (!storage) return;

  try {
    const value = roundGrowth(growth);
    if (value <= 0 || value >= 100) {
      storage.removeItem(`${KEY_PREFIX}${userId}`);
      return;
    }
    storage.setItem(`${KEY_PREFIX}${userId}`, String(value));
  } catch {
    // storage unavailable — in-memory only for this tab
  }
}

export function clearLocalTreeGrowth(userId: string) {
  const storage = readStorage();
  if (!storage) return;

  try {
    storage.removeItem(`${KEY_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}

/** 서버 동기화 전 — 화면·메모리·localStorage 중 가장 앞선 성장률 */
export function getHybridGrowthFloor(
  stateGrowth: number,
  displayGrowth: number,
  storedGrowth = 0,
) {
  return roundGrowth(Math.max(stateGrowth, displayGrowth, storedGrowth));
}

/** 하이브리드 — 서버 growth는 100% 확정 전까지 0으로 간주 */
export function normalizeHybridServerGrowth(serverGrowth: number) {
  return roundGrowth(serverGrowth) >= 100 ? 100 : 0;
}

/** pending 계산용 — ref만 100%인데 이번 사이클(75% 등) 미완이면 미동기화(0%)로 간주 */
export function serverGrowthForPending(holdStartGrowth: number, serverGrowth: number) {
  const hold = roundGrowth(holdStartGrowth);
  const server = roundGrowth(serverGrowth);
  if (server >= 100 && hold < 100) return 0;
  return normalizeHybridServerGrowth(server);
}

/** 100% 확정 API 호출 시 — 서버에 아직 반영 안 된 로컬 물주기 횟수 */
export function getPendingLocalWaters(
  holdStartGrowth: number,
  serverGrowth: number,
  options?: { finalStroke?: boolean },
) {
  const holdWaters = Math.floor(roundGrowth(holdStartGrowth) / GROWTH_PER_WATER);
  const serverWaters = Math.floor(
    serverGrowthForPending(holdStartGrowth, serverGrowth) / GROWTH_PER_WATER,
  );
  let pending = Math.max(0, holdWaters - serverWaters);
  if (options?.finalStroke && roundGrowth(holdStartGrowth + GROWTH_PER_WATER) >= 100) {
    pending = Math.max(pending, holdWaters);
  }
  return pending;
}

export function isHybridLocalTreeGrowth(growth: number) {
  const value = roundGrowth(growth);
  return value > 0 && value < 100;
}
