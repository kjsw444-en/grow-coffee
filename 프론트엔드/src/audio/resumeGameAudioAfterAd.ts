import { soundEngine } from './soundEngine';

/** 전면·리워드 광고 종료 후 Web Audio / 배경음 복구 */
export function resumeGameAudioAfterAd() {
  void soundEngine.ensureRunning().then(() => soundEngine.startAmbient());
}
