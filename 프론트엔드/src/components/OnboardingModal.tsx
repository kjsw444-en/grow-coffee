import { useState } from 'react';
import { ONBOARDING_SLIDES } from '../game/onboardingAssets';
import './OnboardingModal.css';

type OnboardingModalProps = {
  onClose: () => void;
};

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const slide = ONBOARDING_SLIDES[slideIndex];
  const isLast = slideIndex === ONBOARDING_SLIDES.length - 1;
  const showPrev = slideIndex > 0;

  const goNext = () => {
    if (isLast) {
      onClose();
      return;
    }
    setSlideIndex((value) => value + 1);
  };

  const goPrev = () => {
    setSlideIndex((value) => Math.max(0, value - 1));
  };

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding__card">
        <p className="onboarding__step">
          {slideIndex + 1} / {ONBOARDING_SLIDES.length}
        </p>

        <div className="onboarding__media">
          <div className="onboarding__media-frame">
            <img
              className={`onboarding__image onboarding__image--${slide.imageFit}`}
              src={slide.image}
              alt={slide.imageAlt}
              loading={slideIndex === 0 ? 'eager' : 'lazy'}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                const fallback = event.currentTarget.nextElementSibling;
                if (fallback instanceof HTMLElement) {
                  fallback.hidden = false;
                }
              }}
            />
            <span className="onboarding__emoji onboarding__emoji--fallback" hidden aria-hidden="true">
              {slide.emoji}
            </span>
          </div>
        </div>

        <h2 id="onboarding-title" className="onboarding__title">
          {slide.title}
        </h2>
        <p className="onboarding__body">{slide.body}</p>

        <div className="onboarding__dots" role="tablist" aria-label="온보딩 단계">
          {ONBOARDING_SLIDES.map((_, index) => (
            <span
              key={index}
              className={`onboarding__dot${index === slideIndex ? ' onboarding__dot--active' : ''}`}
              aria-current={index === slideIndex ? 'step' : undefined}
            />
          ))}
        </div>

        <div className="onboarding__actions">
          <button
            type="button"
            className={`onboarding__secondary${showPrev ? '' : ' onboarding__secondary--hidden'}`}
            onClick={goPrev}
            tabIndex={showPrev ? 0 : -1}
            aria-hidden={!showPrev}
          >
            이전
          </button>
          <button type="button" className="onboarding__cta" onClick={goNext}>
            {isLast ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
