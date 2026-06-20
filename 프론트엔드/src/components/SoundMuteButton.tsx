import { useSound } from '../audio/SoundProvider';
import './SoundMuteButton.css';

type SoundMuteButtonProps = {
  className?: string;
};

export function SoundMuteButton({ className = '' }: SoundMuteButtonProps) {
  const { settings, setSettings, unlock } = useSound();

  const toggle = async () => {
    await unlock();
    setSettings({ muted: !settings.muted });
  };

  return (
    <button
      type="button"
      className={`sound-mute-btn ${settings.muted ? 'sound-mute-btn--off' : ''} ${className}`.trim()}
      onClick={toggle}
      aria-label={settings.muted ? '사운드 켜기' : '사운드 끄기'}
      aria-pressed={settings.muted}
      title={settings.muted ? '사운드 켜기' : '사운드 끄기'}
    >
      <span aria-hidden="true">{settings.muted ? '🔇' : '🔊'}</span>
    </button>
  );
}
