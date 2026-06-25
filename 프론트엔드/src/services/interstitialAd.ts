import { GoogleAdMob } from '@apps-in-toss/web-framework';
import { resolveInterstitialAdGroupId } from './adsConfig';
import { USE_MOCK_AD_WATCHED_DIALOG } from './mockAdWatchedDialog';
import { showMockInterstitialDialog } from './mockInterstitialDialog';

const LOAD_TIMEOUT_MS = 20000;
const SHOW_TIMEOUT_MS = 120000;

let adStatus: 'idle' | 'loading' | 'loaded' | 'showing' = 'idle';
let requestInFlight = false;
let loadCleanup: (() => void) | null = null;
let loadPromise: Promise<boolean> | null = null;

function isTossInApp() {
  if (typeof window === 'undefined') return false;

  return (
    window.location.hostname.endsWith('.apps.tossmini.com') ||
    window.location.hostname.endsWith('.private-apps.tossmini.com')
  );
}

function getInterstitialAdGroupId() {
  return resolveInterstitialAdGroupId();
}

export function shouldUseMockInterstitialAd() {
  if (USE_MOCK_AD_WATCHED_DIALOG) {
    return true;
  }

  if (!isTossInApp()) {
    return true;
  }

  return !resolveInterstitialAdGroupId();
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
    return showMockInterstitialDialog();
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
