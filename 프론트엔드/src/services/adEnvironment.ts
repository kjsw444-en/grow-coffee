import { isTossInApp } from './tossBridge';

/**
 * 토스 미니앱(출시·샌드박스) 안에서만 AdMob SDK로 실광고를 띄웁니다.
 * PC 브라우저·로컬 Vite 등은 광고 대체창을 사용합니다.
 */
export function isRealAdsEnvironment() {
  return isTossInApp();
}

/** true — 리워드/전면 광고 대체창 사용 */
export function shouldUseMockTossAds() {
  if (import.meta.env.VITE_FORCE_MOCK_ADS === 'true') {
    return true;
  }

  return !isRealAdsEnvironment();
}
