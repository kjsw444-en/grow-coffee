import { GoogleAdMob } from '@apps-in-toss/web-framework';
import { resumeGameAudioAfterAd } from '../audio/resumeGameAudioAfterAd';
import { resolveRewardedAdGroupId } from './adsConfig';
import {
  shouldUseMockRewardedAd,
  showMockAdWatchedDialog,
} from './mockAdWatchedDialog';
import {
  getRewardedAdPurposeCopy,
  type RewardedAdPurpose,
} from './rewardedAdPurpose';

export { type RewardedAdPurpose } from './rewardedAdPurpose';
export { USE_MOCK_AD_WATCHED_DIALOG } from './mockAdWatchedDialog';

const LOAD_TIMEOUT_MS = 20000;
const SHOW_TIMEOUT_MS = 120000;

let adStatus: 'idle' | 'loading' | 'loaded' | 'showing' = 'idle';
let requestInFlight = false;
let loadCleanup: (() => void) | null = null;
let loadPromise: Promise<boolean> | null = null;

function getRewardedAdGroupId() {
  return resolveRewardedAdGroupId();
}

export function isRewardedAdSupported() {
  if (shouldUseMockRewardedAd()) {
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
      resumeGameAudioAfterAd();
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
  if (shouldUseMockRewardedAd() || !isRewardedAdSupported()) return;
  void preloadRewardedAd();
}

export async function watchRewardedAd(purpose: RewardedAdPurpose): Promise<boolean> {
  const mockCopy = getRewardedAdPurposeCopy(purpose);

  const useMock = shouldUseMockRewardedAd();

  if (useMock) {
    return showMockAdWatchedDialog(mockCopy);
  }

  if (!isRewardedAdSupported()) {
    return false;
  }

  if (requestInFlight) {
    return false;
  }

  requestInFlight = true;

  try {
    if (adStatus !== 'loaded') {
      const loaded = await preloadRewardedAd();
      if (!loaded) {
        return false;
      }
    }

    const result = await showLoadedRewardedAd();
    return !result.failed && result.rewarded;
  } catch {
    return false;
  } finally {
    requestInFlight = false;
  }
}
