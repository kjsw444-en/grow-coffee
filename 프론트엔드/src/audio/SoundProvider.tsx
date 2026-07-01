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
    const onForeground = () => {
      if (document.hidden) {
        soundEngine.stopAmbient({ immediate: true });
        return;
      }

      void soundEngine.ensureRunning().then(() => {
        if (unlocked && !settings.muted) {
          void soundEngine.startAmbient();
        }
      });
    };

    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);
    window.addEventListener('pageshow', onForeground);

    return () => {
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('pageshow', onForeground);
    };
  }, [unlocked, settings.muted]);

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
    play(sfx);
  }, [unlock, play, sfx]);
}
