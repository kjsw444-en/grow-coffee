import { GROWTH_PER_WATER } from './constants';
import { roundGrowth } from './passiveGrowth';



/** growth 0~100% 클램프 — 방치 성장은 물주기 횟수와 무관 */

export function sanitizeGrowthForWaters(growth: number) {

  return roundGrowth(Math.min(100, Math.max(0, growth)));

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



/** 물·브루 꾹 누르기 중 게이지 — 커피나무 growth만 (방치와 분리) */

export function previewHoldDisplayGrowth(
  authStartGrowth: number,
  _displayStartGrowth: number,
  holdProgress: number,
) {
  return previewHoldGrowth(authStartGrowth, holdProgress);
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



/** @deprecated 방치는 커피나무 growth와 분리 — authoritativeGrowth만 반환 */

export function previewPassiveDisplayGrowth(authoritativeGrowth: number) {

  return roundGrowth(Math.min(100, Math.max(0, authoritativeGrowth)));

}



/** 단계·영상·마시기 판정용 — display가 앞서가도 state만 신뢰 */

export function isReadyToDrinkGrowth(authoritativeGrowth: number) {

  return roundGrowth(authoritativeGrowth) >= 100;

}

