import { DEFAULT_COFFEE_VARIANT_SLUG, type CoffeeVariantSlug } from './coffeeVariants';

/** 내린 커피 마시기 누적 — 리뷰 유도 기준 */
export const REVIEW_BREWED_SPENT_THRESHOLD = 200;

/** 커피 상점 유료 구매 횟수 — 리뷰 유도 기준 (기본 캐릭터 제외) */
export const REVIEW_SHOP_PURCHASE_THRESHOLD = 2;

export function getShopPurchaseCount(owned: readonly CoffeeVariantSlug[]) {
  return owned.filter((slug) => slug !== DEFAULT_COFFEE_VARIANT_SLUG).length;
}

export function hasCrossedBrewedSpentReviewThreshold(
  beforeSpent: number,
  afterSpent: number,
  threshold = REVIEW_BREWED_SPENT_THRESHOLD,
) {
  const before = Math.max(0, Math.floor(beforeSpent));
  const after = Math.max(0, Math.floor(afterSpent));
  return before < threshold && after >= threshold;
}

export function hasCrossedShopPurchaseReviewThreshold(
  beforeOwned: readonly CoffeeVariantSlug[],
  afterOwned: readonly CoffeeVariantSlug[],
  threshold = REVIEW_SHOP_PURCHASE_THRESHOLD,
) {
  return (
    getShopPurchaseCount(beforeOwned) < threshold &&
    getShopPurchaseCount(afterOwned) >= threshold
  );
}
