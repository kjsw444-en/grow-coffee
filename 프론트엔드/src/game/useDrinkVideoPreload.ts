import { useEffect, useMemo } from 'react';
import type { CoffeeVariantSlug } from './coffeeVariants';
import { DRINK_VIDEO_PRELOAD_GROWTH_MIN } from './constants';
import { prepareCoffeePlaybackVideo } from './drinkVideoPreparation';
import {
  resolveCoffeePlayback,
  type SelectedCoffeeSlug,
} from './hiddenCoffeeVariants';
import { roundGrowth } from './passiveGrowth';

export function useDrinkVideoPreload(
  growth: number,
  selectedCoffeeVariant: SelectedCoffeeSlug,
  ownedCoffeeVariants: readonly CoffeeVariantSlug[],
) {
  const normalizedGrowth = roundGrowth(growth);

  const playback = useMemo(() => {
    if (normalizedGrowth < DRINK_VIDEO_PRELOAD_GROWTH_MIN) return null;
    return resolveCoffeePlayback(selectedCoffeeVariant, ownedCoffeeVariants);
  }, [normalizedGrowth, selectedCoffeeVariant, ownedCoffeeVariants]);

  useEffect(() => {
    if (!playback) return;
    void prepareCoffeePlaybackVideo(playback);
  }, [playback]);
}
