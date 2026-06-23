import { GoogleAdMob } from '@apps-in-toss/web-framework';
import {
  LIVE_INTERSTITIAL_AD_GROUP_ID,
  TEST_INTERSTITIAL_AD_GROUP_ID,
} from './adsConfig';
import { USE_MOCK_AD_WATCHED_DIALOG } from './mockAdWatchedDialog';
import { showMockInterstitialDialog } from './mockInterstitialDialog';

const LOAD_TIMEOUT_MS = 20000;
const SHOW_TIMEOUT_MS = 120000;
const DRINKS_PER_INTERSTITIAL = 4;

let adStatus: 'idle' | 'loading' | 'loaded' | 'showing' = 'idle';
let requestInFlight = false;
let loadCleanup: (() => void) | null = null;
let loadPromise: Promise<boolean> | null = null;

function getInterstitialAdGroupId() {
  const configured = import.meta.env.VITE_TOSS_INTERSTITIAL_AD_GROUP_ID?.trim();
  const forceTest = import.meta.env.VITE_TOSS_USE_TEST_ADS === 'true';

  if (forceTest) {
    return configured || TEST_INTERSTITIAL_AD_GROUP_ID;
  }

  return configured || LIVE_INTERSTITIAL_AD_GROUP_ID;
}

export function shouldUseMockInterstitialAd() {
  if (USE_MOCK_AD_WATCHED_DIALOG) {
    return true;
  }

  const adGroupId = import.meta.env.VITE_TOSS_INTERSTITIAL_AD_GROUP_ID?.trim();
  return !adGroupId;
}

export function isInterstitialAdSupported() {
  if (shouldUseMockInterstitialAd()) {
    return false;
  }

  try {
    return (
      GoogleAdMob.loadAppsInTossAdMob.isSupported() === true &&
      GoogleAdMob.showAppsInTossAdMob.isSupported() === true
    );
  } catch {
    return false;
  }
}

function resetLoadCleanup() {
  loadCleanup?.();
  loadCleanup = null;
}

function preloadInterstitialAd() {
  if (!isInterstitialAdSupported()) {
    return Promise.resolve(false);
  }

  if (adStatus === 'loaded') {
    return Promise.resolve(true);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve) => {
    adStatus = 'loading';
    const adGroupId = getInterstitialAdGroupId();
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      loadPromise = null;
      adStatus = ok ? 'loaded' : 'idle';
      resetLoadCleanup();
      resolve(ok);
    };

    const timeoutId = window.setTimeout(() => finish(false), LOAD_TIMEOUT_MS);

    try {
      loadCleanup = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type !== 'loaded') return;
          finish(true);
        },
        onError: () => finish(false),
      });
    } catch {
      finish(false);
    }
  });

  return loadPromise;
}

function showLoadedInterstitialAd() {
  const adGroupId = getInterstitialAdGroupId();

  return new Promise<{ shown: boolean; failed?: boolean; timedOut?: boolean }>((resolve, reject) => {
    let settled = false;

    const finish = (result: { shown: boolean; failed?: boolean; timedOut?: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      adStatus = 'idle';
      void preloadInterstitialAd();
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({ shown: false, failed: true, timedOut: true });
    }, SHOW_TIMEOUT_MS);

    adStatus = 'showing';

    try {
      GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId },
        onEvent: (event) => {
          switch (event.type) {
            case 'dismissed':
              finish({ shown: true });
              break;
            case 'failedToShow':
              finish({ shown: false, failed: true });
              break;
            default:
              break;
          }
        },
        onError: (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          adStatus = 'idle';
          resetLoadCleanup();
          loadPromise = null;
          void preloadInterstitialAd();
          reject(error);
        },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      adStatus = 'idle';
      loadPromise = null;
      reject(error);
    }
  });
}

export function initInterstitialAds() {
  if (shouldUseMockInterstitialAd() || !isInterstitialAdSupported()) return;
  void preloadInterstitialAd();
}

export async function showInterstitialAd(): Promise<boolean> {
  if (shouldUseMockInterstitialAd()) {
    return showMockInterstitialDialog();
  }

  if (!isInterstitialAdSupported()) {
    return showMockInterstitialDialog();
  }

  if (requestInFlight) {
    return false;
  }

  requestInFlight = true;

  try {
    if (adStatus !== 'loaded') {
      const loaded = await preloadInterstitialAd();
      if (!loaded) {
        return showMockInterstitialDialog();
      }
    }

    const result = await showLoadedInterstitialAd();
    if (result.failed || !result.shown) {
      return showMockInterstitialDialog();
    }

    return true;
  } catch {
    return showMockInterstitialDialog();
  } finally {
    requestInFlight = false;
  }
}

export function getDrinksPerInterstitial() {
  return DRINKS_PER_INTERSTITIAL;
}

export function shouldShowDrinkCycleInterstitial(drinkCount: number) {
  return drinkCount > 0 && drinkCount % DRINKS_PER_INTERSTITIAL === 0;
}
