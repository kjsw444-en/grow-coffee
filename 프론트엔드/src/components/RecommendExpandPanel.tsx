import type { RecommendKind } from '../services/recommendDaily';
import type { RecommendMenuItem } from '../services/recommendTypes';
import { RecommendMenuCard } from './RecommendMenuCard';
import './RecommendButtons.css';

type RecommendExpandPanelProps = {
  item: RecommendMenuItem;
  onReroll: () => void;
  label: string;
  rerollLoading?: boolean;
  rerollNotice?: string | null;
};

export function RecommendExpandPanel({
  item,
  onReroll,
  label,
  rerollLoading = false,
  rerollNotice = null,
}: RecommendExpandPanelProps) {
  return (
    <div className="recommend-buttons__menu-panel" role="region" aria-label={label}>
      <RecommendMenuCard item={item} />
      <div className="recommend-buttons__reroll-wrap">
        <button
          type="button"
          className={`recommend-buttons__reroll-btn${rerollLoading ? ' recommend-buttons__reroll-btn--loading' : ''}`}
          disabled={rerollLoading}
          onClick={onReroll}
        >
          {rerollLoading ? '리워드 광고 준비 중…' : '한번 더'}
        </button>
        {rerollNotice ? (
          <p className="recommend-buttons__reroll-notice" role="status">
            {rerollNotice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type { RecommendKind };
