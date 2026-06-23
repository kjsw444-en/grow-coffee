import { useLayoutEffect, useRef, useState } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import {
  COFFEE_DRINK_LINES,
  COFFEE_VARIANT_PURCHASE_COST,
  formatCoffeeVariantName,
  getAvailableCoffeeCups,
  getCoffeeVariantById,
  isDefaultFreeVariant,
  type CoffeeVariant,
  type CoffeeVariantSlug,
} from '../game/coffeeVariants';
import {
  getHiddenCoffeeVariants,
  isHiddenCoffeeUnlocked,
  type HiddenCoffeeVariant,
  type SelectedCoffeeSlug,
} from '../game/hiddenCoffeeVariants';
import { HiddenCoffeePairThumb } from './HiddenCoffeePairThumb';
import './CharacterShopSheet.css';

type CharacterShopSheetProps = {
  totalCoffees: number;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  selectedCoffeeVariant: SelectedCoffeeSlug;
  busy?: boolean;
  onPurchase: (slug: CoffeeVariantSlug) => void;
  onSelect: (slug: SelectedCoffeeSlug) => void;
  onClose: () => void;
};

function VariantSlot({
  variant,
  isOwned,
  isSelected,
  isDefaultFree,
  canBuy,
  busy,
  onPurchase,
  onSelect,
}: {
  variant: CoffeeVariant;
  isOwned: boolean;
  isSelected: boolean;
  isDefaultFree: boolean;
  canBuy: boolean;
  busy: boolean;
  onPurchase: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={`character-shop__slot${isSelected ? ' character-shop__slot--selected' : ''}`}
    >
      <span className="character-shop__slot-gender">{variant.genderLabel}</span>
      <img className="character-shop__slot-thumb" src={variant.image} alt="" />
      <span className="character-shop__slot-status">
        {isDefaultFree ? '기본' : isOwned ? (isSelected ? '사용 중' : '보유') : `${COFFEE_VARIANT_PURCHASE_COST}잔`}
      </span>
      {isOwned ? (
        <button
          type="button"
          className={`character-shop__btn character-shop__btn--slot${isSelected ? ' character-shop__btn--active' : ''}`}
          disabled={busy || isSelected}
          onClick={onSelect}
        >
          {isSelected ? '선택됨' : '선택'}
        </button>
      ) : (
        <button
          type="button"
          className="character-shop__btn character-shop__btn--slot character-shop__btn--buy"
          disabled={busy || !canBuy}
          data-slug={variant.id}
          onClick={(event) => {
            event.stopPropagation();
            onPurchase();
          }}
        >
          구매
        </button>
      )}
    </div>
  );
}

export function CharacterShopSheet({
  totalCoffees,
  ownedCoffeeVariants,
  selectedCoffeeVariant,
  busy = false,
  onPurchase,
  onSelect,
  onClose,
}: CharacterShopSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetScrollTopRef = useRef(0);
  const [pendingPurchase, setPendingPurchase] = useState<CoffeeVariantSlug | null>(null);
  const buttonSound = useButtonSound();
  const availableCups = getAvailableCoffeeCups({ totalCoffees, spentCoffeeCups: 0 });
  const owned = new Set(ownedCoffeeVariants);
  const pendingVariant = pendingPurchase ? getCoffeeVariantById(pendingPurchase) : null;

  const restoreSheetScroll = () => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.scrollTop = sheetScrollTopRef.current;
  };

  useLayoutEffect(() => {
    restoreSheetScroll();
  }, [pendingPurchase]);

  const openPurchaseConfirm = async (slug: CoffeeVariantSlug) => {
    if (sheetRef.current) {
      sheetScrollTopRef.current = sheetRef.current.scrollTop;
    }
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

  const handleSelect = async (slug: SelectedCoffeeSlug) => {
    await buttonSound();
    onSelect(slug);
  };

  const renderHiddenItem = (hidden: HiddenCoffeeVariant) => {
    const unlocked = isHiddenCoffeeUnlocked(hidden.id, ownedCoffeeVariants);
    const isSelected = selectedCoffeeVariant === hidden.id;

    return (
      <li
        key={hidden.id}
        className={`character-shop__item character-shop__item--hidden${unlocked ? '' : ' character-shop__item--locked'}${isSelected ? ' character-shop__item--selected' : ''}`}
      >
        <HiddenCoffeePairThumb hidden={hidden} unlocked={unlocked} />
        <div className="character-shop__meta">
          <strong>{unlocked ? hidden.unlockedLabel : hidden.lockedLabel}</strong>
          <span className="character-shop__price">
            {unlocked ? '커플 히든 영상' : hidden.unlockHint}
          </span>
        </div>
        <div className="character-shop__actions">
          {unlocked ? (
            <button
              type="button"
              className={`character-shop__btn${isSelected ? ' character-shop__btn--active' : ''}`}
              disabled={busy || isSelected}
              onClick={() => void handleSelect(hidden.id)}
            >
              {isSelected ? '선택됨' : '선택'}
            </button>
          ) : (
            <button type="button" className="character-shop__btn" disabled>
              잠김
            </button>
          )}
        </div>
      </li>
    );
  };

  const renderSlot = (slug: CoffeeVariantSlug) => {
    const variant = getCoffeeVariantById(slug);
    const isDefaultFree = isDefaultFreeVariant(slug);
    const isOwned = owned.has(slug);
    const isSelected = selectedCoffeeVariant === slug;
    const canBuy = !isDefaultFree && !isOwned && availableCups >= COFFEE_VARIANT_PURCHASE_COST;

    return (
      <VariantSlot
        key={slug}
        variant={variant}
        isOwned={isOwned}
        isSelected={isSelected}
        isDefaultFree={isDefaultFree}
        canBuy={canBuy}
        busy={busy}
        onPurchase={() => void openPurchaseConfirm(slug)}
        onSelect={() => void handleSelect(slug)}
      />
    );
  };

  return (
    <div className="character-shop" role="dialog" aria-modal="true" aria-labelledby="character-shop-title">
      <button type="button" className="character-shop__backdrop" onClick={onClose} aria-label="닫기" />
      <div ref={sheetRef} className="character-shop__sheet">
        <h2 id="character-shop-title">커피 상점</h2>
        <p className="character-shop__notice">
          커피 종류마다 여성·남성 캐릭터가 있어요. 특정 조합을 모두 구매하면 ❤️ 히든 커플 영상이 열려요.
        </p>
        <p className="character-shop__balance">
          내린 커피 <strong>{availableCups}잔</strong>
        </p>

        <ul className="character-shop__line-list">
          {COFFEE_DRINK_LINES.map((line) => (
            <li key={line.id} className="character-shop__line">
              <h3 className="character-shop__line-title">{line.label}</h3>
              <div className="character-shop__pair">
                {renderSlot(line.female)}
                {renderSlot(line.male)}
              </div>
            </li>
          ))}
        </ul>

        <section className="character-shop__section" aria-labelledby="character-shop-hidden-title">
          <h3 id="character-shop-hidden-title" className="character-shop__section-title">
            ❤️ 히든 커피
          </h3>
          <ul className="character-shop__list">{getHiddenCoffeeVariants().map(renderHiddenItem)}</ul>
        </section>
      </div>

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
              <strong>{formatCoffeeVariantName(pendingVariant)}</strong> 구매하시겠습니까?
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
  );
}
