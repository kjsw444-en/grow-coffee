import { useButtonSound, useSound } from '../audio/SoundProvider';
import { GOAL_AMOUNT, SELL_PRICE } from '../game/constants';
import { formatWon } from '../game/utils';
import './SettingsSheet.css';

type SettingsSheetProps = {
  totalWaters: number;
  totalCoffees: number;
  onReset: () => void;
  onClose: () => void;
};

export function SettingsSheet({
  totalWaters,
  totalCoffees,
  onReset,
  onClose,
}: SettingsSheetProps) {
  const { settings, setSettings } = useSound();
  const buttonSound = useButtonSound();

  const toggleMute = async () => {
    await buttonSound();
    setSettings({ muted: !settings.muted });
  };

  const onSfxVolume = async (value: number) => {
    setSettings({ sfxVolume: value });
  };

  const onAmbientVolume = async (value: number) => {
    setSettings({ ambientVolume: value });
  };

  return (
    <div className="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button type="button" className="settings__backdrop" onClick={onClose} aria-label="닫기" />
      <div className="settings__sheet">
        <h2 id="settings-title">설정</h2>

        <section className="settings__sound" aria-label="사운드 설정">
          <h3 className="settings__sound-title">🔊 사운드</h3>
          <button type="button" className="settings__sound-toggle" onClick={toggleMute}>
            {settings.muted ? '사운드 켜기' : '사운드 끄기'}
          </button>
          <label className="settings__slider">
            <span>효과음</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              disabled={settings.muted}
              onChange={(e) => onSfxVolume(Number(e.target.value))}
            />
          </label>
          <label className="settings__slider">
            <span>배경음</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.ambientVolume}
              disabled={settings.muted}
              onChange={(e) => onAmbientVolume(Number(e.target.value))}
            />
          </label>
        </section>

        <dl className="settings__info">
          <div>
            <dt>개발 단계</dt>
            <dd>1단계 · 프론트엔드</dd>
          </div>
          <div>
            <dt>데이터 저장</dt>
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
              물 준 {totalWaters.toLocaleString('ko-KR')}회 · 판매 {totalCoffees}잔
            </dd>
          </div>
        </dl>
        <p className="settings__warn">
          백엔드 연동 후 서버에 저장되고, 금액은 서버에서만 계산됩니다.
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
