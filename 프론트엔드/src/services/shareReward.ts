import { contactsViral } from '@apps-in-toss/web-framework';
import type { GameState } from '../game/types';
import { SHARE_REWARD_COFFEE_AMOUNT, SHARE_REWARD_MODULE_ID } from '../game/constants';
import { ApiRequestError, claimShareRewardGame, isBackendConfigured } from './api';
import { isTossInApp } from './tossBridge';

export type ShareRewardOutcome =
  | { status: 'rewarded'; amount: number; state: GameState; playerRank?: number | null }
  | { status: 'already-claimed'; message: string; state?: GameState }
  | { status: 'cancelled'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string; state?: GameState };

type ShareRewardFlowOptions = {
  onMessage?: (message: string) => void;
};

async function claimShareRewardOnServer() {
  return claimShareRewardGame(SHARE_REWARD_MODULE_ID);
}

async function runDevShareRewardFlow(onMessage?: ShareRewardFlowOptions['onMessage']): Promise<ShareRewardOutcome> {
  if (!isBackendConfigured()) {
    return {
      status: 'unsupported',
      message: '백엔드 서버를 실행해 주세요.',
    };
  }

  onMessage?.('개발 환경에서 공유 리워드를 테스트해요...');

  try {
    const result = await claimShareRewardOnServer();
    return {
      status: 'rewarded',
      amount: result.rewardAmount ?? SHARE_REWARD_COFFEE_AMOUNT,
      state: result.state,
      playerRank: result.playerRank ?? null,
    };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.message.includes('이미')) {
        return { status: 'already-claimed', message: error.message, state: error.state };
      }
      return { status: 'error', message: error.message, state: error.state };
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : '공유 리워드 지급에 실패했어요.',
    };
  }
}

function runTossShareRewardFlow(onMessage?: ShareRewardFlowOptions['onMessage']): Promise<ShareRewardOutcome> {
  return new Promise((resolve) => {
    let cleanup: (() => void) | null = null;
    let claimPromise: Promise<ShareRewardOutcome | null> | null = null;
    let rewarded = false;
    let rewardState: GameState | null = null;
    let rewardPlayerRank: number | null = null;
    let settled = false;

    const finish = (outcome: ShareRewardOutcome) => {
      if (settled) return;
      settled = true;
      cleanup?.();
      cleanup = null;
      resolve(outcome);
    };

    const settleClose = async (closeReason: 'clickBackButton' | 'noReward') => {
      if (claimPromise) {
        try {
          const claimOutcome = await claimPromise;
          if (claimOutcome?.status === 'rewarded') {
            rewarded = true;
            rewardState = claimOutcome.state;
            rewardPlayerRank = claimOutcome.playerRank ?? null;
          } else if (claimOutcome?.status === 'already-claimed') {
            finish(claimOutcome);
            return;
          } else if (claimOutcome?.status === 'error') {
            finish(claimOutcome);
            return;
          }
        } catch (error) {
          if (error instanceof ApiRequestError) {
            if (error.message.includes('이미')) {
              finish({ status: 'already-claimed', message: error.message, state: error.state });
              return;
            }
            finish({ status: 'error', message: error.message, state: error.state });
            return;
          }

          finish({
            status: 'error',
            message: error instanceof Error ? error.message : '공유 리워드 지급에 실패했어요.',
          });
          return;
        }
      }

      if (rewarded && rewardState) {
        finish({
          status: 'rewarded',
          amount: SHARE_REWARD_COFFEE_AMOUNT,
          state: rewardState,
          playerRank: rewardPlayerRank,
        });
        return;
      }

      if (closeReason === 'noReward') {
        finish({
          status: 'already-claimed',
          message: '오늘 공유 리워드는 이미 받았어요. 내일 다시 시도해 주세요.',
        });
        return;
      }

      finish({ status: 'cancelled', message: '공유를 마쳤어요.' });
    };

    try {
      onMessage?.('친구 선택 화면을 여는 중...');
      cleanup = contactsViral({
        options: { moduleId: SHARE_REWARD_MODULE_ID },
        onEvent: (event) => {
          if (event.type === 'sendViral') {
            if (rewarded || claimPromise) return;

            claimPromise = claimShareRewardOnServer()
              .then((result) => {
                rewarded = true;
                rewardState = result.state;
                onMessage?.(`공유 완료! 내린 커피 ${result.rewardAmount ?? SHARE_REWARD_COFFEE_AMOUNT}잔을 받았어요.`);
                return {
                  status: 'rewarded' as const,
                  amount: result.rewardAmount ?? SHARE_REWARD_COFFEE_AMOUNT,
                  state: result.state,
                  playerRank: result.playerRank ?? null,
                };
              })
              .catch((error) => {
                if (error instanceof ApiRequestError && error.message.includes('이미')) {
                  return {
                    status: 'already-claimed' as const,
                    message: error.message,
                    state: error.state,
                  };
                }
                throw error;
              });
            return;
          }

          if (event.type === 'close') {
            void settleClose(event.data.closeReason);
          }
        },
        onError: (error) => {
          finish({
            status: 'error',
            message: error instanceof Error ? error.message : '공유 리워드 중 오류가 발생했어요.',
          });
        },
      });
    } catch {
      finish({
        status: 'unsupported',
        message: '토스 앱 5.223.0 이상에서 공유 리워드를 사용할 수 있어요.',
      });
    }
  });
}

export async function runShareRewardFlow(
  options: ShareRewardFlowOptions = {},
): Promise<ShareRewardOutcome> {
  if (!isTossInApp()) {
    if (import.meta.env.DEV) {
      return runDevShareRewardFlow(options.onMessage);
    }

    return {
      status: 'unsupported',
      message: '공유 리워드는 토스 앱에서 이용할 수 있어요.',
    };
  }

  return runTossShareRewardFlow(options.onMessage);
}

export function shareRewardStatusMessage(outcome: ShareRewardOutcome) {
  switch (outcome.status) {
    case 'rewarded':
      return `공유 완료! 내린 커피 ${outcome.amount}잔을 받았어요.`;
    case 'already-claimed':
      return outcome.message;
    case 'cancelled':
      return outcome.message;
    case 'unsupported':
      return outcome.message;
    case 'error':
      return outcome.message;
    default:
      return '공유를 처리하지 못했어요.';
  }
}
