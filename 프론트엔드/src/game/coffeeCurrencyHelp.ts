import { GOAL_AMOUNT, SHARE_REWARD_COFFEE_AMOUNT } from './constants';
import { BREWED_COFFEE_DRINK_OPTIONS } from './brewedCoffeeDrink';
import { formatDrunkCoffeePurchaseCost } from './coffeeVariants';

/** 내린 커피(totalCoffees) · 마신 커피(spentCoffeeCups) — gameLogic.js 와 동일 규칙 */
export const BREWED_COFFEE_HELP = {
  title: '내린 커피 안내',
  earnTitle: '어떻게 모이나요?',
  earnLines: [
    '물주기로 단계를 올린 뒤 커피나무 100% 「커피 마시기」 → +1잔 (커피나무 성장 초기화)',
    '방치 커피 「받기」 → +1잔 (햇빛, 하루 최대 2잔)',
    `친구 공유 → +${SHARE_REWARD_COFFEE_AMOUNT}잔 (하루 1번)`,
    '미니게임 클리어 → +1잔 (극악·불가능 난이도 +3잔, 미션당 하루 1번)',
  ],
  spendTitle: '어디에 쓰이나요?',
  spendLines: [
    `「내린 커피 마시기」에서만 쓰여요 — ${BREWED_COFFEE_DRINK_OPTIONS.join('·')}잔 선택, 내린 −N, 커피값(원) +`,
    `${GOAL_AMOUNT.toLocaleString('ko-KR')}원 모아서 진짜 커피 한잔 드세요!`,
  ],
} as const;

export const DRUNK_COFFEE_HELP = {
  title: '마신 커피 안내',
  earnTitle: '어떻게 모이나요?',
  earnLines: [
    '내린 커피를 「내린 커피 마시기」로 쓸 때만 올라가요.',
    '쓴 내린 커피 잔 수와 1:1로 같이 올라갑니다.',
    `선택 가능: ${BREWED_COFFEE_DRINK_OPTIONS.join('·')}잔`,
  ],
  spendTitle: '어디에 쓰이나요?',
  spendLines: [
    `커피 상점 캐릭터 구매 — ${formatDrunkCoffeePurchaseCost()} 필요`,
    '커피나무 「커피 마시기」나 방치·공유·미니게임으로는 올라가지 않아요.',
  ],
} as const;
