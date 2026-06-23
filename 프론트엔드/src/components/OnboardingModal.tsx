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
            <strong>물주기</strong> (4~7초 꾹 누르기) — 씨앗→새싹→원두→커피
          </li>
          <li>하루에 <strong>물주기·내리기(성장)</strong>는 <strong>1회 무료</strong>, 더 하려면 <strong>광고 시청</strong> 후 가능</li>
          <li>가만히 둬도 <strong>햇빛</strong>으로 성장률이 천천히 올라가요 (하루 약 8%)</li>
          <li>커피 단계(75~99%)에 <strong>커피 식물</strong> · 100%에서 카페 배경 + <strong>커피 마시기</strong> (+47원)</li>
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
