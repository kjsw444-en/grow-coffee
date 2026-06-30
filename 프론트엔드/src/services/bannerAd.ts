import { TossAds } from '@apps-in-toss/web-framework';
import {
  resolveImageBannerAdGroupId,
  resolveTextBannerAdGroupId,
} from './adsConfig';

export type BannerVariant = 'list' | 'feed';

let tossAdsInitialized = false;

function getBannerAdGroupId(variant: BannerVariant) {
  return variant === 'list' ? resolveTextBannerAdGroupId() : resolveImageBannerAdGroupId();
}

function isTossAdsInitializeSupported() {
  try {
    return TossAds.initialize.isSupported?.() !== false;
  } catch {
    return false;
  }
}

export function ensureTossAdsInitialized() {
  if (tossAdsInitialized) return;
  if (!isTossAdsInitializeSupported()) return;

  TossAds.initialize({});
  tossAdsInitialized = true;
}

export function initBannerAds() {
  ensureTossAdsInitialized();
}

export function isBannerAdSupported() {
  try {
    return TossAds.attachBanner.isSupported?.() !== false;
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
