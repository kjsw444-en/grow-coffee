import { useButtonSound } from '../audio/SoundProvider';
import './BottomNav.css';

const NAV_ITEMS = [
  { id: 'home', icon: '🏠', label: '홈', active: true },
  { id: 'rank', icon: '🏆', label: '랭킹', active: true },
  { id: 'shop', icon: '🛒', label: '상점', active: true },
  { id: 'record', icon: '📊', label: '기록', active: false },
  { id: 'settings', icon: '⚙', label: '설정', active: true },
] as const;

type BottomNavProps = {
  onRank: () => void;
  onShop: () => void;
  onSettings: () => void;
};

export function BottomNav({ onRank, onShop, onSettings }: BottomNavProps) {
  const buttonSound = useButtonSound('tap');

  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav__item ${item.active ? 'bottom-nav__item--active' : ''}`}
          disabled={!item.active}
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
                  : item.id === 'home'
                    ? async () => buttonSound()
                    : undefined
          }
          title={item.active ? undefined : '준비 중'}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
