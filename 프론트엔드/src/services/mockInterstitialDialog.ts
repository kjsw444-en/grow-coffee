import { resumeGameAudioAfterAd } from '../audio/resumeGameAudioAfterAd';

const OVERLAY_ATTR = 'data-mock-interstitial-overlay';

function removeExistingOverlay() {
  document.querySelector(`[${OVERLAY_ATTR}]`)?.remove();
}

export async function showMockInterstitialDialog(): Promise<boolean> {
  if (typeof document === 'undefined') {
    return true;
  }

  removeExistingOverlay();

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute(OVERLAY_ATTR, 'true');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mock-interstitial-title');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      display: 'grid',
      placeItems: 'center',
      padding: '16px',
      background: 'rgba(40, 36, 52, 0.55)',
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
    title.id = 'mock-interstitial-title';
    title.textContent = '전면 광고 대체창';
    Object.assign(title.style, {
      margin: '0 0 10px',
      fontSize: '18px',
      fontWeight: '800',
      color: '#5a4030',
      lineHeight: '1.45',
    });

    const subtitle = document.createElement('p');
    subtitle.textContent = '확인을 누르면 계속 진행할 수 있어요.';
    Object.assign(subtitle.style, {
      margin: '0 0 18px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#8a7568',
      lineHeight: '1.5',
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '닫기';
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
