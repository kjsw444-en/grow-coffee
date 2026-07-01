import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { soundEngine } from './soundEngine';
import type { SfxId, SoundSettings } from './types';

type SoundContextValue = {
  settings: SoundSettings;
  unlocked: boolean;
  unlock: () => Promise<void>;
  play: (id: SfxId) => void;
  setSettings: (partial: Partial<SoundSettings>) => void;
  startAmbient: () => Promise<void>;
  stopAmbient: () => void;
  startWaterLoop: () => void;
  stopWaterLoop: () => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);
const BUTTON_SOUND_DEDUPE_MS = 160;
let lastButtonSoundAt = 0;

function isSoundableButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const button = target.closest('button, [role="button"]');
  if (!(button instanceof HTMLElement)) return false;
  if (button instanceof HTMLButtonElement && button.disabled) return false;
  if (button.getAttribute('aria-disabled') === 'true') return false;
  return true;
}

function markButtonSoundPlayed() {
  lastButtonSoundAt = performance.now();
}

function shouldSkipDuplicateButtonSound() {
  return performance.now() - lastButtonSoundAt < BUTTON_SOUND_DEDUPE_MS;
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<SoundSettings>(() => soundEngine.getSettings());
  const [unlocked, setUnlocked] = useState(false);

  const unlock = useCallback(async () => {
    await soundEngine.unlock();
    setUnlocked(true);
  }, []);

  const play = useCallback((id: SfxId) => {
    soundEngine.play(id);
  }, []);

  const setSettings = useCallback((partial: Partial<SoundSettings>) => {
    soundEngine.setSettings(partial);
    setSettingsState(soundEngine.getSettings());
    if (partial.muted === true) soundEngine.stopAmbient();
    if (partial.muted === false && unlocked) void soundEngine.startAmbient();
  }, [unlocked]);

  const startAmbient = useCallback(async () => {
    await soundEngine.unlock();
    setUnlocked(true);
    await soundEngine.startAmbient();
  }, []);

  const stopAmbient = useCallback(() => {
    soundEngine.stopAmbient();
  }, []);

  const startWaterLoop = useCallback(() => soundEngine.startWaterLoop(), []);
  const stopWaterLoop = useCallback(() => soundEngine.stopWaterLoop(), []);

  useEffect(() => {
    const onBackground = () => {
      soundEngine.markInterrupted();
    };

    const onForeground = () => {
      if (document.hidden) {
        onBackground();
        return;
      }

      void soundEngine.recoverAfterInterruption().then(() => {
        if (unlocked && !settings.muted) {
          void soundEngine.startAmbient();
        }
      });
    };

    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pagehide', onBackground);
    window.addEventListener('blur', onBackground);
    window.addEventListener('focus', onForeground);
    window.addEventListener('pageshow', onForeground);

    return () => {
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pagehide', onBackground);
      window.removeEventListener('blur', onBackground);
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('pageshow', onForeground);
    };
  }, [unlocked, settings.muted]);

  useEffect(() => {
    if (!unlocked || settings.muted) return;

    const recoverFromGesture = () => {
      void soundEngine.unlock().then(() => {
        if (!settings.muted) {
          void soundEngine.startAmbient();
        }
      });
    };

    window.addEventListener('pointerdown', recoverFromGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', recoverFromGesture, { capture: true, passive: true });
    window.addEventListener('click', recoverFromGesture, { capture: true, passive: true });

    return () => {
      window.removeEventListener('pointerdown', recoverFromGesture, true);
      window.removeEventListener('touchstart', recoverFromGesture, true);
      window.removeEventListener('click', recoverFromGesture, true);
    };
  }, [unlocked, settings.muted]);

  useEffect(() => {
    if (settings.muted) return;

    const playCapturedButtonSound = (event: MouseEvent) => {
      if (!isSoundableButton(event.target)) return;
      if (shouldSkipDuplicateButtonSound()) return;

      markButtonSoundPlayed();
      void soundEngine.unlock().then(() => {
        soundEngine.play('button');
      });
    };

    window.addEventListener('click', playCapturedButtonSound, { capture: true });
    return () => {
      window.removeEventListener('click', playCapturedButtonSound, true);
    };
  }, [settings.muted]);

  const value = useMemo(
    () => ({
      settings,
      unlocked,
      unlock,
      play,
      setSettings,
      startAmbient,
      stopAmbient,
      startWaterLoop,
      stopWaterLoop,
    }),
    [settings, unlocked, unlock, play, setSettings, startAmbient, stopAmbient, startWaterLoop, stopWaterLoop],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used within SoundProvider');
  return ctx;
}

/** 버튼·탭 공통 — 사운드 unlock + 효과음 */
export function useButtonSound(sfx: SfxId = 'button') {
  const { unlock, play } = useSound();
  return useCallback(async () => {
    await unlock();
    if ((sfx === 'button' || sfx === 'tap') && shouldSkipDuplicateButtonSound()) {
      return;
    }
    if (sfx === 'button' || sfx === 'tap') {
      markButtonSoundPlayed();
    }
    play(sfx);
  }, [unlock, play, sfx]);
}
