/**
 * MOCK_AD_WATCHED_DIALOG — 실광고 연동 전 테스트용
 *
 * 일괄 삭제 방법 (「광고를봤습니다 창 일괄 삭제해줘」):
 * 1. 이 파일 삭제
 * 2. rewardedAd.ts 에서 USE_MOCK_AD_WATCHED_DIALOG import·분기 제거
 * 3. adBridge.ts 삭제
 */

export const USE_MOCK_AD_WATCHED_DIALOG = true;

const OVERLAY_ATTR = 'data-mock-ad-watched-overlay';

function removeExistingOverlay() {
  document.querySelector(`[${OVERLAY_ATTR}]`)?.remove();
}

export async function showMockAdWatchedDialog(): Promise<boolean> {
  if (typeof document === 'undefined') {
    return true;
  }

  removeExistingOverlay();

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute(OVERLAY_ATTR, 'true');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      display: 'grid',
      placeItems: 'center',
      padding: '16px',
      background: 'rgba(110, 104, 136, 0.35)',
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

    const message = document.createElement('p');
    message.textContent = '광고를 봤습니다.';
    Object.assign(message.style, {
      margin: '0 0 18px',
      fontSize: '17px',
      fontWeight: '800',
      color: '#5a4030',
      lineHeight: '1.45',
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
      overlay.remove();
      resolve(watched);
    };

    button.addEventListener('click', () => finish(true));

    card.append(message, button);
    overlay.append(card);
    document.body.append(overlay);
    button.focus();
  });
}
