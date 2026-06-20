import { formatWon } from '../game/utils';
import { SoundMuteButton } from './SoundMuteButton';
import './UserBar.css';

type UserBarProps = {
  money: number;
  onOpenSettings: () => void;
};

export function UserBar({ money, onOpenSettings }: UserBarProps) {
  return (
    <header className="user-bar">
      <div className="user-bar__profile">
        <span className="user-bar__avatar" aria-hidden="true">
          👧
        </span>
        <div>
          <p className="user-bar__name">이영훈</p>
          <p className="user-bar__meta">랭킹 23위</p>
        </div>
      </div>

      <div className="user-bar__right">
        <div className="user-bar__balance-box">
          <span className="user-bar__coin" aria-hidden="true">
            🪙
          </span>
          <div>
            <p className="user-bar__balance-label">보유 금액</p>
            <p className="user-bar__balance">{formatWon(money)}</p>
          </div>
        </div>
        <SoundMuteButton />
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
}
