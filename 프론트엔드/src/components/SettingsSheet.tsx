import { GOAL_AMOUNT, SELL_PRICE } from '../game/constants';
import { formatWon } from '../game/utils';
import type { AuthUser } from '../hooks/useAuth';
import './SettingsSheet.css';

type SettingsSheetProps = {
  user: AuthUser;
  totalWaters: number;
  totalCoffees: number;
  loggingIn: boolean;
  authMessage: string;
  isTossInApp: boolean;
  onLoginWithToss: () => void;
  onLogout: () => void;
  onReset: () => void;
  onClose: () => void;
};

function sessionLabel(source: AuthUser['source']) {
  if (source === 'toss') return '토스 로그인';
  if (source === 'guest') return '게스트 세션';
  if (source === 'mock') return '임시 데이터 (MOCK)';
  return '오프라인';
}

export function SettingsSheet({
  user,
  totalWaters,
  totalCoffees,
  loggingIn,
  authMessage,
  isTossInApp,
  onLoginWithToss,
  onLogout,
  onReset,
  onClose,
}: SettingsSheetProps) {
  const isTossLinked = user.source === 'toss';

  return (
    <div className="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button type="button" className="settings__backdrop" onClick={onClose} aria-label="닫기" />
      <div className="settings__sheet">
        <h2 id="settings-title">설정</h2>

        <section className="settings__login">
          <div className="settings__login-head">
            <span>계정</span>
            <strong>{sessionLabel(user.source)}</strong>
          </div>
          <p className="settings__login-name">{user.name}</p>
          {authMessage && <p className="settings__login-msg">{authMessage}</p>}
          {isTossLinked ? (
            <button type="button" className="settings__toss settings__toss--linked" disabled>
              토스 연동됨
            </button>
          ) : (
            <button
              type="button"
              className="settings__toss"
              onClick={onLoginWithToss}
              disabled={loggingIn || !isTossInApp}
            >
              {loggingIn ? '로그인 중...' : '토스 로그인'}
            </button>
          )}
          {!isTossInApp && !isTossLinked && (
            <p className="settings__login-hint">토스 샌드박스 앱에서만 로그인할 수 있어요.</p>
          )}
          {user.source !== 'mock' && (
            <button type="button" className="settings__logout" onClick={onLogout}>
              로그아웃
            </button>
          )}
        </section>

        <dl className="settings__info">
          <div>
            <dt>개발 단계</dt>
            <dd>1단계 · 프론트 + 토스 로그인 UI</dd>
          </div>
          <div>
            <dt>게임 데이터</dt>
            <dd>localStorage (임시)</dd>
          </div>
          <div>
            <dt>목표 / 컵당</dt>
            <dd>
              {formatWon(GOAL_AMOUNT)} / {formatWon(SELL_PRICE)}
            </dd>
          </div>
          <div>
            <dt>플레이 기록</dt>
            <dd>
              물 준 {totalWaters.toLocaleString('ko-KR')}회 · 마신 커피 {totalCoffees}잔
            </dd>
          </div>
        </dl>
        <p className="settings__warn">
          백엔드 연동 후 게임 진행은 서버에 저장되고, 금액은 서버에서만 계산됩니다.
        </p>
        <button type="button" className="settings__reset" onClick={onReset}>
          진행 데이터 초기화
        </button>
        <button type="button" className="settings__close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

