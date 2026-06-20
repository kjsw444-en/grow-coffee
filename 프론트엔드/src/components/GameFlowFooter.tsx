import './GameFlowFooter.css';

const STEPS = [
  { num: 1, text: '씨앗\n물주기' },
  { num: 2, text: '새싹·원두\n성장' },
  { num: 3, text: '커피\n완성' },
  { num: 4, text: '커피\n마시기' },
  { num: 5, text: '다시\n반복' },
];

export function GameFlowFooter() {
  return (
    <section className="game-flow" aria-label="게임 진행 순서">
      <p className="game-flow__title">게임 진행 순서</p>
      <div className="game-flow__steps">
        {STEPS.map((step, i) => (
          <div key={step.num} className="game-flow__step-wrap">
            <div className="game-flow__step">
              <span className="game-flow__num">{step.num}</span>
              <span className="game-flow__text">{step.text}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="game-flow__arrow" aria-hidden="true">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
