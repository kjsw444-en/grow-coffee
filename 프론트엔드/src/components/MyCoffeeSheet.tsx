import { useButtonSound } from '../audio/SoundProvider';
import { COFFEE_VARIANTS, type CoffeeVariantSlug } from '../game/coffeeVariants';
import './CharacterShopSheet.css';

type MyCoffeeSheetProps = {
  ownedCoffeeVariants: CoffeeVariantSlug[];
  selectedCoffeeVariant: CoffeeVariantSlug;
  busy?: boolean;
  onSelect: (slug: CoffeeVariantSlug) => void;
  onClose: () => void;
};

export function MyCoffeeSheet({
  ownedCoffeeVariants,
  selectedCoffeeVariant,
  busy = false,
  onSelect,
  onClose,
}: MyCoffeeSheetProps) {
  const buttonSound = useButtonSound();
  const owned = new Set(ownedCoffeeVariants);
  const ownedVariants = COFFEE_VARIANTS.filter((variant) => owned.has(variant.id));

  const handleSelect = async (slug: CoffeeVariantSlug) => {
    await buttonSound();
    onSelect(slug);
  };

  return (
    <div className="character-shop" role="dialog" aria-modal="true" aria-labelledby="my-coffee-title">
      <button type="button" className="character-shop__backdrop" onClick={onClose} aria-label="닫기" />
      <div className="character-shop__sheet">
        <h2 id="my-coffee-title">내 커피</h2>
        <p className="character-shop__notice">구매한 커피 캐릭터를 확인하고 사용할 수 있어요.</p>
        <p className="character-shop__balance">
          보유 <strong>{ownedVariants.length}종</strong>
        </p>

        <ul className="character-shop__list">
          {ownedVariants.map((variant) => {
            const isSelected = selectedCoffeeVariant === variant.id;

            return (
              <li
                key={variant.id}
                className={`character-shop__item${isSelected ? ' character-shop__item--selected' : ''}`}
              >
                <img className="character-shop__thumb" src={variant.image} alt="" />
                <div className="character-shop__meta">
                  <strong>{variant.label}</strong>
                  <span className="character-shop__price">{isSelected ? '사용 중' : '보유 중'}</span>
                </div>
                <div className="character-shop__actions">
                  <button
                    type="button"
                    className={`character-shop__btn${isSelected ? ' character-shop__btn--active' : ''}`}
                    disabled={busy || isSelected}
                    onClick={() => void handleSelect(variant.id)}
                  >
                    {isSelected ? '사용 중' : '선택'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
