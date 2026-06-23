import { useState } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import {
  COFFEE_VARIANT_PURCHASE_COST,
  COFFEE_VARIANTS,
  DEFAULT_COFFEE_VARIANT_SLUG,
  getAvailableCoffeeCups,
  type CoffeeVariantSlug,
} from '../game/coffeeVariants';
import './CharacterShopSheet.css';

type CharacterShopSheetProps = {
  totalCoffees: number;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  selectedCoffeeVariant: CoffeeVariantSlug;
  busy?: boolean;
  onPurchase: (slug: CoffeeVariantSlug) => void;
  onSelect: (slug: CoffeeVariantSlug) => void;
  onClose: () => void;
};

export function CharacterShopSheet({
  totalCoffees,
  ownedCoffeeVariants,
  selectedCoffeeVariant,
  busy = false,
  onPurchase,
  onSelect,
  onClose,
}: CharacterShopSheetProps) {
  const [pendingPurchase, setPendingPurchase] = useState<CoffeeVariantSlug | null>(null);
  const buttonSound = useButtonSound();
  const availableCups = getAvailableCoffeeCups({ totalCoffees, spentCoffeeCups: 0 });
  const owned = new Set(ownedCoffeeVariants);
  const pendingVariant = pendingPurchase
    ? COFFEE_VARIANTS.find((variant) => variant.id === pendingPurchase) ?? null
    : null;

  const openPurchaseConfirm = async (slug: CoffeeVariantSlug) => {
    await buttonSound();
    setPendingPurchase(slug);
  };

  const cancelPurchaseConfirm = async () => {
    await buttonSound();
    setPendingPurchase(null);
  };

  const confirmPurchase = async () => {
    if (!pendingVariant || busy) return;
    await buttonSound();
    onPurchase(pendingVariant.id);
    setPendingPurchase(null);
  };

  const handleSelect = async (slug: CoffeeVariantSlug) => {
    await buttonSound();
    onSelect(slug);
  };

  return (
    <div className="character-shop" role="dialog" aria-modal="true" aria-labelledby="character-shop-title">
      <button type="button" className="character-shop__backdrop" onClick={onClose} aria-label="닫기" />
      <div className="character-shop__sheet">
        <h2 id="character-shop-title">커피 상점</h2>
        <p className="character-shop__notice">커피를 구매하면 해당 캐릭터가 제공됩니다.</p>
        <p className="character-shop__balance">
          마신 커피 <strong>{availableCups}잔</strong>
        </p>

        <ul className="character-shop__list">
          {COFFEE_VARIANTS.map((variant) => {
            const isDefault = variant.id === DEFAULT_COFFEE_VARIANT_SLUG;
            const isOwned = owned.has(variant.id);
            const isSelected = selectedCoffeeVariant === variant.id;
            const canBuy =
              !isDefault && !isOwned && availableCups >= COFFEE_VARIANT_PURCHASE_COST;

            return (
              <li
                key={variant.id}
                className={`character-shop__item${isSelected ? ' character-shop__item--selected' : ''}`}
              >
                <img className="character-shop__thumb" src={variant.image} alt="" />
                <div className="character-shop__meta">
                  <strong>{variant.label}</strong>
                  <span className="character-shop__price">
                    {isDefault ? '기본 제공' : isOwned ? '보유 중' : `${COFFEE_VARIANT_PURCHASE_COST}잔`}
                  </span>
                </div>
                <div className="character-shop__actions">
                  {isOwned ? (
                    <button
                      type="button"
                      className={`character-shop__btn${isSelected ? ' character-shop__btn--active' : ''}`}
                      disabled={busy || isSelected}
                      onClick={() => void handleSelect(variant.id)}
                    >
                      {isSelected ? '사용 중' : '선택'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="character-shop__btn character-shop__btn--buy"
                      disabled={busy || !canBuy}
                      onClick={() => void openPurchaseConfirm(variant.id)}
                    >
                      구매
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {pendingVariant && (
          <div
            className="character-shop__confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="character-shop-confirm-title"
          >
            <button
              type="button"
              className="character-shop__confirm-backdrop"
              onClick={() => void cancelPurchaseConfirm()}
              aria-label="닫기"
            />
            <div className="character-shop__confirm-card">
              <p id="character-shop-confirm-title" className="character-shop__confirm-title">
                <strong>{pendingVariant.label}</strong> 구매하시겠습니까?
              </p>
              <div className="character-shop__confirm-actions">
                <button
                  type="button"
                  className="character-shop__confirm-btn"
                  disabled={busy}
                  onClick={() => void cancelPurchaseConfirm()}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="character-shop__confirm-btn character-shop__confirm-btn--primary"
                  disabled={busy}
                  onClick={() => void confirmPurchase()}
                >
                  구매
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
