import {
  DEFAULT_COFFEE_VARIANT_SLUG,
  isCoffeeVariantSlug,
} from './coffeeVariants.js'

export const HIDDEN_COFFEE_LOCKED_LABEL = '❤️💕 하트 히든 커피'

export const HIDDEN_COFFEE_VARIANTS = [
  {
    id: 'hidden-hazelnut-m-cafe-latte-f',
    requiredMale: 'm-blonde-hazelnut',
    requiredFemale: 'parttime-latte',
  },
  {
    id: 'hidden-cafe-latte-m-hazelnut-f',
    requiredMale: 'm-parttime-latte',
    requiredFemale: 'blonde-hazelnut',
  },
  {
    id: 'hidden-dolce-m-americano-f',
    requiredMale: 'm-dolce-latte',
    requiredFemale: 'sexy-americano',
  },
  {
    id: 'hidden-americano-m-dolce-f',
    requiredMale: 'm-sexy-americano',
    requiredFemale: 'dolce-latte',
  },
  {
    id: 'hidden-vanilla-m-dolce-f',
    requiredMale: 'm-chic-vanilla-latte',
    requiredFemale: 'dolce-latte',
  },
  {
    id: 'hidden-americano-m-vanilla-f',
    requiredMale: 'm-sexy-americano',
    requiredFemale: 'chic-vanilla-latte',
  },
]

const HIDDEN_BY_ID = new Map(HIDDEN_COFFEE_VARIANTS.map((entry) => [entry.id, entry]))

export function isHiddenCoffeeVariantSlug(value) {
  return HIDDEN_BY_ID.has(String(value || ''))
}

export function isHiddenCoffeeUnlocked(slug, owned) {
  const hidden = HIDDEN_BY_ID.get(String(slug || ''))
  if (!hidden) return false
  return owned.includes(hidden.requiredMale) && owned.includes(hidden.requiredFemale)
}

export function normalizeSelectedCoffeeVariant(raw, owned) {
  const slug = String(raw || '').trim()

  if (isHiddenCoffeeVariantSlug(slug) && isHiddenCoffeeUnlocked(slug, owned)) {
    return slug
  }

  if (isCoffeeVariantSlug(slug) && owned.includes(slug)) {
    return slug
  }

  return DEFAULT_COFFEE_VARIANT_SLUG
}
