import { getTossShareLink, share } from '@apps-in-toss/web-framework';
import { isTossInApp, TOSS_APP_NAME } from './tossBridge';

const SHARE_MESSAGE = '☕ 커피 키우기 같이 키워요!';

type ShareOptions = {
  onMessage?: (message: string) => void;
};

async function openTossShare(onMessage?: ShareOptions['onMessage']) {
  const link = await getTossShareLink(`intoss://${TOSS_APP_NAME}`);
  await share({
    message: `${SHARE_MESSAGE}\n\n${link}`,
  });
  onMessage?.('공유 화면을 열었어요.');
  return { shared: true };
}

async function openDevShare(onMessage?: ShareOptions['onMessage']) {
  const link =
    typeof window !== 'undefined'
      ? window.location.origin + window.location.pathname
      : `intoss://${TOSS_APP_NAME}`;
  const message = `${SHARE_MESSAGE}\n\n${link}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ text: message, title: '커피 키우기' });
    onMessage?.('공유 화면을 열었어요.');
    return { shared: true };
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message);
    onMessage?.('공유 링크를 복사했어요.');
    return { shared: true };
  }

  onMessage?.('공유를 열지 못했어요. 토스 앱에서 다시 시도해 주세요.');
  return { shared: false };
}

export async function shareWithCoffeeFriends({ onMessage }: ShareOptions = {}) {
  try {
    if (isTossInApp()) {
      return await openTossShare(onMessage);
    }

    return await openDevShare(onMessage);
  } catch {
    onMessage?.('공유를 열지 못했어요. 잠시 후 다시 시도해 주세요.');
    return { shared: false };
  }
}
