import { useButtonSound } from '../audio/SoundProvider';

import {

  COFFEE_DRINK_LINES,

  COFFEE_VARIANTS,

  formatCoffeeVariantName,

  getCoffeeVariantById,

  type CoffeeVariantSlug,

} from '../game/coffeeVariants';

import {

  getHiddenCoffeeVariants,

  isHiddenCoffeeUnlocked,

  type SelectedCoffeeSlug,

} from '../game/hiddenCoffeeVariants';

import { HiddenCoffeePairThumb } from './HiddenCoffeePairThumb';
import './CharacterShopSheet.css';



type MyCoffeeSheetProps = {

  ownedCoffeeVariants: CoffeeVariantSlug[];

  selectedCoffeeVariant: SelectedCoffeeSlug;

  busy?: boolean;

  onSelect: (slug: SelectedCoffeeSlug) => void;

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

  const ownedCount = COFFEE_VARIANTS.filter((variant) => owned.has(variant.id)).length;

  const unlockedHidden = getHiddenCoffeeVariants().filter((hidden) =>

    isHiddenCoffeeUnlocked(hidden.id, ownedCoffeeVariants),

  );



  const handleSelect = async (slug: SelectedCoffeeSlug) => {

    await buttonSound();

    onSelect(slug);

  };



  return (

    <div className="character-shop" role="dialog" aria-modal="true" aria-labelledby="my-coffee-title">

      <button type="button" className="character-shop__backdrop" onClick={onClose} aria-label="닫기" />

      <div className="character-shop__sheet">

        <h2 id="my-coffee-title">내 커피</h2>

        <p className="character-shop__notice">구매한 캐릭터와 해금된 히든 커플 영상을 선택할 수 있어요.</p>

        <p className="character-shop__balance">

          보유 <strong>{ownedCount}종</strong>

          {unlockedHidden.length > 0 && (

            <span className="character-shop__balance-sub">

              히든 해금 <strong>{unlockedHidden.length}종</strong>

            </span>

          )}

        </p>



        <ul className="character-shop__line-list">

          {COFFEE_DRINK_LINES.map((line) => {

            const ownedInLine = [line.female, line.male].filter((slug) => owned.has(slug));

            if (ownedInLine.length === 0) return null;



            return (

              <li key={line.id} className="character-shop__line">

                <h3 className="character-shop__line-title">{line.label}</h3>

                <div className="character-shop__pair">

                  {[line.female, line.male].map((slug) => {

                    if (!owned.has(slug)) {

                      return (

                        <div key={slug} className="character-shop__slot character-shop__slot--empty">

                          <span className="character-shop__slot-gender">

                            {getCoffeeVariantById(slug).genderLabel}

                          </span>

                          <span className="character-shop__slot-empty">미보유</span>

                        </div>

                      );

                    }



                    const variant = getCoffeeVariantById(slug);

                    const isSelected = selectedCoffeeVariant === slug;



                    return (

                      <div

                        key={slug}

                        className={`character-shop__slot${isSelected ? ' character-shop__slot--selected' : ''}`}

                      >

                        <span className="character-shop__slot-gender">{variant.genderLabel}</span>

                        <img className="character-shop__slot-thumb" src={variant.image} alt="" />

                        <span className="character-shop__slot-status">

                          {formatCoffeeVariantName(variant)}

                        </span>

                        <button

                          type="button"

                          className={`character-shop__btn character-shop__btn--slot${isSelected ? ' character-shop__btn--active' : ''}`}

                          disabled={busy || isSelected}

                          onClick={() => void handleSelect(slug)}

                        >

                          {isSelected ? '선택됨' : '선택'}

                        </button>

                      </div>

                    );

                  })}

                </div>

              </li>

            );

          })}

        </ul>



        {unlockedHidden.length > 0 && (

          <section className="character-shop__section" aria-labelledby="my-coffee-hidden-title">

            <h3 id="my-coffee-hidden-title" className="character-shop__section-title">

              ❤️ 히든 커피

            </h3>

            <ul className="character-shop__list">

              {unlockedHidden.map((hidden) => {

                const isSelected = selectedCoffeeVariant === hidden.id;



                return (

                  <li

                    key={hidden.id}

                    className={`character-shop__item character-shop__item--hidden${isSelected ? ' character-shop__item--selected' : ''}`}

                  >

                    <HiddenCoffeePairThumb hidden={hidden} unlocked />

                    <div className="character-shop__meta">

                      <strong>{hidden.unlockedLabel}</strong>

                      <span className="character-shop__price">커플 히든 영상</span>

                    </div>

                    <div className="character-shop__actions">

                      <button

                        type="button"

                        className={`character-shop__btn${isSelected ? ' character-shop__btn--active' : ''}`}

                        disabled={busy || isSelected}

                        onClick={() => void handleSelect(hidden.id)}

                      >

                        {isSelected ? '선택됨' : '선택'}

                      </button>

                    </div>

                  </li>

                );

              })}

            </ul>

          </section>

        )}

      </div>

    </div>

  );

}

