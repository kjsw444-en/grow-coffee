import type { CoffeeVariantSlug } from './coffeeVariants';
import type { SelectedCoffeeSlug } from './hiddenCoffeeVariants';

/** 100% 커피마시기 대기 포스터 — PlantScene drink-solo 컨테이너(473:1024)와 동일 */
export const DRINK_PREVIEW_WIDTH = 473;
export const DRINK_PREVIEW_HEIGHT = 1024;

export const DRINK_PREVIEW_IMAGE_VERSION = 3;

/** 원본 파일명(제작·관리용) — public 경로는 slug 기준 */
export const DRINK_PREVIEW_SOURCE_LABELS: Record<SelectedCoffeeSlug, string> = {
  'parttime-latte': '커피마시기_ 알바녀 카페라떼',
  'student-coldbrew': '커피마시기_ 여고생 콜드브루',
  'blonde-hazelnut': '커피마시기_ 금발 헤이즐넛',
  'dolce-latte': '커피마시기_ 돌체 라떼',
  'sexy-americano': '커피마시기_ 아메리카노',
  'chic-vanilla-latte': '커피마시기_ 바닐라 라떼',
  'm-parttime-latte': '커피마시기_ 남자 카페라떼',
  'm-student-coldbrew': '커피마시기_ 남자 콜드브루',
  'm-blonde-hazelnut': '커피마시기_ 남자 헤이즐넛',
  'm-dolce-latte': '커피마시기_ 남자 돌체 라떼',
  'm-sexy-americano': '커피마시기_ 남자 아메리카노',
  'm-chic-vanilla-latte': '커피마시기_ 남자 바닐라 라떼',
  'hidden-hazelnut-m-cafe-latte-f': '커피마시기_ 히든 헤이즐넛남 카페라떼여',
  'hidden-cafe-latte-m-hazelnut-f': '커피마시기_ 히든 카페라떼남 헤이즐넛여',
  'hidden-dolce-m-americano-f': '커피마시기_ 히든 돌체남 아메리카노여',
  'hidden-dolce-m-dolce-f': '커피마시기_ 히든 돌체남 돌체여',
  'hidden-vanilla-m-dolce-f': '커피마시기_ 히든 바닐라남 돌체여',
  'hidden-americano-m-vanilla-f': '커피마시기_ 히든 아메리카노남 바닐라여',
};

export function drinkPreviewImageSrc(slug: SelectedCoffeeSlug | CoffeeVariantSlug): string {
  return `/images/drink-preview/${slug}.png?v=${DRINK_PREVIEW_IMAGE_VERSION}`;
}
