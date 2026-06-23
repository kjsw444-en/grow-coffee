import { GoogleAdMob } from '@apps-in-toss/web-framework';
import { USE_MOCK_AD_WATCHED_DIALOG, showMockAdWatchedDialog } from './mockAdWatchedDialog';

/** 실광고 사용 시 mockAdWatchedDialog.ts 분기·파일 삭제 (파일 상단 주석 참고) */
export { USE_MOCK_AD_WATCHED_DIALOG };

const TEST_REWARDED_AD_GROUP_ID = 'ait-ad-test-rewarded-id';
const LOAD_TIMEOUT_MS = 20000;
const SHOW_TIMEOUT_MS = 120000;

let adStatus: 'idle' | 'loading' | 'loaded' | 'showing' = 'idle';
let requestInFlight = false;
let loadCleanup: (() => void) | null = null;
let loadPromise: Promise<boolean> | null = null;

function isTossPrivateTestHost() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('.private-apps.tossmini.com');
}

function getRewardedAdGroupId() {
  const configured = import.meta.env.VITE_TOSS_REWARDED_AD_GROUP_ID?.trim();
  const forceTest = import.meta.env.VITE_TOSS_USE_TEST_ADS === 'true';

  if (import.meta.env.DEV || forceTest || isTossPrivateTestHost()) {
    return TEST_REWARDED_AD_GROUP_ID;
  }

  return configured || TEST_REWARDED_AD_GROUP_ID;
}

export function isRewardedAdSupported() {
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

function preloadRewardedAd() {
  if (!isRewardedAdSupported()) {
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
    const adGroupId = getRewardedAdGroupId();
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

function showLoadedRewardedAd() {
  const adGroupId = getRewardedAdGroupId();

  return new Promise<{ rewarded: boolean; failed?: boolean; timedOut?: boolean }>((resolve, reject) => {
    let rewarded = false;
    let settled = false;

    const finish = (result: { rewarded: boolean; failed?: boolean; timedOut?: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      adStatus = 'idle';
      void preloadRewardedAd();
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({ rewarded: false, failed: true, timedOut: true });
    }, SHOW_TIMEOUT_MS);

    adStatus = 'showing';

    try {
      GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId },
        onEvent: (event) => {
          switch (event.type) {
            case 'userEarnedReward':
              rewarded = true;
              break;
            case 'dismissed':
              finish({ rewarded });
              break;
            case 'failedToShow':
              finish({ rewarded: false, failed: true });
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
          void preloadRewardedAd();
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

export function initRewardedAds() {
  if (!isRewardedAdSupported()) return;
  void preloadRewardedAd();
}

export async function watchRewardedAd(): Promise<boolean> {
  if (USE_MOCK_AD_WATCHED_DIALOG) {
    return showMockAdWatchedDialog();
  }

  if (!isRewardedAdSupported()) {
    return showMockAdWatchedDialog();
  }

  if (requestInFlight) {
    return false;
  }

  requestInFlight = true;

  try {
    if (adStatus !== 'loaded') {
      const loaded = await preloadRewardedAd();
      if (!loaded) {
        return showMockAdWatchedDialog();
      }
    }

    const result = await showLoadedRewardedAd();
    if (result.failed || !result.rewarded) {
      return false;
    }

    return true;
  } catch {
    return showMockAdWatchedDialog();
  } finally {
    requestInFlight = false;
  }
}
