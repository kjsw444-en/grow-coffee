import { TossAds } from '@apps-in-toss/web-framework';
import {
  LIVE_IMAGE_BANNER_AD_GROUP_ID,
  LIVE_TEXT_BANNER_AD_GROUP_ID,
  TEST_FEED_BANNER_AD_GROUP_ID,
  TEST_LIST_BANNER_AD_GROUP_ID,
} from './adsConfig';

export type BannerVariant = 'list' | 'feed';

let tossAdsInitialized = false;

function getBannerAdGroupId(variant: BannerVariant) {
  const configured =
    variant === 'list'
      ? import.meta.env.VITE_TOSS_TEXT_BANNER_AD_GROUP_ID?.trim()
      : import.meta.env.VITE_TOSS_IMAGE_BANNER_AD_GROUP_ID?.trim();
  const forceTest = import.meta.env.VITE_TOSS_USE_TEST_ADS === 'true';
  const liveFallback = variant === 'list' ? LIVE_TEXT_BANNER_AD_GROUP_ID : LIVE_IMAGE_BANNER_AD_GROUP_ID;
  const testFallback = variant === 'list' ? TEST_LIST_BANNER_AD_GROUP_ID : TEST_FEED_BANNER_AD_GROUP_ID;

  if (forceTest) {
    return configured || testFallback;
  }

  return configured || liveFallback;
}

function ensureTossAdsInitialized() {
  if (tossAdsInitialized) return;
  if (TossAds.initialize.isSupported?.() !== true) return;

  TossAds.initialize({});
  tossAdsInitialized = true;
}

export function isBannerAdSupported() {
  try {
    return TossAds.attachBanner.isSupported?.() === true;
  } catch {
    return false;
  }
}

export function attachBannerToElement(
  target: HTMLElement,
  variant: BannerVariant,
  options?: {
    bannerShape?: 'card' | 'expanded';
    theme?: 'auto' | 'light' | 'dark';
  },
): (() => void) | null {
  if (!isBannerAdSupported()) {
    return null;
  }

  ensureTossAdsInitialized();

  try {
    const result = TossAds.attachBanner(getBannerAdGroupId(variant), target, {
      theme: options?.theme ?? 'auto',
      tone: 'grey',
      variant: options?.bannerShape ?? 'card',
    });
    return result.destroy;
  } catch {
    return null;
  }
}
