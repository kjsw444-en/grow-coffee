/** 75% 커피 단계 이미지·100% 마시기 영상 — 파일명 슬러그로 1:1 매칭 */

export const COFFEE_VARIANT_SLUGS = [
  'parttime-latte',
  'student-coldbrew',
  'blonde-hazelnut',
  'dolce-latte',
  'sexy-americano',
  'chic-vanilla-latte',
] as const;

export type CoffeeVariantSlug = (typeof COFFEE_VARIANT_SLUGS)[number];

/** 무료 기본 캐릭터 — 카페라떼 */
export const DEFAULT_COFFEE_VARIANT_SLUG: CoffeeVariantSlug = 'parttime-latte';

export const COFFEE_VARIANT_PURCHASE_COST = 100;

const COFFEE_IMAGE_VERSION = 4;
const COFFEE_VIDEO_VERSION = 6;

const COFFEE_VARIANT_LABELS: Record<CoffeeVariantSlug, string> = {
  'parttime-latte': '카페라떼',
  'student-coldbrew': '콜드브루',
  'blonde-hazelnut': '헤이즐넛',
  'dolce-latte': '돌체 라떼',
  'sexy-americano': '아메리카노',
  'chic-vanilla-latte': '바닐라 라떼',
};

export type CoffeeVariant = {
  id: CoffeeVariantSlug;
  label: string;
  image: string;
  video: string;
};

/** plant-coffee-{slug}.png ↔ coffee-drink-{slug}.mp4 */
export function coffeeVariantImageSrc(slug: CoffeeVariantSlug) {
  return `/images/plant/plant-coffee-${slug}.png?v=${COFFEE_IMAGE_VERSION}`;
}

export function coffeeVariantVideoSrc(slug: CoffeeVariantSlug) {
  return `/videos/coffee-drink-${slug}.mp4?v=${COFFEE_VIDEO_VERSION}`;
}

export const COFFEE_VARIANTS: CoffeeVariant[] = COFFEE_VARIANT_SLUGS.map((id) => ({
  id,
  label: COFFEE_VARIANT_LABELS[id],
  image: coffeeVariantImageSrc(id),
  video: coffeeVariantVideoSrc(id),
}));

export function isCoffeeVariantSlug(value: string): value is CoffeeVariantSlug {
  return (COFFEE_VARIANT_SLUGS as readonly string[]).includes(value);
}

export function getCoffeeVariantById(id: CoffeeVariantSlug): CoffeeVariant {
  return COFFEE_VARIANTS.find((variant) => variant.id === id) ?? COFFEE_VARIANTS[0];
}

export function getPurchasableCoffeeVariants(): CoffeeVariant[] {
  return COFFEE_VARIANTS.filter((variant) => variant.id !== DEFAULT_COFFEE_VARIANT_SLUG);
}

export function normalizeOwnedCoffeeVariants(raw: unknown): CoffeeVariantSlug[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',').map((item) => item.trim())
      : [];

  const owned = new Set<CoffeeVariantSlug>([DEFAULT_COFFEE_VARIANT_SLUG]);
  for (const slug of list) {
    if (typeof slug === 'string' && isCoffeeVariantSlug(slug)) {
      owned.add(slug);
    }
  }
  return [...owned];
}

export function normalizeSelectedCoffeeVariant(
  raw: unknown,
  owned: readonly CoffeeVariantSlug[],
): CoffeeVariantSlug {
  const slug = String(raw || '').trim();
  if (isCoffeeVariantSlug(slug) && owned.includes(slug)) {
    return slug;
  }
  return DEFAULT_COFFEE_VARIANT_SLUG;
}

export function getAvailableCoffeeCups(state: {
  totalCoffees: number;
  spentCoffeeCups?: number;
}) {
  return Math.max(0, Math.floor(Number(state.totalCoffees) || 0));
}

/** 랭킹용 — 상점에서 비운(사용한) 커피잔 누적 */
export function getEmptiedCoffeeCups(state: { spentCoffeeCups?: number }) {
  return Math.max(0, Math.floor(Number(state.spentCoffeeCups) || 0));
}

const COFFEE_VARIANT_GROWTH_MIN = 75;
const preloadedVideos = new Set<string>();

/** 75% 이상 — 서버에 저장된 선택 캐릭터 사용 */
export function getActiveCoffeeVariant(
  growth: number,
  selectedSlug: CoffeeVariantSlug | null | undefined,
): CoffeeVariant | null {
  if (growth < COFFEE_VARIANT_GROWTH_MIN) {
    return null;
  }
  if (selectedSlug && isCoffeeVariantSlug(selectedSlug)) {
    return getCoffeeVariantById(selectedSlug);
  }
  return getCoffeeVariantById(DEFAULT_COFFEE_VARIANT_SLUG);
}

/** 75% 도달 시 매칭 영상 미리 받아 두기 */
export function preloadCoffeeVariantVideo(variant: CoffeeVariant) {
  if (typeof document === 'undefined' || preloadedVideos.has(variant.video)) {
    return;
  }

  preloadedVideos.add(variant.video);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = variant.video;
  video.load();
}

export function getNextCoffeeVariantFallback(
  currentId: CoffeeVariantSlug,
  blockedIds: readonly CoffeeVariantSlug[],
): CoffeeVariant | null {
  const blocked = new Set<CoffeeVariantSlug>([currentId, ...blockedIds]);
  return COFFEE_VARIANTS.find((variant) => !blocked.has(variant.id)) ?? null;
}
