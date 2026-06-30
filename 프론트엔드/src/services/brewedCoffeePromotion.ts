import { grantPromotionRewardForGame } from '@apps-in-toss/web-framework';
import type { GameState } from '../game/types';
import {
  BREWED_COFFEE_DRINK_OPTIONS,
  getBrewedCoffeePointReward,
  type BrewedCoffeeDrinkOption,
} from '../game/brewedCoffeeDrink';
import { recordBrewedCoffeePromotionClaim } from './api';
import { isTossInApp } from './tossBridge';

export type BrewedCoffeePromotionResult =
  | {
      ok: true;
      rewardKey: string;
      amount: number;
      cupCount: BrewedCoffeeDrinkOption;
      mocked?: boolean;
      alreadyClaimed?: boolean;
      message: string;
      state?: GameState;
    }
  | { ok: false; message: string; skipped?: boolean };

export function getCoffeeValuePromotionCode() {
  return import.meta.env.VITE_TOSS_COFFEE_VALUE_PROMOTION_CODE?.trim() ?? '';
}

export function isBrewedCoffeePromotionMockEnabled() {
  if (!import.meta.env.DEV) {
    return false;
  }

  const forced =
    import.meta.env.VITE_MOCK_BREWED_COFFEE_PROMOTION === '1' ||
    import.meta.env.VITE_MOCK_BREWED_COFFEE_PROMOTION === 'true';

  if (forced) {
    return true;
  }

  return !getCoffeeValuePromotionCode();
}

export function getBrewedCoffeePromotionSuccessMessage(amount: number, mocked = false) {
  const formatted = amount.toLocaleString('ko-KR');
  if (mocked) {
    return `테스트 지급 완료! 실제 ${formatted}원은 토스 앱에서만 받을 수 있어요.`;
  }
  return `토스로 ${formatted}원이 지급됐어요! 토스 앱 → 포인트에서 확인해 주세요.`;
}

function isValidDrinkOption(cupCount: number): cupCount is BrewedCoffeeDrinkOption {
  return (BREWED_COFFEE_DRINK_OPTIONS as readonly number[]).includes(cupCount);
}

async function finalizeBrewedCoffeeClaim(
  cupCount: BrewedCoffeeDrinkOption,
  amount: number,
  rewardKey: string,
  mocked = false,
): Promise<BrewedCoffeePromotionResult> {
  const recorded = await recordBrewedCoffeePromotionClaim({
    rewardKey,
    cupCount,
    amount,
  });

  if (!recorded.ok) {
    return { ok: false, message: '프로모션 지급 기록에 실패했어요. 고객센터에 문의해 주세요.' };
  }

  return {
    ok: true,
    rewardKey: recorded.rewardKey ?? rewardKey,
    amount,
    cupCount,
    mocked,
    alreadyClaimed: recorded.alreadyClaimed,
    message: getBrewedCoffeePromotionSuccessMessage(amount, mocked),
    state: recorded.state,
  };
}

async function claimBrewedCoffeePromotionMock(
  cupCount: BrewedCoffeeDrinkOption,
  amount: number,
): Promise<BrewedCoffeePromotionResult> {
  const rewardKey = `dev-mock-brewed-${cupCount}-${crypto.randomUUID()}`;
  return finalizeBrewedCoffeeClaim(cupCount, amount, rewardKey, true);
}

export async function claimBrewedCoffeePromotion(
  cupCount: number,
  amount: number,
): Promise<BrewedCoffeePromotionResult> {
  if (!isValidDrinkOption(cupCount)) {
    return { ok: false, message: '프로모션 지급 가능한 잔 수가 아니에요.', skipped: true };
  }

  const expectedAmount = getBrewedCoffeePointReward(cupCount);
  const normalizedAmount = Math.floor(Number(amount) || 0);
  if (normalizedAmount <= 0 || normalizedAmount !== expectedAmount) {
    return { ok: false, message: '프로모션 지급 금액을 확인할 수 없어요.', skipped: true };
  }

  if (isBrewedCoffeePromotionMockEnabled()) {
    return claimBrewedCoffeePromotionMock(cupCount, normalizedAmount);
  }

  if (!isTossInApp()) {
    return {
      ok: false,
      message: '토스 앱에서만 커피값 프로모션을 받을 수 있어요.',
      skipped: true,
    };
  }

  const promotionCode = getCoffeeValuePromotionCode();
  if (!promotionCode) {
    return { ok: false, message: '커피값 프로모션 코드가 아직 설정되지 않았어요.', skipped: true };
  }

  try {
    const result = await grantPromotionRewardForGame({
      params: {
        promotionCode,
        amount: normalizedAmount,
      },
    });

    if (!result) {
      return { ok: false, message: '토스 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.' };
    }

    if (result === 'ERROR') {
      return { ok: false, message: '토스 프로모션 지급 중 알 수 없는 오류가 발생했어요.' };
    }

    if ('errorCode' in result) {
      return {
        ok: false,
        message: result.message || `토스 프로모션 지급에 실패했어요. (${result.errorCode})`,
      };
    }

    return finalizeBrewedCoffeeClaim(cupCount, normalizedAmount, result.key);
  } catch {
    return { ok: false, message: '토스 프로모션 지급 요청에 실패했어요. 잠시 후 다시 시도해 주세요.' };
  }
}
