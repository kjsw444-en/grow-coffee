/** 75% 커피 단계 이미지·100% 마시기 영상 — 커피 종류별 남·여 1쌍 */

import { buildCoffeeVideoSrc, COFFEE_VIDEO_VERSION } from '../services/mediaAssets';

export type CoffeeVariantGender = 'female' | 'male';

export type CoffeeDrinkLineId =
  | 'cafe-latte'
  | 'coldbrew'
  | 'hazelnut'
  | 'dolce-latte'
  | 'americano'
  | 'vanilla-latte';

/** 커피 종류 6 × (여성 + 남성) — 기존 여성 슬러그는 저장 호환을 위해 유지 */
export const COFFEE_DRINK_LINES = [
  {
    id: 'cafe-latte',
    label: '카페라떼',
    female: 'parttime-latte',
    male: 'm-parttime-latte',
    defaultFree: 'female' as const,
  },
  {
    id: 'coldbrew',
    label: '콜드브루',
    female: 'student-coldbrew',
    male: 'm-student-coldbrew',
  },
  {
    id: 'hazelnut',
    label: '헤이즐넛',
    female: 'blonde-hazelnut',
    male: 'm-blonde-hazelnut',
  },
  {
    id: 'dolce-latte',
    label: '돌체 라떼',
    female: 'dolce-latte',
    male: 'm-dolce-latte',
  },
  {
    id: 'americano',
    label: '아메리카노',
    female: 'sexy-americano',
    male: 'm-sexy-americano',
  },
  {
    id: 'vanilla-latte',
    label: '바닐라 라떼',
    female: 'chic-vanilla-latte',
    male: 'm-chic-vanilla-latte',
  },
] as const satisfies ReadonlyArray<{
  id: CoffeeDrinkLineId;
  label: string;
  female: string;
  male: string;
  defaultFree?: 'female';
}>;

export type CoffeeDrinkLine = (typeof COFFEE_DRINK_LINES)[number];

export const FEMALE_COFFEE_VARIANT_SLUGS = COFFEE_DRINK_LINES.map((line) => line.female) as [
  'parttime-latte',
  'student-coldbrew',
  'blonde-hazelnut',
  'dolce-latte',
  'sexy-americano',
  'chic-vanilla-latte',
];

export const MALE_COFFEE_VARIANT_SLUGS = COFFEE_DRINK_LINES.map((line) => line.male) as [
  'm-parttime-latte',
  'm-student-coldbrew',
  'm-blonde-hazelnut',
  'm-dolce-latte',
  'm-sexy-americano',
  'm-chic-vanilla-latte',
];

export const COFFEE_VARIANT_SLUGS = [
  ...FEMALE_COFFEE_VARIANT_SLUGS,
  ...MALE_COFFEE_VARIANT_SLUGS,
] as const;

export type CoffeeVariantSlug = (typeof COFFEE_VARIANT_SLUGS)[number];
export type FemaleCoffeeVariantSlug = (typeof FEMALE_COFFEE_VARIANT_SLUGS)[number];
export type MaleCoffeeVariantSlug = (typeof MALE_COFFEE_VARIANT_SLUGS)[number];

/** 무료 기본 — 카페라떼 여성 */
export const DEFAULT_COFFEE_VARIANT_SLUG: CoffeeVariantSlug = 'parttime-latte';

export const COFFEE_VARIANT_PURCHASE_COST = 100;

export function formatDrunkCoffeePurchaseCost(
  amount: number = COFFEE_VARIANT_PURCHASE_COST,
): string {
  return `마신 커피 ${amount.toLocaleString('ko-KR')}잔`;
}

const COFFEE_IMAGE_VERSION = 5;

const SLUG_TO_LINE = new Map<CoffeeVariantSlug, CoffeeDrinkLine>(
  COFFEE_DRINK_LINES.flatMap((line) => [
    [line.female as CoffeeVariantSlug, line],
    [line.male as CoffeeVariantSlug, line],
  ]),
);

/** 남성 캐릭터 상점·75% 이미지 — 동일 커피 종류 여성 에셋 재사용 */
const MALE_IMAGE_SLUG_BY_VARIANT = new Map<CoffeeVariantSlug, CoffeeVariantSlug>(
  COFFEE_DRINK_LINES.map((line) => [line.male as CoffeeVariantSlug, line.female as CoffeeVariantSlug]),
);

export function getCoffeeVariantImageSlug(slug: CoffeeVariantSlug): CoffeeVariantSlug {
  return MALE_IMAGE_SLUG_BY_VARIANT.get(slug) ?? slug;
}

export type CoffeeVariant = {
  id: CoffeeVariantSlug;
  /** 커피 종류명 — 아메리카노, 돌체 라떼 … */
  drinkLabel: string;
  drinkLineId: CoffeeDrinkLineId;
  gender: CoffeeVariantGender;
  genderLabel: '여성' | '남성';
  /** @deprecated drinkLabel 사용 */
  label: string;
  image: string;
  video: string;
};

export function coffeeVariantImageSrc(slug: CoffeeVariantSlug) {
  const imageSlug = getCoffeeVariantImageSlug(slug);
  return `/images/plant/plant-coffee-${imageSlug}.png?v=${COFFEE_IMAGE_VERSION}`;
}

export function coffeeVariantVideoSrc(slug: CoffeeVariantSlug) {
  return buildCoffeeVideoSrc(`coffee-drink-${slug}.mp4`, COFFEE_VIDEO_VERSION);
}

function buildCoffeeVariant(id: CoffeeVariantSlug): CoffeeVariant {
  const line = SLUG_TO_LINE.get(id) ?? COFFEE_DRINK_LINES[0];
  const gender: CoffeeVariantGender = id === line.female ? 'female' : 'male';

  return {
    id,
    drinkLabel: line.label,
    drinkLineId: line.id,
    gender,
    genderLabel: gender === 'female' ? '여성' : '남성',
    label: line.label,
    image: coffeeVariantImageSrc(id),
    video: coffeeVariantVideoSrc(id),
  };
}

export const COFFEE_VARIANTS: CoffeeVariant[] = COFFEE_VARIANT_SLUGS.map((id) =>
  buildCoffeeVariant(id),
);

export const FEMALE_COFFEE_VARIANTS = COFFEE_VARIANTS.filter((variant) => variant.gender === 'female');
export const MALE_COFFEE_VARIANTS = COFFEE_VARIANTS.filter((variant) => variant.gender === 'male');

export function getCoffeeDrinkLine(lineId: CoffeeDrinkLineId): CoffeeDrinkLine {
  return COFFEE_DRINK_LINES.find((line) => line.id === lineId) ?? COFFEE_DRINK_LINES[0];
}

export function getCoffeeDrinkLineBySlug(slug: CoffeeVariantSlug): CoffeeDrinkLine {
  return SLUG_TO_LINE.get(slug) ?? COFFEE_DRINK_LINES[0];
}

export function getCoffeeVariantGender(slug: CoffeeVariantSlug): CoffeeVariantGender {
  return buildCoffeeVariant(slug).gender;
}

export function formatCoffeeVariantName(variant: CoffeeVariant) {
  return `${variant.drinkLabel} · ${variant.genderLabel}`;
}

export function isDefaultFreeVariant(slug: CoffeeVariantSlug) {
  return slug === DEFAULT_COFFEE_VARIANT_SLUG;
}

export function getCoffeeVariantsByGender(gender: CoffeeVariantGender): CoffeeVariant[] {
  return gender === 'female' ? FEMALE_COFFEE_VARIANTS : MALE_COFFEE_VARIANTS;
}

export function isCoffeeVariantSlug(value: string): value is CoffeeVariantSlug {
  return (COFFEE_VARIANT_SLUGS as readonly string[]).includes(value);
}

export function getCoffeeVariantById(id: CoffeeVariantSlug): CoffeeVariant {
  return COFFEE_VARIANTS.find((variant) => variant.id === id) ?? buildCoffeeVariant(DEFAULT_COFFEE_VARIANT_SLUG);
}

export function getPurchasableCoffeeVariants(): CoffeeVariant[] {
  return COFFEE_VARIANTS.filter((variant) => !isDefaultFreeVariant(variant.id));
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

export function getAvailableCoffeeCups(state: {
  totalCoffees?: number;
  spentCoffeeCups?: number;
}) {
  return Math.max(0, Math.floor(Number(state.spentCoffeeCups) || 0));
}

export function getEmptiedCoffeeCups(state: { spentCoffeeCups?: number }) {
  return Math.max(0, Math.floor(Number(state.spentCoffeeCups) || 0));
}

const COFFEE_VARIANT_GROWTH_MIN = 75;
const preloadedVideos = new Set<string>();

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
  const line = getCoffeeDrinkLineBySlug(currentId);
  const sameLineOtherGender =
    currentId === line.female
      ? (line.male as CoffeeVariantSlug)
      : (line.female as CoffeeVariantSlug);

  if (!blocked.has(sameLineOtherGender)) {
    return getCoffeeVariantById(sameLineOtherGender);
  }

  const sameGender = getCoffeeVariantGender(currentId);
  return getCoffeeVariantsByGender(sameGender).find((variant) => !blocked.has(variant.id)) ?? null;
}
