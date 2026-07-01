import { memo } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import './BottomNav.css';

const NAV_ITEMS = [
  { id: 'home', icon: '🏠', label: '홈', active: true },
  { id: 'rank', icon: '🏆', label: '랭킹', active: true },
  { id: 'shop', icon: '🛒', label: '상점', active: true },
  { id: 'myCoffee', icon: '☕', label: '내 커피', active: true },
  { id: 'settings', icon: '⚙', label: '설정', active: true },
] as const;

type BottomNavProps = {
  rankingEnabled?: boolean;
  onRank: () => void;
  onShop: () => void;
  onMyCoffee: () => void;
  onSettings: () => void;
};

export const BottomNav = memo(function BottomNav({
  rankingEnabled = true,
  onRank,
  onShop,
  onMyCoffee,
  onSettings,
}: BottomNavProps) {
  const buttonSound = useButtonSound('tap');

  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      {NAV_ITEMS.map((item) => {
        const active = item.id === 'rank' ? rankingEnabled : item.active;

        return (
          <button
            key={item.id}
            type="button"
            className={`bottom-nav__item ${active ? 'bottom-nav__item--active' : ''}`}
            disabled={!active}
          onClick={
            item.id === 'settings'
              ? async () => {
                  await buttonSound();
                  onSettings();
                }
              : item.id === 'shop'
                ? async () => {
                    await buttonSound();
                    onShop();
                  }
                : item.id === 'rank'
                  ? async () => {
                      await buttonSound();
                      onRank();
                    }
                  : item.id === 'myCoffee'
                    ? async () => {
                        await buttonSound();
                        onMyCoffee();
                      }
                    : item.id === 'home'
                    ? async () => buttonSound()
                    : undefined
          }
            title={active ? undefined : '준비 중'}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
});
