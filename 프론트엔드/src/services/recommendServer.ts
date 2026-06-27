import {
  fetchRecommendToday,
  rerollRecommendGame,
  type RecommendTodayView,
} from './api';
import {
  getCoffeeRecommendationById,
  type CoffeeMenuId,
  type CoffeeRecommendation,
} from './coffeeRecommendation';
import {
  getDinnerRecommendationById,
  type DinnerMenuId,
  type DinnerRecommendation,
} from './dinnerRecommendation';

export type RecommendKind = 'coffee' | 'dinner';

export type { RecommendTodayView };

export function resolveCoffeeRecommendation(menuId: string): CoffeeRecommendation {
  return getCoffeeRecommendationById(menuId as CoffeeMenuId);
}

export function resolveDinnerRecommendation(menuId: string): DinnerRecommendation {
  return getDinnerRecommendationById(menuId as DinnerMenuId);
}

export async function loadRecommendToday(kind: RecommendKind) {
  const result = await fetchRecommendToday(kind);
  const item =
    kind === 'coffee'
      ? resolveCoffeeRecommendation(result.menuId)
      : resolveDinnerRecommendation(result.menuId);

  return {
    item,
    recommend: result.recommend,
    state: result.state,
  };
}

export async function rerollRecommendToday(kind: RecommendKind) {
  const result = await rerollRecommendGame(kind);
  const item =
    kind === 'coffee'
      ? resolveCoffeeRecommendation(result.menuId)
      : resolveDinnerRecommendation(result.menuId);

  return {
    item,
    recommend: result.recommend,
    state: result.state,
  };
}
