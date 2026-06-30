import { grantPromotionRewardForGame } from '@apps-in-toss/web-framework';
import type { GameState } from '../game/types';
import {
  devResetRankingTop3Promotion,
  fetchRankingTop3PromotionStatus,
  recordRankingTop3PromotionClaim,
} from './api';
import { isTossInApp } from './tossBridge';

const STORAGE_KEY = 'grow-coffee-ranking-top3-claims';
export const RANKING_TOP3_PROMOTION_AMOUNT = 4700;

export function formatRankingTop3PromotionAmount() {
  return RANKING_TOP3_PROMOTION_AMOUNT.toLocaleString('ko-KR');
}

/** 랭킹 보상 수령 성공 대화 */
export function getRankingTop3ClaimSuccessMessage(mocked = false) {
  const amount = formatRankingTop3PromotionAmount();
  if (mocked) {
    return `테스트 지급 완료! 실제 ${amount}원은 토스 앱에서만 받을 수 있어요.`;
  }
  return `토스로 ${amount}원이 지급됐어요! 게임 상단 커피값은 오늘 적립이라 그대로일 수 있어요. 토스 앱 → 포인트에서 확인해 주세요.`;
}

/** 랭킹 보상 수령 전 안내 */
export function getRankingTop3ClaimPromptMessage(playerRank: number) {
  return `${playerRank}위 축하해요! 토스 포인트 ${formatRankingTop3PromotionAmount()}원을 받을 수 있어요. (게임 상단 커피값과는 별개예요)`;
}

/** 이미 수령한 경우 안내 */
export function getRankingTop3AlreadyClaimedMessage(playerRank: number) {
  return `${playerRank}위 토스 보상 ${formatRankingTop3PromotionAmount()}원은 이미 받았어요. 토스 앱 → 포인트에서 확인해 주세요.`;
}

type PromotionClaimStore = Record<string, { rewardKey: string; claimedAt: number }>;

type RankingTop3PromotionResult =
  | {
      ok: true;
      rewardKey: string;
      mocked?: boolean;
      alreadyClaimed?: boolean;
      playerRank: number;
      rewardDayKey: string;
      message: string;
      state?: GameState;
    }
  | { ok: false; message: string };

function getPromotionCode() {
  return import.meta.env.VITE_TOSS_RANKING_TOP3_PROMOTION_CODE?.trim() ?? '';
}

function getClaimKey(userId: string, rewardDayKey: string) {
  return `ranking-top3:${userId || 'anonymous'}:${rewardDayKey}`;
}

function loadStore(): PromotionClaimStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: PromotionClaimStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** DEV — 프로모션 코드·토스 앱 없이 랭킹 보상 지급 플로우만 검증 */
export function isRankingTop3PromotionMockEnabled() {
  if (!import.meta.env.DEV) {
    return false;
  }

  const forced =
    import.meta.env.VITE_MOCK_RANKING_TOP3_PROMOTION === '1' ||
    import.meta.env.VITE_MOCK_RANKING_TOP3_PROMOTION === 'true';

  if (forced) {
    return true;
  }

  return !getPromotionCode();
}

export function hasClaimedRankingTop3Promotion(userId: string, rewardDayKey: string) {
  const store = loadStore();
  return Boolean(store[getClaimKey(userId, rewardDayKey)]);
}

export async function resetRankingTop3PromotionForTest(userId: string, rewardDayKey?: string) {
  if (!import.meta.env.DEV || !userId) {
    return;
  }

  const status = await fetchRankingTop3PromotionStatus().catch(() => null);
  const dayKey = rewardDayKey ?? status?.rewardDayKey ?? '';
  if (!dayKey) {
    return;
  }

  await devResetRankingTop3Promotion().catch(() => undefined);

  const store = loadStore();
  delete store[getClaimKey(userId, dayKey)];
  saveStore(store);
}

async function finalizeRankingTop3Claim(
  userId: string,
  rewardDayKey: string,
  rewardKey: string,
  mocked = false,
): Promise<RankingTop3PromotionResult> {
  const recorded = await recordRankingTop3PromotionClaim(rewardKey);

  if (recorded.alreadyClaimed) {
    return {
      ok: false,
      message: '어제 랭킹 보상은 이미 받았어요.',
    };
  }

  const store = loadStore();
  store[getClaimKey(userId, rewardDayKey)] = {
    rewardKey: recorded.rewardKey ?? rewardKey,
    claimedAt: Date.now(),
  };
  saveStore(store);

  return {
    ok: true,
    rewardKey: recorded.rewardKey ?? rewardKey,
    mocked,
    playerRank: recorded.playerRank,
    rewardDayKey: recorded.rewardDayKey,
    message: recorded.message,
    state: recorded.state,
  };
}

async function claimRankingTop3PromotionMock(
  userId: string,
  rewardDayKey: string,
): Promise<RankingTop3PromotionResult> {
  const rewardKey = `dev-mock-rank-${crypto.randomUUID()}`;
  return finalizeRankingTop3Claim(userId, rewardDayKey, rewardKey, true);
}

export async function claimRankingTop3Promotion(userId: string): Promise<RankingTop3PromotionResult> {
  if (!userId) {
    return { ok: false, message: '로그인 정보를 불러온 뒤 다시 시도해 주세요.' };
  }

  let status;
  try {
    status = await fetchRankingTop3PromotionStatus();
  } catch {
    return { ok: false, message: '랭킹 보상 상태를 확인할 수 없어요.' };
  }

  if (!status.canClaim) {
    if (status.claimed) {
      return { ok: false, message: '어제 랭킹 보상은 이미 받았어요.' };
    }
    return { ok: false, message: '어제 마감 랭킹 1위~3위만 받을 수 있어요.' };
  }

  const rewardDayKey = status.rewardDayKey;
  if (hasClaimedRankingTop3Promotion(userId, rewardDayKey)) {
    return { ok: false, message: '어제 랭킹 보상은 이미 받았어요.' };
  }

  if (isRankingTop3PromotionMockEnabled()) {
    return claimRankingTop3PromotionMock(userId, rewardDayKey);
  }

  if (!isTossInApp()) {
    return { ok: false, message: '토스 앱에서만 랭킹 보상을 받을 수 있어요.' };
  }

  const promotionCode = getPromotionCode();
  if (!promotionCode) {
    return { ok: false, message: '랭킹 보상 프로모션 코드가 아직 설정되지 않았어요.' };
  }

  try {
    const result = await grantPromotionRewardForGame({
      params: {
        promotionCode,
        amount: RANKING_TOP3_PROMOTION_AMOUNT,
      },
    });

    if (!result) {
      return { ok: false, message: '토스 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.' };
    }

    if (result === 'ERROR') {
      return { ok: false, message: '랭킹 보상 지급 중 알 수 없는 오류가 발생했어요.' };
    }

    if ('errorCode' in result) {
      return {
        ok: false,
        message: result.message || `랭킹 보상 지급에 실패했어요. (${result.errorCode})`,
      };
    }

    return finalizeRankingTop3Claim(userId, rewardDayKey, result.key);
  } catch {
    return { ok: false, message: '랭킹 보상 지급 요청에 실패했어요. 잠시 후 다시 시도해 주세요.' };
  }
}
