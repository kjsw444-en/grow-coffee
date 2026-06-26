import { memo, useEffect, useRef, useState } from 'react';
import { BREWED_COFFEE_HELP, DRUNK_COFFEE_HELP } from '../game/coffeeCurrencyHelp';

type GrowthPanelCoffeeRowProps = {
  totalCoffees: number;
  emptiedCoffeeCups: number;
};

function GrowthPanelCoffeeRowComponent({ totalCoffees, emptiedCoffeeCups }: GrowthPanelCoffeeRowProps) {
  const [coffeeTip, setCoffeeTip] = useState<'brewed' | 'drunk' | null>(null);
  const brewedCoffeeTipRef = useRef<HTMLDivElement>(null);
  const drunkCoffeeTipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!coffeeTip) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (brewedCoffeeTipRef.current?.contains(target)) return;
      if (drunkCoffeeTipRef.current?.contains(target)) return;
      setCoffeeTip(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [coffeeTip]);

  return (
    <div className="growth-panel__coffee-row">
      <div ref={brewedCoffeeTipRef} className="growth-panel__coffee-stat-wrap">
        <button
          type="button"
          className="growth-panel__coffee-stat growth-panel__coffee-stat--tip"
          aria-label={`내린 커피 ${totalCoffees}잔 · 설명 보기`}
          aria-expanded={coffeeTip === 'brewed'}
          onClick={() => setCoffeeTip((tip) => (tip === 'brewed' ? null : 'brewed'))}
        >
          <span className="growth-panel__coffee-icon" aria-hidden="true">
            ☕
          </span>
          <span className="growth-panel__coffee-label">내린 커피</span>
          <strong className="growth-panel__coffee-count">{totalCoffees.toLocaleString('ko-KR')}잔</strong>
        </button>
        {coffeeTip === 'brewed' && (
          <div className="growth-panel__coffee-tip growth-panel__coffee-tip--left" role="tooltip">
            <p className="growth-panel__coffee-tip-title">{BREWED_COFFEE_HELP.title}</p>
            <p className="growth-panel__coffee-tip-body">
              <strong>{BREWED_COFFEE_HELP.earnTitle}</strong>
              <br />
              {BREWED_COFFEE_HELP.earnLines.map((line) => (
                <span key={line}>
                  · {line}
                  <br />
                </span>
              ))}
            </p>
            <p className="growth-panel__coffee-tip-body">
              <strong>{BREWED_COFFEE_HELP.spendTitle}</strong>
              <br />
              {BREWED_COFFEE_HELP.spendLines.map((line) => (
                <span key={line}>
                  · {line}
                  <br />
                </span>
              ))}
            </p>
          </div>
        )}
      </div>
      <div ref={drunkCoffeeTipRef} className="growth-panel__coffee-stat-wrap">
        <button
          type="button"
          className="growth-panel__coffee-stat growth-panel__coffee-stat--emptied growth-panel__coffee-stat--tip"
          aria-label={`마신 커피 ${emptiedCoffeeCups}잔 · 설명 보기`}
          aria-expanded={coffeeTip === 'drunk'}
          onClick={() => setCoffeeTip((tip) => (tip === 'drunk' ? null : 'drunk'))}
        >
          <span className="growth-panel__coffee-icon growth-panel__coffee-icon--emptied" aria-hidden="true">
            <span className="growth-panel__empty-cup">☕</span>
            <span className="growth-panel__empty-check">✓</span>
          </span>
          <span className="growth-panel__coffee-label">마신 커피</span>
          <strong className="growth-panel__coffee-count growth-panel__coffee-count--emptied">
            {emptiedCoffeeCups.toLocaleString('ko-KR')}잔
          </strong>
        </button>
        {coffeeTip === 'drunk' && (
          <div className="growth-panel__coffee-tip" role="tooltip">
            <p className="growth-panel__coffee-tip-title">{DRUNK_COFFEE_HELP.title}</p>
            <p className="growth-panel__coffee-tip-body">
              <strong>{DRUNK_COFFEE_HELP.earnTitle}</strong>
              <br />
              {DRUNK_COFFEE_HELP.earnLines.map((line) => (
                <span key={line}>
                  · {line}
                  <br />
                </span>
              ))}
            </p>
            <p className="growth-panel__coffee-tip-body">
              <strong>{DRUNK_COFFEE_HELP.spendTitle}</strong>
              <br />
              {DRUNK_COFFEE_HELP.spendLines.map((line) => (
                <span key={line}>
                  · {line}
                  <br />
                </span>
              ))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const GrowthPanelCoffeeRow = memo(GrowthPanelCoffeeRowComponent);
