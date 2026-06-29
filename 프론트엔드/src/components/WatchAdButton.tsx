import { getRefillActionLabel } from '../game/utils';

type WatchAdButtonProps = {
  growth: number;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  embedded?: boolean;
  onWatchAd: () => void;
};

export function WatchAdButton({ growth, disabled, loading, loadingLabel, onWatchAd }: WatchAdButtonProps) {
  const label = loading ? (loadingLabel ?? '광고 보는 중…') : getRefillActionLabel(growth);

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
