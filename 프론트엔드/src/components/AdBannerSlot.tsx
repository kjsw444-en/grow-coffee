import { useEffect, useRef } from 'react';
import { attachBannerToElement, initBannerAds, type BannerVariant } from '../services/bannerAd';
import './AdBannerSlot.css';

type AdBannerSlotProps = {
  variant: BannerVariant;
  className?: string;
  bannerShape?: 'card' | 'expanded';
};

const ATTACH_RETRY_MS = 600;
const MAX_ATTACH_ATTEMPTS = 8;

export function AdBannerSlot({ variant, className, bannerShape = 'card' }: AdBannerSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    initBannerAds();

    let destroyed: (() => void) | null = null;
    let retryTimer: number | null = null;
    let attempts = 0;

    const cleanup = () => {
      if (retryTimer != null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      destroyed?.();
      destroyed = null;
    };

    const tryAttach = () => {
      destroyed?.();
      destroyed = null;

      const destroy = attachBannerToElement(container, variant, { bannerShape });
      if (destroy) {
        destroyed = destroy;
        return;
      }

      attempts += 1;
      if (attempts >= MAX_ATTACH_ATTEMPTS) {
        return;
      }

      retryTimer = window.setTimeout(tryAttach, ATTACH_RETRY_MS);
    };

    const frame = window.requestAnimationFrame(tryAttach);

    return () => {
      window.cancelAnimationFrame(frame);
      cleanup();
    };
  }, [variant, bannerShape]);

  return (
    <div
      ref={containerRef}
      className={`ad-banner-slot ad-banner-slot--${variant} ${className ?? ''}`.trim()}
      aria-label={variant === 'list' ? '텍스트 배너' : '이미지 배너'}
    />
  );
}
