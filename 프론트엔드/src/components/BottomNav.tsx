import { useButtonSound } from '../audio/SoundProvider';
import './BottomNav.css';

const NAV_ITEMS = [
  { id: 'home', icon: '🏠', label: '홈', active: true },
  { id: 'rank', icon: '🏆', label: '랭킹', active: false },
  { id: 'shop', icon: '🛒', label: '상점', active: false },
  { id: 'record', icon: '📊', label: '기록', active: false },
  { id: 'settings', icon: '⚙', label: '설정', active: false },
] as const;

type BottomNavProps = {
  onSettings: () => void;
};

export function BottomNav({ onSettings }: BottomNavProps) {
  const buttonSound = useButtonSound('tap');

  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav__item ${item.active ? 'bottom-nav__item--active' : ''}`}
          disabled={!item.active && item.id !== 'settings'}
          onClick={
            item.id === 'settings'
              ? async () => {
                  await buttonSound();
                  onSettings();
                }
              : item.active
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
