import { useEffect, useRef } from 'react';
import { attachBannerToElement, type BannerVariant } from '../services/bannerAd';
import './AdBannerSlot.css';

type AdBannerSlotProps = {
  variant: BannerVariant;
  className?: string;
  bannerShape?: 'card' | 'expanded';
};

export function AdBannerSlot({ variant, className, bannerShape = 'card' }: AdBannerSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const destroy = attachBannerToElement(container, variant, { bannerShape });
    return () => {
      destroy?.();
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
