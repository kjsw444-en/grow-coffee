import type { RecommendKind } from '../services/recommendDaily';
import type { RecommendMenuItem } from '../services/recommendTypes';
import { RecommendMenuCard } from './RecommendMenuCard';
import './RecommendButtons.css';

type RecommendExpandPanelProps = {
  item: RecommendMenuItem;
  onReroll: () => void;
  label: string;
};

export function RecommendExpandPanel({ item, onReroll, label }: RecommendExpandPanelProps) {
  return (
    <div className="recommend-buttons__menu-panel" role="region" aria-label={label}>
      <RecommendMenuCard item={item} />
      <div className="recommend-buttons__reroll-wrap">
        <button type="button" className="recommend-buttons__reroll-btn" onClick={onReroll}>
          한번 더
        </button>
      </div>
    </div>
  );
}

export type { RecommendKind };
