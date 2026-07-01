import {
  DEFAULT_COFFEE_VARIANT_SLUG,
  formatCoffeeVariantName,
  getCoffeeVariantById,
  getNextCoffeeVariantFallback,
  isCoffeeVariantSlug,
  type CoffeeVariantSlug,
} from './coffeeVariants';
import { buildCoffeeVideoSrc, HIDDEN_VIDEO_VERSION } from '../services/mediaAssets';
import { preloadCoffeeVideoBlob } from './coffeeVideoBlobCache';
import { drinkPreviewImageSrc } from './drinkPreviewImages';

/** 상점 잠금 상태 표시명 */
export const HIDDEN_COFFEE_LOCKED_LABEL = '❤️💕 하트 히든 커피';

/**
 * 히든 커플 영상 6종 — requiredMale + requiredFemale 보유 시 해금
 * 영상 파일: 백엔드 /assets/videos/coffee-drink-{videoFile}.mp4
 */
export const HIDDEN_COFFEE_VARIANTS = [
  {
    id: 'hidden-hazelnut-m-cafe-latte-f',
    requiredMale: 'm-blonde-hazelnut',
    requiredFemale: 'parttime-latte',
    videoFile: 'hidden-hazelnut-m-cafe-latte-f',
  },
  {
    id: 'hidden-cafe-latte-m-hazelnut-f',
    requiredMale: 'm-parttime-latte',
    requiredFemale: 'blonde-hazelnut',
    videoFile: 'hidden-cafe-latte-m-hazelnut-f',
  },
  {
    id: 'hidden-dolce-m-americano-f',
    requiredMale: 'm-dolce-latte',
    requiredFemale: 'sexy-americano',
    videoFile: 'hidden-dolce-m-americano-f',
  },
  {
    id: 'hidden-dolce-m-dolce-f',
    requiredMale: 'm-dolce-latte',
    requiredFemale: 'dolce-latte',
    videoFile: 'hidden-dolce-m-dolce-f',
  },
  {
    id: 'hidden-vanilla-m-dolce-f',
    requiredMale: 'm-chic-vanilla-latte',
    requiredFemale: 'dolce-latte',
    videoFile: 'hidden-vanilla-m-dolce-f',
  },
  {
    id: 'hidden-americano-m-vanilla-f',
    requiredMale: 'm-sexy-americano',
    requiredFemale: 'chic-vanilla-latte',
    videoFile: 'hidden-americano-m-vanilla-f',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  requiredMale: CoffeeVariantSlug;
  requiredFemale: CoffeeVariantSlug;
  videoFile: string;
}>;

export type HiddenCoffeeVariantSlug = (typeof HIDDEN_COFFEE_VARIANTS)[number]['id'];
export type SelectedCoffeeSlug = CoffeeVariantSlug | HiddenCoffeeVariantSlug;

export type HiddenCoffeeVariant = {
  id: HiddenCoffeeVariantSlug;
  requiredMale: CoffeeVariantSlug;
  requiredFemale: CoffeeVariantSlug;
  lockedLabel: string;
  unlockedLabel: string;
  unlockHint: string;
  video: string;
};

export type CoffeePlayback = {
  id: SelectedCoffeeSlug;
  label: string;
  image: string;
  video: string;
  drinkPreviewImage: string;
};

const HIDDEN_ID_SET = new Set<string>(HIDDEN_COFFEE_VARIANTS.map((entry) => entry.id));

let hiddenByIdCache: Map<HiddenCoffeeVariantSlug, HiddenCoffeeVariant> | null = null;

function getHiddenByIdMap(): Map<HiddenCoffeeVariantSlug, HiddenCoffeeVariant> {
  if (hiddenByIdCache) return hiddenByIdCache;

  hiddenByIdCache = new Map(
    HIDDEN_COFFEE_VARIANTS.map((entry) => {
      const male = getCoffeeVariantById(entry.requiredMale);
      const female = getCoffeeVariantById(entry.requiredFemale);
      const unlockedLabel = formatHiddenUnlockedLabel(entry.requiredMale, entry.requiredFemale);
      const unlockHint = `${male.drinkLabel} 남자 + ${female.drinkLabel} 여자 보유 시 해금`;

      return [
        entry.id,
        {
          id: entry.id,
          requiredMale: entry.requiredMale,
          requiredFemale: entry.requiredFemale,
          lockedLabel: HIDDEN_COFFEE_LOCKED_LABEL,
          unlockedLabel,
          unlockHint,
          video: buildCoffeeVideoSrc(`coffee-drink-${entry.videoFile}.mp4`, HIDDEN_VIDEO_VERSION),
        },
      ];
    }),
  );

  return hiddenByIdCache;
}

export function getHiddenCoffeePairVariants(hidden: HiddenCoffeeVariant | HiddenCoffeeVariantSlug) {
  const entry = typeof hidden === 'string' ? getHiddenCoffeeVariantById(hidden) : hidden;
  return {
    male: getCoffeeVariantById(entry.requiredMale),
    female: getCoffeeVariantById(entry.requiredFemale),
  };
}

export function getHiddenCoffeePlaybackImage(hidden: HiddenCoffeeVariant | HiddenCoffeeVariantSlug) {
  return getHiddenCoffeePairVariants(hidden).female.image;
}

export function formatHiddenUnlockedLabel(
  maleSlug: CoffeeVariantSlug,
  femaleSlug: CoffeeVariantSlug,
): string {
  const male = getCoffeeVariantById(maleSlug);
  const female = getCoffeeVariantById(femaleSlug);
  return `${male.drinkLabel} 남자, ${female.drinkLabel} 여자 히든 커피`;
}

export function getHiddenCoffeeVariantById(id: HiddenCoffeeVariantSlug): HiddenCoffeeVariant {
  const map = getHiddenByIdMap();
  return map.get(id) ?? map.get(HIDDEN_COFFEE_VARIANTS[0].id)!;
}

export function getHiddenCoffeeVariants(): HiddenCoffeeVariant[] {
  return HIDDEN_COFFEE_VARIANTS.map((entry) => getHiddenCoffeeVariantById(entry.id));
}

export function isHiddenCoffeeVariantSlug(value: string): value is HiddenCoffeeVariantSlug {
  return HIDDEN_ID_SET.has(value);
}

export function isSelectedCoffeeSlug(value: string): value is SelectedCoffeeSlug {
  return isCoffeeVariantSlug(value) || isHiddenCoffeeVariantSlug(value);
}

export function isHiddenCoffeeUnlocked(
  slug: HiddenCoffeeVariantSlug,
  owned: readonly CoffeeVariantSlug[],
): boolean {
  const hidden = getHiddenCoffeeVariantById(slug);
  return owned.includes(hidden.requiredMale) && owned.includes(hidden.requiredFemale);
}

export function getUnlockedHiddenCoffeeSlugs(
  owned: readonly CoffeeVariantSlug[],
): HiddenCoffeeVariantSlug[] {
  return HIDDEN_COFFEE_VARIANTS.filter((entry) => isHiddenCoffeeUnlocked(entry.id, owned)).map(
    (entry) => entry.id,
  );
}

/** 구매 등으로 처음 해금된 히든 1종 (없으면 null) */
export function getFirstNewlyUnlockedHidden(
  beforeOwned: readonly CoffeeVariantSlug[],
  afterOwned: readonly CoffeeVariantSlug[],
): HiddenCoffeeVariant | null {
  for (const entry of HIDDEN_COFFEE_VARIANTS) {
    if (
      !isHiddenCoffeeUnlocked(entry.id, beforeOwned) &&
      isHiddenCoffeeUnlocked(entry.id, afterOwned)
    ) {
      return getHiddenCoffeeVariantById(entry.id);
    }
  }
  return null;
}

export function normalizeSelectedCoffeeVariant(
  raw: unknown,
  owned: readonly CoffeeVariantSlug[],
): SelectedCoffeeSlug {
  const slug = String(raw || '').trim();

  if (isHiddenCoffeeVariantSlug(slug) && isHiddenCoffeeUnlocked(slug, owned)) {
    return slug;
  }

  if (isCoffeeVariantSlug(slug) && owned.includes(slug)) {
    return slug;
  }

  return DEFAULT_COFFEE_VARIANT_SLUG;
}

export function resolveCoffeePlayback(
  selectedSlug: SelectedCoffeeSlug | null | undefined,
  owned: readonly CoffeeVariantSlug[],
): CoffeePlayback {
  const slug = selectedSlug ?? DEFAULT_COFFEE_VARIANT_SLUG;

  if (isHiddenCoffeeVariantSlug(slug) && isHiddenCoffeeUnlocked(slug, owned)) {
    const hidden = getHiddenCoffeeVariantById(slug);
    return {
      id: hidden.id,
      label: hidden.unlockedLabel,
      image: getHiddenCoffeePlaybackImage(hidden),
      video: hidden.video,
      drinkPreviewImage: drinkPreviewImageSrc(hidden.id),
    };
  }

  if (isCoffeeVariantSlug(slug) && owned.includes(slug)) {
    const variant = getCoffeeVariantById(slug);
    return {
      id: variant.id,
      label: formatCoffeeVariantName(variant),
      image: variant.image,
      video: variant.video,
      drinkPreviewImage: drinkPreviewImageSrc(variant.id),
    };
  }

  const fallback = getCoffeeVariantById(DEFAULT_COFFEE_VARIANT_SLUG);
  return {
    id: fallback.id,
    label: formatCoffeeVariantName(fallback),
    image: fallback.image,
    video: fallback.video,
    drinkPreviewImage: drinkPreviewImageSrc(fallback.id),
  };
}

export function getActiveCoffeePlayback(
  growth: number,
  selectedSlug: SelectedCoffeeSlug | null | undefined,
  owned: readonly CoffeeVariantSlug[],
): CoffeePlayback | null {
  const COFFEE_VARIANT_GROWTH_MIN = 75;
  if (growth < COFFEE_VARIANT_GROWTH_MIN) {
    return null;
  }

  return resolveCoffeePlayback(selectedSlug, owned);
}

export function getNextCoffeePlaybackFallback(
  current: CoffeePlayback,
  blockedIds: readonly SelectedCoffeeSlug[],
  owned: readonly CoffeeVariantSlug[],
): CoffeePlayback | null {
  const blocked = new Set(blockedIds);

  if (isHiddenCoffeeVariantSlug(current.id)) {
    const hidden = getHiddenCoffeeVariantById(current.id);
    for (const slug of [hidden.requiredMale, hidden.requiredFemale]) {
      if (!blocked.has(slug) && owned.includes(slug)) {
        const variant = getCoffeeVariantById(slug);
        return {
          id: variant.id,
          label: formatCoffeeVariantName(variant),
          image: variant.image,
          video: variant.video,
          drinkPreviewImage: drinkPreviewImageSrc(variant.id),
        };
      }
    }
    return null;
  }

  if (!isCoffeeVariantSlug(current.id)) {
    return null;
  }

  const fallback = getNextCoffeeVariantFallback(current.id, blockedIds as CoffeeVariantSlug[]);
  if (!fallback) return null;

  return {
    id: fallback.id,
    label: formatCoffeeVariantName(fallback),
    image: fallback.image,
    video: fallback.video,
    drinkPreviewImage: drinkPreviewImageSrc(fallback.id),
  };
}

const preloadedVideos = new Set<string>();

export function preloadCoffeePlayback(playback: CoffeePlayback) {
  if (typeof document === 'undefined' || preloadedVideos.has(playback.video)) {
    return;
  }

  preloadedVideos.add(playback.video);
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = playback.video;
  link.as = 'fetch';
  link.type = 'video/mp4';
  link.crossOrigin = 'anonymous';
  link.setAttribute('data-drink-video-preload', playback.video);
  document.head.appendChild(link);

  void preloadCoffeeVideoBlob(playback.video);
}
