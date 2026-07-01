/**
 * MOCK_AD_WATCHED_DIALOG — 실광고 ID 연동 전 테스트용
 *
 * 실광고 전환 시:
 * 1. mockAdWatchedDialog.ts 삭제 또는 USE_MOCK_AD_WATCHED_DIALOG = false
 * 2. rewardedAd.ts mock 분기 제거
 * 3. .env에 VITE_TOSS_REWARDED_AD_GROUP_ID 설정
 */

import { resolveRewardedAdGroupId } from './adsConfig';
import { shouldUseMockTossAds } from './adEnvironment';
import { resumeGameAudioAfterAd } from '../audio/resumeGameAudioAfterAd';

/** false — 앱인토스 live 광고 ID로 전면·리워드 광고 노출 */
export const USE_MOCK_AD_WATCHED_DIALOG = false;

const OVERLAY_ATTR = 'data-mock-ad-watched-overlay';

/** 실광고 ID가 없으면 mock 사용 */
export function shouldUseMockRewardedAd() {
  if (USE_MOCK_AD_WATCHED_DIALOG) {
    return true;
  }

  if (shouldUseMockTossAds()) {
    return true;
  }

  return !resolveRewardedAdGroupId();
}

function removeExistingOverlay() {
  document.querySelector(`[${OVERLAY_ATTR}]`)?.remove();
}

export async function showMockAdWatchedDialog(subtitleText?: string): Promise<boolean> {
  if (typeof document === 'undefined') {
    return true;
  }

  removeExistingOverlay();

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute(OVERLAY_ATTR, 'true');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mock-ad-watched-title');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      display: 'grid',
      placeItems: 'center',
      padding: '16px',
      background: 'rgba(110, 104, 136, 0.42)',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: 'min(100%, 320px)',
      padding: '24px 20px 18px',
      borderRadius: '20px',
      background: '#fffaf4',
      border: '1px solid #e8d4b0',
      boxShadow: '0 16px 36px rgba(90, 70, 50, 0.18)',
      textAlign: 'center',
    });

    const title = document.createElement('p');
    title.id = 'mock-ad-watched-title';
    title.textContent = '리워드 광고 대체창';
    Object.assign(title.style, {
      margin: '0 0 10px',
      fontSize: '18px',
      fontWeight: '800',
      color: '#5a4030',
      lineHeight: '1.45',
    });

    const subtitle = document.createElement('p');
    subtitle.textContent =
      subtitleText ?? '확인을 누르면 리워드를 받을 수 있어요.';
    Object.assign(subtitle.style, {
      margin: '0 0 18px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#8a7568',
      lineHeight: '1.5',
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '확인';
    Object.assign(button.style, {
      minWidth: '120px',
      minHeight: '44px',
      padding: '0 18px',
      border: 'none',
      borderRadius: '14px',
      background: 'linear-gradient(180deg, #f0d8a8 0%, #e4c080 100%)',
      color: '#5a3c20',
      fontSize: '15px',
      fontWeight: '800',
      cursor: 'pointer',
    });

    const finish = (watched: boolean) => {
      window.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      if (watched) resumeGameAudioAfterAd();
      resolve(watched);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      }
    };

    button.addEventListener('click', () => finish(true));
    window.addEventListener('keydown', onKeyDown);

    card.append(title, subtitle, button);
    overlay.append(card);
    document.body.append(overlay);
    button.focus();
  });
}
