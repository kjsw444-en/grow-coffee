export const FEMALE_COFFEE_VARIANT_SLUGS = [
  'parttime-latte',
  'student-coldbrew',
  'blonde-hazelnut',
  'dolce-latte',
  'sexy-americano',
  'chic-vanilla-latte',
]

export const MALE_COFFEE_VARIANT_SLUGS = [
  'm-parttime-latte',
  'm-student-coldbrew',
  'm-blonde-hazelnut',
  'm-dolce-latte',
  'm-sexy-americano',
  'm-chic-vanilla-latte',
]

export const COFFEE_VARIANT_SLUGS = [...FEMALE_COFFEE_VARIANT_SLUGS, ...MALE_COFFEE_VARIANT_SLUGS]

/** 무료 기본 캐릭터 — 여성 카페라떼 */
export const DEFAULT_COFFEE_VARIANT_SLUG = 'parttime-latte'

export const COFFEE_VARIANT_PURCHASE_COST = 100

export function formatDrunkCoffeePurchaseCost(amount = COFFEE_VARIANT_PURCHASE_COST) {
  return `마신 커피 ${Math.max(0, Math.floor(Number(amount) || 0)).toLocaleString('ko-KR')}잔`
}

export function isCoffeeVariantSlug(value) {
  return COFFEE_VARIANT_SLUGS.includes(String(value || ''))
}

export function getPurchasableCoffeeVariantSlugs() {
  return COFFEE_VARIANT_SLUGS.filter((slug) => slug !== DEFAULT_COFFEE_VARIANT_SLUG)
}

export function normalizeOwnedCoffeeVariants(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : []

  const owned = new Set([DEFAULT_COFFEE_VARIANT_SLUG])
  for (const slug of list) {
    if (isCoffeeVariantSlug(slug)) {
      owned.add(slug)
    }
  }
  return [...owned]
}

export { normalizeSelectedCoffeeVariant } from './hiddenCoffeeVariants.js'

export function getAvailableCoffeeCups(state) {
  return Math.max(0, Math.floor(Number(state.spentCoffeeCups) || 0))
}
