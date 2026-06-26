import { memo } from 'react';
import { formatWon } from '../game/utils';
import type { AuthUser } from '../hooks/useAuth';
import { SoundMuteButton } from './SoundMuteButton';
import './UserBar.css';

type UserBarProps = {
  money: number;
  user: AuthUser;
  onOpenSettings: () => void;
  onCoffeeValuePress?: () => void;
};

function sessionLabel(source: AuthUser['source']) {
  if (source === 'toss') return '토스 연동';
  if (source === 'guest') return '게스트';
  if (source === 'mock') return '임시 데이터';
  return '오프라인';
}

export const UserBar = memo(function UserBar({ money, user, onOpenSettings, onCoffeeValuePress }: UserBarProps) {
  const meta =
    user.rank !== null ? `랭킹 ${user.rank}위 · ${sessionLabel(user.source)}` : sessionLabel(user.source);

  return (
    <header className="user-bar">
      <div className="user-bar__profile">
        <span className="user-bar__avatar" aria-hidden="true">
          {user.source === 'toss' ? '☕' : '👧'}
        </span>
        <div>
          <p className="user-bar__name">{user.name}</p>
          <p className="user-bar__meta">{meta}</p>
        </div>
      </div>

      <div className="user-bar__right">
        <SoundMuteButton className="user-bar__mute" />
        <button
          type="button"
          className="user-bar__balance-box"
          onClick={onCoffeeValuePress}
          aria-label={`커피값 ${formatWon(money)} · 지금까지 지급받은 실제 커피값 수치`}
        >
          <span className="user-bar__coin" aria-hidden="true">
            🪙
          </span>
          <div>
            <p className="user-bar__balance-label">커피값</p>
            <p className="user-bar__balance">{formatWon(money)}</p>
          </div>
        </button>
        <button
          type="button"
          className="user-bar__settings"
          onClick={onOpenSettings}
          aria-label="설정"
        >
          ⚙
        </button>
      </div>
    </header>
  );
});
