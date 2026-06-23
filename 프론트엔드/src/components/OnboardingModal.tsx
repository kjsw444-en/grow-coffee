import './OnboardingModal.css';

type OnboardingModalProps = {
  onClose: () => void;
};

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding__card">
        <p className="onboarding__step">1단계 · 프론트엔드</p>
        <h2 id="onboarding-title">커피 키우기 시작!</h2>
        <ol className="onboarding__list">
          <li>
            <strong>물주기</strong> (3~5초 꾹 누르기) — 씨앗→새싹→원두→커피
          </li>
          <li>
            <strong>첫 물주기·내리기</strong> 1회 · 이후 <strong>물 채우기</strong>(커피 단계에선 <strong>커피 한잔</strong>) → 1회 (반복)
          </li>
          <li>
            가만히 둬도 <strong>햇빛</strong>으로 방치 커피 충전 — <strong>1분당 +5%</strong>, 20분(100%)마다{' '}
            <strong>방치 커피 받기</strong> (하루 2잔). 2/2 후 <strong>재활성</strong>(광고)으로 같은 날 한 번 더
            충전할 수 있어요.
          </li>
          <li>
            커피 단계(75~99%)에 <strong>커피 식물</strong> · 100%에서 <strong>커피 마시기</strong> → 내린 커피
            +1 · 10잔 판매 시 +47P
          </li>
          <li>
            <strong>4,700원</strong>을 모으면 아메리카노 한 잔!
          </li>
        </ol>
        <p className="onboarding__note">
          지금은 임시 데이터예요. 새로고침해도 이 기기에만 저장됩니다.
        </p>
        <button type="button" className="onboarding__cta" onClick={onClose}>
          시작하기
        </button>
      </div>
    </div>
  );
}
