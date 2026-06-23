import { GROWTH_PER_WATER } from './constants';
import { roundGrowth } from './passiveGrowth';

/** 물주기 횟수 대비 growth 상한 — DB/클라이언트 불일치(100% 착시) 방지 */
export function sanitizeGrowthForWaters(growth: number, totalWaters: number) {
  const waters = Math.max(0, Math.floor(Number(totalWaters) || 0));
  const maxAllowed = Math.min(100, waters * GROWTH_PER_WATER);
  const value = roundGrowth(growth);
  const capped = Math.min(value, maxAllowed);
  const milestone = Math.floor(capped / GROWTH_PER_WATER) * GROWTH_PER_WATER;
  return roundGrowth(Math.min(maxAllowed, milestone));
}

/** 물·브루 꾹 누르기 중 게이지 미리보기 — state.growth 기준만 사용 */
export function previewHoldGrowth(startGrowth: number, holdProgress: number) {
  const progress = Math.min(100, Math.max(0, holdProgress));
  const start = roundGrowth(startGrowth);
  const raw = Math.min(100, start + GROWTH_PER_WATER * (progress / 100));

  if (raw >= 100 && !isReadyToDrinkGrowth(start)) {
    return PRE_DRINK_DISPLAY_MAX;
  }

  return roundGrowth(raw);
}

/** 물·브루 1회 완료 후 확정 성장치 */
export function commitWaterGrowth(startGrowth: number) {
  return roundGrowth(Math.min(100, startGrowth + GROWTH_PER_WATER));
}

/** 물 1회당 서버 growth — holdStart 기준 +25%를 넘으면 클램프 */
export function resolveWaterSyncGrowth(holdStartGrowth: number, serverGrowth: number) {
  const start = roundGrowth(holdStartGrowth);
  const expected = commitWaterGrowth(start);
  const server = roundGrowth(serverGrowth);

  if (server > expected) return expected;
  return server;
}

/** 100%·영상 단계는 물주기 확정(state) 후에만 */
export const PRE_DRINK_DISPLAY_MAX = 99.9999999;

/** 방치 게이지는 다음 물주기(+25%) 직전까지만 미리보기 */
export function maxPassiveDisplayGrowth(authoritativeGrowth: number) {
  const authoritative = roundGrowth(authoritativeGrowth);
  if (authoritative >= 100) return 100;

  const nextMilestone = commitWaterGrowth(authoritative);
  if (nextMilestone >= 100) {
    return PRE_DRINK_DISPLAY_MAX;
  }

  return roundGrowth(nextMilestone - 0.0000001);
}

/** 방치 성장 게이지 — 서버 확정치(state) + 미동기 미리보기 */
export function previewPassiveDisplayGrowth(
  authoritativeGrowth: number,
  passivePreviewDelta: number,
) {
  const cap = maxPassiveDisplayGrowth(authoritativeGrowth);
  return roundGrowth(Math.min(cap, authoritativeGrowth + passivePreviewDelta));
}

/** 단계·영상·마시기 판정용 — display가 앞서가도 state만 신뢰 */
export function isReadyToDrinkGrowth(authoritativeGrowth: number) {
  return roundGrowth(authoritativeGrowth) >= 100;
}
