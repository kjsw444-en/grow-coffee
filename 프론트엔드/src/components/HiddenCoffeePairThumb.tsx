import { getCoffeeVariantById } from '../game/coffeeVariants';
import type { HiddenCoffeeVariant } from '../game/hiddenCoffeeVariants';

type HiddenCoffeePairThumbProps = {
  hidden: HiddenCoffeeVariant;
  unlocked: boolean;
};

export function HiddenCoffeePairThumb({ hidden, unlocked }: HiddenCoffeePairThumbProps) {
  if (!unlocked) {
    return (
      <div className="character-shop__thumb character-shop__thumb--heart" aria-hidden="true">
        ❤️💕
      </div>
    );
  }

  const male = getCoffeeVariantById(hidden.requiredMale);
  const female = getCoffeeVariantById(hidden.requiredFemale);

  return (
    <div className="character-shop__thumb character-shop__thumb--pair">
      <img src={male.image} alt="" />
      <img src={female.image} alt="" />
    </div>
  );
}
