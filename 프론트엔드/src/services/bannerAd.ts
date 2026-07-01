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

  TossAds.initialize({
    callbacks: {
      onInitialized: () => {
        tossAdsInitialized = true;
        console.log('[banner-ad] initialized');
      },
      onInitializationFailed: (error) => {
        tossAdsInitialized = false;
        console.warn('[banner-ad] initialize-failed', error);
      },
    },
  });
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
    console.warn('[banner-ad] unsupported', { variant });
    return null;
  }

  ensureTossAdsInitialized();

  try {
    const adGroupId = getBannerAdGroupId(variant);
    let attachFailedSynchronously = false;
    const result = TossAds.attachBanner(adGroupId, target, {
      theme: options?.theme ?? 'auto',
      tone: 'grey',
      variant: options?.bannerShape ?? 'card',
      callbacks: {
        onAdRendered: (payload) => {
          console.log('[banner-ad] rendered', { variant, adGroupId: payload.adGroupId });
        },
        onAdFailedToRender: (payload) => {
          attachFailedSynchronously = true;
          console.warn('[banner-ad] failed-to-render', {
            variant,
            adGroupId: payload.adGroupId || adGroupId,
            error: payload.error,
          });
        },
        onNoFill: (payload) => {
          console.warn('[banner-ad] no-fill', {
            variant,
            adGroupId: payload.adGroupId || adGroupId,
          });
        },
      },
    });
    if (attachFailedSynchronously) {
      result.destroy();
      return null;
    }
    return result.destroy;
  } catch (error) {
    console.warn('[banner-ad] attach-threw', { variant, error });
    return null;
  }
}
