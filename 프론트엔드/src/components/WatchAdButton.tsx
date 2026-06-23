import './WatchAdButton.css';

type WatchAdButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onWatchAd: () => void;
};

export function WatchAdButton({ disabled, loading, onWatchAd }: WatchAdButtonProps) {
  return (
    <section className="watch-ad">
      <p className="watch-ad__hint">오늘 물주기를 모두 사용했어요</p>
      <button
        type="button"
        className="watch-ad__btn"
        disabled={disabled || loading}
        onClick={onWatchAd}
      >
        <span className="watch-ad__icon" aria-hidden="true">
          ▶
        </span>
        <span className="watch-ad__label">{loading ? '광고 보는 중...' : '광고 보고 물주기'}</span>
      </button>
    </section>
  );
}
