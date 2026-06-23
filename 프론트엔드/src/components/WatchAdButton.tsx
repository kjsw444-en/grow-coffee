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
      <p className={`watch-ad__hint${embedded ? ' watch-ad__hint--embedded' : ''}`}>
        오늘 무료 물주기·내리기 1회 사용
      </p>
      <button
        type="button"
        className="watch-ad__btn"
        disabled={disabled || loading}
        onClick={(event) => {
          event.stopPropagation();
          onWatchAd();
        }}
        aria-label="광고 보고 물주기·내리기 한 잔 더"
      >
        <span className="watch-ad__icon" aria-hidden="true">
          ▶
        </span>
        <span className="watch-ad__label">{loading ? '광고 보는 중...' : '광고 보고 한 잔 더'}</span>
      </button>
    </section>
  );
}
