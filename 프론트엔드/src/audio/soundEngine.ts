import { defaultSoundSettings, SOUND_SETTINGS_KEY, type SfxId, type SoundSettings } from './types';

function loadSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(SOUND_SETTINGS_KEY);
    if (!raw) return defaultSoundSettings;
    return { ...defaultSoundSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSoundSettings;
  }
}

function saveSettings(settings: SoundSettings) {
  localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(settings));
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private ambientStarted = false;
  private ambientStopTimer: ReturnType<typeof setTimeout> | null = null;
  private unlocked = false;
  private settings: SoundSettings = loadSettings();
  private waterTickTimer: ReturnType<typeof setInterval> | null = null;

  private ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.applyVolumes();
    }
    return this.ctx;
  }

  private applyVolumes() {
    if (!this.masterGain || !this.sfxGain || !this.ambientGain) return;
    const { muted, sfxVolume, ambientVolume } = this.settings;
    this.masterGain.gain.value = muted ? 0 : 1;
    this.sfxGain.gain.value = sfxVolume;
    if (this.ambientStarted && !muted) {
      this.fadeAmbientGain(ambientVolume, 0.4);
    } else {
      this.ambientGain.gain.value = muted ? 0 : ambientVolume;
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  setSettings(partial: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...partial };
    saveSettings(this.settings);
    this.applyVolumes();
  }

  async unlock() {
    const ctx = this.ensureContext();
    if (!ctx || this.unlocked) return;
    if (ctx.state === 'suspended') await ctx.resume();
    this.unlocked = true;
  }

  private tone(
    freq: number,
    duration: number,
    opts: {
      type?: OscillatorType;
      volume?: number;
      attack?: number;
      release?: number;
      detune?: number;
    } = {},
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.settings.muted) return;

    const {
      type = 'sine',
      volume = 0.18,
      attack = 0.012,
      release = 0.08,
      detune = 0,
    } = opts;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.start(now);
    osc.stop(now + duration + release);
  }

  private chord(
    freqs: number[],
    duration: number,
    volume = 0.12,
  ) {
    freqs.forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, duration * 0.85, { volume: volume * 0.9, release: 0.15 }), i * 55);
    });
  }

  play(id: SfxId) {
    if (this.settings.muted) return;

    switch (id) {
      case 'tap':
      case 'button':
        this.tone(740, 0.06, { volume: 0.14, type: 'triangle' });
        break;
      case 'modalOpen':
        this.chord([392, 494, 587], 0.22, 0.1);
        break;
      case 'modalClose':
        this.tone(523, 0.1, { volume: 0.1, release: 0.12 });
        break;
      case 'waterStart':
        this.tone(330, 0.14, { volume: 0.12, type: 'sine' });
        this.tone(440, 0.1, { volume: 0.08, release: 0.1 });
        break;
      case 'waterTick':
        this.tone(520 + Math.random() * 40, 0.04, { volume: 0.05, type: 'sine' });
        break;
      case 'waterComplete':
        this.chord([523, 659, 784], 0.35, 0.14);
        break;
      case 'waterCancel':
        this.tone(280, 0.16, { volume: 0.09, release: 0.14 });
        break;
      case 'growth':
        this.chord([587, 740, 880], 0.28, 0.11);
        break;
      case 'harvest':
        this.chord([440, 554, 659], 0.32, 0.13);
        window.setTimeout(() => this.play('coin'), 120);
        break;
      case 'slotRoll':
        [0, 90, 180, 270, 360, 450, 540, 630, 720, 810].forEach((delay, index) => {
          window.setTimeout(() => {
            this.tone(520 + (index % 5) * 55, 0.035, {
              volume: 0.07,
              type: 'square',
              attack: 0.004,
              release: 0.025,
            });
          }, delay);
        });
        break;
      case 'slotStop':
        this.tone(740, 0.08, { volume: 0.11, type: 'triangle', release: 0.06 });
        window.setTimeout(() => this.tone(1046, 0.1, { volume: 0.1, type: 'triangle' }), 80);
        break;
      case 'coin':
        this.tone(988, 0.12, { volume: 0.12, type: 'triangle' });
        this.tone(1318, 0.1, { volume: 0.08, release: 0.1 });
        break;
      case 'win':
        this.chord([523, 659, 784, 988], 0.5, 0.13);
        window.setTimeout(() => this.chord([587, 740, 880], 0.45, 0.11), 280);
        break;
      case 'error':
        this.tone(220, 0.14, { volume: 0.08, type: 'triangle' });
        break;
      case 'stonePlace':
        this.tone(196, 0.07, { volume: 0.16, type: 'triangle', release: 0.06 });
        this.tone(98, 0.09, { volume: 0.1, release: 0.08 });
        break;
      case 'stonePlaceAi':
        this.tone(280, 0.05, { volume: 0.11, type: 'sine', release: 0.05 });
        this.tone(420, 0.04, { volume: 0.07, type: 'triangle', release: 0.04 });
        break;
      case 'memoryFlash':
        this.tone(660, 0.08, { volume: 0.1, type: 'sine' });
        this.tone(880, 0.06, { volume: 0.06, type: 'triangle', release: 0.05 });
        break;
      case 'memoryTap':
        this.tone(740, 0.05, { volume: 0.12, type: 'triangle' });
        break;
      case 'memoryWrong':
        this.tone(240, 0.12, { volume: 0.09, type: 'triangle', release: 0.1 });
        this.tone(180, 0.1, { volume: 0.07, type: 'triangle', release: 0.12 });
        break;
      case 'cardFlip':
        this.tone(520, 0.04, { volume: 0.08, type: 'triangle', release: 0.03 });
        this.tone(780, 0.03, { volume: 0.05, type: 'sine', release: 0.03 });
        break;
      case 'cardMatch':
        this.chord([523, 659], 0.18, 0.1);
        break;
      case 'cardMismatch':
        this.tone(300, 0.08, { volume: 0.07, type: 'triangle', release: 0.08 });
        break;
      case 'minigameLose':
        this.tone(220, 0.16, { volume: 0.09, type: 'triangle', release: 0.14 });
        this.tone(165, 0.2, { volume: 0.07, type: 'triangle', release: 0.16 });
        break;
      default:
        break;
    }
  }

  startWaterLoop() {
    this.stopWaterLoop();
    this.waterTickTimer = setInterval(() => this.play('waterTick'), 700);
  }

  stopWaterLoop() {
    if (this.waterTickTimer) {
      clearInterval(this.waterTickTimer);
      this.waterTickTimer = null;
    }
  }

  private createSoftPad(ctx: AudioContext) {
    if (!this.ambientGain) return;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 320;
    lowpass.Q.value = 0.5;

    const padMaster = ctx.createGain();
    padMaster.gain.value = 1;
    lowpass.connect(padMaster);
    padMaster.connect(this.ambientGain);

    const notes = [
      { freq: 65.41, gain: 0.0028 },
      { freq: 82.41, gain: 0.0022 },
      { freq: 98.0, gain: 0.0018 },
    ];

    notes.forEach(({ freq, gain }) => {
      const osc = ctx.createOscillator();
      const voice = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      voice.gain.value = gain;
      osc.connect(voice);
      voice.connect(lowpass);
      osc.start();
      this.ambientNodes.push(osc, voice);
    });

    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05;
    lfoDepth.gain.value = 0.08;
    lfo.connect(lfoDepth);
    lfoDepth.connect(padMaster.gain);
    lfo.start();

    this.ambientNodes.push(lfo, lfoDepth, padMaster, lowpass);
  }

  private fadeAmbientGain(target: number, durationSec = 2.2) {
    const ctx = this.ctx;
    if (!ctx || !this.ambientGain) return;
    const now = ctx.currentTime;
    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
    this.ambientGain.gain.linearRampToValueAtTime(target, now + durationSec);
  }

  async startAmbient() {
    const ctx = this.ensureContext();
    if (!ctx || !this.ambientGain || this.ambientStarted || this.settings.muted) return;
    if (ctx.state === 'suspended') await ctx.resume();

    this.stopAmbient({ immediate: true });

    const targetVol = this.settings.ambientVolume;
    this.ambientGain.gain.setValueAtTime(0, ctx.currentTime);

    this.createSoftPad(ctx);

    this.fadeAmbientGain(targetVol, 3);
    this.ambientStarted = true;
  }

  stopAmbient(opts: { immediate?: boolean } = {}) {
    if (this.ambientStopTimer) {
      clearTimeout(this.ambientStopTimer);
      this.ambientStopTimer = null;
    }

    const disconnect = () => {
      this.ambientNodes.forEach((node) => {
        try {
          if ('stop' in node && typeof node.stop === 'function') node.stop();
          node.disconnect();
        } catch {
          /* already stopped */
        }
      });
      this.ambientNodes = [];
      this.ambientStarted = false;
    };

    if (opts.immediate || !this.ambientGain || !this.ctx) {
      disconnect();
      return;
    }

    this.fadeAmbientGain(0, 0.8);
    this.ambientStopTimer = setTimeout(disconnect, 900);
  }
}

export const soundEngine = new SoundEngine();
