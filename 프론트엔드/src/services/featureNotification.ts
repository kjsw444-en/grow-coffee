import { requestNotificationAgreement } from '@apps-in-toss/web-framework';
import { isTossInApp } from './tossBridge';

const FEATURE_ALERT_TEMPLATE_CODE = 'coffeegrow-FEATURE_ALERT';

export type FeatureNotificationAgreementResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export function requestFeatureNotificationAgreement(): Promise<FeatureNotificationAgreementResult> {
  if (!isTossInApp()) {
    return Promise.resolve({
      ok: false,
      message: '토스 앱에서 접속하면 새 기능 알림을 받을 수 있어요.',
    });
  }

  return new Promise((resolve) => {
    let cleanup: () => void = () => undefined;
    let settled = false;

    const finish = (result: FeatureNotificationAgreementResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    cleanup = requestNotificationAgreement({
      options: {
        templateCode: FEATURE_ALERT_TEMPLATE_CODE,
      },
      onEvent: ({ type }) => {
        if (type === 'newAgreement') {
          finish({ ok: true, message: '새로운 커피 기능 알림을 받을게요.' });
          return;
        }

        if (type === 'alreadyAgreed') {
          finish({ ok: true, message: '이미 새 기능 알림을 받고 있어요.' });
          return;
        }

        finish({ ok: false, message: '알림 수신을 선택하지 않았어요.' });
      },
      onError: () => {
        finish({ ok: false, message: '알림 동의 요청에 실패했어요. 잠시 후 다시 시도해 주세요.' });
      },
    });
  });
}
