export type SfxId =
  | 'tap'
  | 'button'
  | 'modalOpen'
  | 'modalClose'
  | 'waterStart'
  | 'waterTick'
  | 'waterComplete'
  | 'waterCancel'
  | 'growth'
  | 'harvest'
  | 'coin'
  | 'win'
  | 'error';

export type SoundSettings = {
  muted: boolean;
  sfxVolume: number;
  ambientVolume: number;
};

export const SOUND_SETTINGS_KEY = 'grow-coffee-sound-v1';

export const defaultSoundSettings: SoundSettings = {
  muted: false,
  sfxVolume: 0.72,
  ambientVolume: 0.1,
};
