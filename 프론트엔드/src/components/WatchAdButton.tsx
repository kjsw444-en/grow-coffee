import { getRefillActionLabel } from '../game/utils';

type WatchAdButtonProps = {
  growth: number;
  disabled?: boolean;
  loading?: boolean;
  embedded?: boolean;
  onWatchAd: () => void;
};

export function WatchAdButton({ growth, disabled, loading, onWatchAd }: WatchAdButtonProps) {
  const label = loading ? '준비 중…' : getRefillActionLabel(growth);

  return (
    <button
      type="button"
      className={`plant-scene__drink-btn plant-scene__drink-btn--prominent${loading ? ' plant-scene__drink-btn--loading' : ''}`}
      disabled={disabled || loading}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onWatchAd();
      }}
    >
      {label}
    </button>
  );
}
