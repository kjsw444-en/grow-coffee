import { HOLD_DURATION_LABEL } from '../game/constants';

import './InteractiveTutorialOverlay.css';



export type TutorialStep =

  | 'intro'

  | 'await-water'

  | 'water-sync'

  | 'await-drink'

  | 'drink-sync'

  | 'complete';



type InteractiveTutorialOverlayProps = {

  step: TutorialStep;

  onStart: () => void;

  onComplete: () => void;

};



export function InteractiveTutorialOverlay({

  step,

  onStart,

  onComplete,

}: InteractiveTutorialOverlayProps) {

  if (step === 'intro') {

    return (

      <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">

        <div className="tutorial-overlay__card tutorial-overlay__card--center">

          <p className="tutorial-overlay__badge">튜토리얼</p>

          <h2 id="tutorial-title">화분에 물을 주며 커피나무를 키워요</h2>

          <p className="tutorial-overlay__body">

            아래 화분을 <strong>{HOLD_DURATION_LABEL}</strong> 꾹 눌러 물을 주면 커피나무가 자라요.

            광고 없이 <strong>100%까지 키우고 커피 마시기</strong>까지 체험해 볼게요!

          </p>

          <button type="button" className="tutorial-overlay__cta" onClick={onStart}>

            시작하기

          </button>

        </div>

      </div>

    );

  }



  if (step === 'complete') {

    return (

      <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-complete-title">

        <div className="tutorial-overlay__card tutorial-overlay__card--center">

          <p className="tutorial-overlay__badge">완료</p>

          <h2 id="tutorial-complete-title">첫 커피 한 사이클 완료!</h2>

          <p className="tutorial-overlay__body">

            물주기부터 커피 마시기까지 해봤어요. 이제 본격적으로 커피값을 모아 보세요!

          </p>

          <button type="button" className="tutorial-overlay__cta" onClick={onComplete}>

            게임 시작

          </button>

        </div>

      </div>

    );

  }



  return (

    <div className="tutorial-overlay tutorial-overlay--hint" aria-live="polite">

      {step === 'await-water' && (

        <div className="tutorial-overlay__card tutorial-overlay__card--bottom tutorial-overlay__card--heartbeat">

          <p className="tutorial-overlay__hint">

            <span className="tutorial-overlay__pulse" aria-hidden="true">

              👆

            </span>

            화분을 꾹 눌러 물을 주세요! (100%까지)

          </p>

        </div>

      )}



      {step === 'water-sync' && (

        <div className="tutorial-overlay__card tutorial-overlay__card--bottom">

          <p className="tutorial-overlay__hint">커피나무가 자라는 중…</p>

        </div>

      )}



      {step === 'await-drink' && (

        <div className="tutorial-overlay__card tutorial-overlay__card--bottom">

          <p className="tutorial-overlay__hint">

            <span className="tutorial-overlay__pulse" aria-hidden="true">

              ☕

            </span>

            100% 완성! 커피 마시기를 눌러 주세요.

          </p>

        </div>

      )}



      {step === 'drink-sync' && (

        <div className="tutorial-overlay__card tutorial-overlay__card--bottom">

          <p className="tutorial-overlay__hint">커피를 마시는 중…</p>

        </div>

      )}

    </div>

  );

}


