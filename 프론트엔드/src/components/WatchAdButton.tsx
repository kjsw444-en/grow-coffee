import './WatchAdButton.css';

type WatchAdButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  embedded?: boolean;
  onWatchAd: () => void;
};

export function WatchAdButton({ disabled, loading, embedded = false, onWatchAd }: WatchAdButtonProps) {
  return (
    <section className={`watch-ad ${embedded ? 'watch-ad--embedded' : ''}`}>
      {!embedded && <p className="watch-ad__hint">오늘 무료 성장 1회를 사용했어요</p>}
      <button
        type="button"
        className="watch-ad__btn"
        disabled={disabled || loading}
        onClick={onWatchAd}
        aria-label={embedded ? '오늘 무료 성장 1회를 사용했어요. 광고 보고 한 번 더' : undefined}
      >
        <span className="watch-ad__icon" aria-hidden="true">
          ▶
        </span>
        <span className="watch-ad__label">{loading ? '광고 보는 중...' : '광고 보고 한 번 더'}</span>
      </button>
    </section>
  );
}
