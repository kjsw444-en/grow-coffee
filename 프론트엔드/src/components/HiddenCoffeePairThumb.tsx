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

  const female = getCoffeeVariantById(hidden.requiredFemale);
  const male = getCoffeeVariantById(hidden.requiredMale);

  return (
    <div className="character-shop__thumb character-shop__thumb--pair">
      <img src={female.image} alt="" />
      <img src={male.image} alt="" />
    </div>
  );
}
