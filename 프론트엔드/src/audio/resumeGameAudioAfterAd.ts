import { soundEngine } from './soundEngine';

/** 전면·리워드 광고 종료 후 Web Audio / 배경음 복구 */
export function resumeGameAudioAfterAd() {
  const resume = () => {
    void soundEngine.recoverAfterAd();
  };
  const resumeFromSettledContext = () => {
    void soundEngine.ensureRunning();
  };

  resume();
  [120, 360, 900, 1800].forEach((delay) => {
    window.setTimeout(resumeFromSettledContext, delay);
  });

  const resumeFromGesture = () => {
    void soundEngine.unlock().then(() => soundEngine.startAmbient());
    window.removeEventListener('pointerdown', resumeFromGesture, true);
    window.removeEventListener('touchstart', resumeFromGesture, true);
    window.removeEventListener('click', resumeFromGesture, true);
  };

  window.addEventListener('pointerdown', resumeFromGesture, { capture: true, once: true, passive: true });
  window.addEventListener('touchstart', resumeFromGesture, { capture: true, once: true, passive: true });
  window.addEventListener('click', resumeFromGesture, { capture: true, once: true, passive: true });
}
