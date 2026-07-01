import { useState, type FormEvent } from 'react';
import {
  BREWED_COFFEE_DRINK_OPTIONS,
  GOAL_AMOUNT,
  SELL_BATCH_REWARD,
  SELL_BATCH_SIZE,
  SHARE_REWARD_COFFEE_AMOUNT,
} from '../game/constants';
import { formatDrunkCoffeePurchaseCost } from '../game/coffeeVariants';
import { formatWon } from '../game/utils';
import type { AuthUser } from '../hooks/useAuth';
import './SettingsSheet.css';

const DRINK_VIDEO_ENABLED_STORAGE_KEY = 'grow-coffee-drink-video-enabled';
const DRINK_VIDEO_SETTING_CHANGE_EVENT = 'grow-coffee-drink-video-setting-change';
const RESET_OPERATOR_CODE = 'kjsw444@gmail.com';
const COFFEE_GRANT_OPERATOR_CODE = 'kjsw444@naver.com';

function readDrinkVideoEnabled() {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(DRINK_VIDEO_ENABLED_STORAGE_KEY) !== 'off';
}

type SettingsSheetProps = {
  user: AuthUser;
  totalWaters: number;
  totalCoffees: number;
  loggingIn: boolean;
  authMessage: string;
  isTossInApp: boolean;
  onLoginWithToss: () => void;
  onLogout: () => void;
  onReset: () => void | Promise<void>;
  onOperatorGrantCoffee: () => void | Promise<void>;
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
  onOperatorGrantCoffee,
  onClose,
}: SettingsSheetProps) {
  const isTossLinked = user.source === 'toss';
  const [drinkVideoEnabled, setDrinkVideoEnabled] = useState(readDrinkVideoEnabled);
  const [operatorCode, setOperatorCode] = useState('');
  const [operatorMessage, setOperatorMessage] = useState('');
  const [codeInputOpen, setCodeInputOpen] = useState(false);
  const drinkOptionsLabel = BREWED_COFFEE_DRINK_OPTIONS.map(
    (cups) => `${cups.toLocaleString('ko-KR')}잔`,
  ).join(' · ');

  const toggleDrinkVideo = () => {
    const next = !drinkVideoEnabled;
    localStorage.setItem(DRINK_VIDEO_ENABLED_STORAGE_KEY, next ? 'on' : 'off');
    window.dispatchEvent(new Event(DRINK_VIDEO_SETTING_CHANGE_EVENT));
    setDrinkVideoEnabled(next);
  };

  const handleOperatorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = operatorCode.trim();

    if (code === RESET_OPERATOR_CODE) {
      setOperatorMessage('코드 확인: 진행 데이터를 초기화합니다.');
      await onReset();
      setOperatorCode('');
      return;
    }

    if (code === COFFEE_GRANT_OPERATOR_CODE) {
      setOperatorMessage('코드 확인: 커피 1,000잔씩 지급합니다.');
      await onOperatorGrantCoffee();
      setOperatorCode('');
      return;
    }

    setOperatorMessage('코드가 올바르지 않아요.');
  };

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

        <section className="settings__guide" aria-labelledby="settings-guide-title">
          <h3 id="settings-guide-title">게임 안내</h3>

          <div className="settings__guide-block settings__video-setting">
            <div>
              <h4>커피 마시기 동영상</h4>
              <p>
                100%에서 커피 마시기를 누를 때 영상을 볼지 정해요. 끄면 커피별 이미지가 보이고,
                바로 보상 룰렛으로 넘어가요.
              </p>
            </div>
            <button type="button" className="settings__video-toggle" onClick={toggleDrinkVideo}>
              {drinkVideoEnabled ? '동영상 켜짐' : '동영상 꺼짐'}
            </button>
          </div>

          <div className="settings__guide-block">
            <h4>커피나무 키우기</h4>
            <p>
              물 주기 버튼을 2초 꾹 눌러 성장시키고, 100%가 되면 커피를 마실 수 있어요. 물이 부족하면
              광고를 보고 채울 수 있고, 방치·공유·미니게임으로 커피를 더 모을 수 있어요.
            </p>
          </div>

          <div className="settings__guide-block">
            <h4>커피값 적립</h4>
            <p>
              내린 커피를 마시면 커피값이 쌓여요. {formatWon(GOAL_AMOUNT)} 목표에 도달하면 토스
              포인트로 확인할 수 있어요. ({SELL_BATCH_SIZE}잔 마시기마다 {formatWon(SELL_BATCH_REWARD)}
              )
            </p>
          </div>

          <div className="settings__guide-block">
            <h4>내린 커피 · 마신 커피</h4>
            <p>
              내린 커피는 성장·방치·미니게임·룰렛 등으로 모아요. 마신 커피(
              {formatDrunkCoffeePurchaseCost()})는 상점에서 캐릭터를 구매할 때 써요. 마시기 옵션:{' '}
              {drinkOptionsLabel}
            </p>
          </div>

          <div className="settings__guide-block">
            <h4>매일 이벤트 · 보너스</h4>
            <p>
              1일 1룰렛, 오늘의 커피 운세, 친구 공유(+{SHARE_REWARD_COFFEE_AMOUNT}잔), 히든 커플
              영상 등 다양한 보너스가 있어요.
            </p>
          </div>
        </section>

        <dl className="settings__info">
          <div>
            <dt>플레이 기록</dt>
            <dd>
              물 준 {totalWaters.toLocaleString('ko-KR')}회 · 내린 커피 {totalCoffees}잔
            </dd>
          </div>
        </dl>
        <p className="settings__warn">
          게임 진행은 서버에 저장되고, 금액은 서버에서만 계산됩니다.
        </p>
        <div className="settings__operator">
          {!codeInputOpen ? (
            <button
              type="button"
              className="settings__operator-open"
              onClick={() => {
                setCodeInputOpen(true);
                setOperatorMessage('');
              }}
            >
              코드
            </button>
          ) : (
            <form onSubmit={(event) => void handleOperatorSubmit(event)}>
              <div className="settings__operator-row">
                <input
                  id="settings-operator-code"
                  type="password"
                  value={operatorCode}
                  onChange={(event) => {
                    setOperatorCode(event.target.value);
                    if (operatorMessage) setOperatorMessage('');
                  }}
                  placeholder="코드 입력"
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit">확인</button>
              </div>
              {operatorMessage ? <p className="settings__operator-message">{operatorMessage}</p> : null}
            </form>
          )}
        </div>
        <button type="button" className="settings__close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
