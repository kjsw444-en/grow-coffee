import { soundEngine } from './soundEngine';

/** 전면·리워드 광고 종료 후 Web Audio / 배경음 복구 */
export function resumeGameAudioAfterAd() {
  const resume = () => {
    void soundEngine.ensureRunning().then(() => soundEngine.startAmbient());
  };

  resume();
  [120, 360, 900, 1800].forEach((delay) => {
    window.setTimeout(resume, delay);
  });

  const resumeFromGesture = () => {
    resume();
    window.removeEventListener('pointerdown', resumeFromGesture);
    window.removeEventListener('touchstart', resumeFromGesture);
    window.removeEventListener('click', resumeFromGesture);
  };

  window.addEventListener('pointerdown', resumeFromGesture, { once: true });
  window.addEventListener('touchstart', resumeFromGesture, { once: true });
  window.addEventListener('click', resumeFromGesture, { once: true });
}
