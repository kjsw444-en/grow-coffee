import { useState } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import { RECOMMEND_COFFEE_IMG, RECOMMEND_DINNER_IMG } from '../game/constants';
import './RecommendButtons.css';

type RecommendType = 'coffee' | 'dinner' | null;

export function RecommendButtons() {
  const [openType, setOpenType] = useState<RecommendType>(null);
  const buttonSound = useButtonSound();

  const open = async (type: RecommendType) => {
    await buttonSound();
    setOpenType(type);
  };

  const close = async () => {
    await buttonSound();
    setOpenType(null);
  };

  return (
    <>
      <div className="recommend-buttons" aria-label="오늘의 추천">
        <button type="button" className="recommend-buttons__btn" onClick={() => open('coffee')}>
          <img className="recommend-buttons__img" src={RECOMMEND_COFFEE_IMG} alt="" />
          <span className="recommend-buttons__label">
            오늘의
            <br />
            커피 추천
          </span>
        </button>
        <button type="button" className="recommend-buttons__btn" onClick={() => open('dinner')}>
          <img className="recommend-buttons__img" src={RECOMMEND_DINNER_IMG} alt="" />
          <span className="recommend-buttons__label">
            오늘의
            <br />
            저녁 추천
          </span>
        </button>
      </div>

      {openType && (
        <div className="recommend-sheet" role="dialog" aria-modal="true" onClick={close}>
          <div className="recommend-sheet__card" onClick={(e) => e.stopPropagation()}>
            <p className="recommend-sheet__eyebrow">오늘의 추천</p>
            <h3 className="recommend-sheet__title">
              {openType === 'coffee' ? '오늘의 커피 추천' : '오늘의 저녁 추천'}
            </h3>
            <p className="recommend-sheet__desc">추천 콘텐츠를 준비하고 있어요.</p>
            <button type="button" className="recommend-sheet__close" onClick={close}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
