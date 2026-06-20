import { getStage } from '../game/utils';
import './GrowthPanel.css';

type GrowthPanelProps = {
  growth: number;
};

export function GrowthPanel({ growth }: GrowthPanelProps) {
  const stage = getStage(growth);

  return (
    <section className="growth-panel">
      <div className="growth-panel__head">
        <span className="growth-panel__label">커피나무 성장률</span>
        <span className="growth-panel__percent">{Math.round(growth)}%</span>
      </div>
      <div className="growth-panel__bar">
        <div className="growth-panel__bar-fill" style={{ width: `${growth}%` }} />
      </div>
      <span className="growth-panel__badge">성장 단계: {stage.label}</span>
    </section>
  );
}
