/** Legacy single-step onboarding (v1) — reset 시 함께 제거 */
const LEGACY_ONBOARDING_KEY = 'grow-coffee-onboarded-v1';

export const WELCOME_ONBOARDING_KEY = 'grow-coffee-welcome-v1';
export const INTERACTIVE_TUTORIAL_KEY = 'grow-coffee-tutorial-v1';
export const ONBOARDING_RESET_EVENT = 'grow-coffee-onboarding-reset';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // localStorage unavailable
  }
}

export function hasSeenWelcomeOnboarding(): boolean {
  return readFlag(WELCOME_ONBOARDING_KEY);
}

export function markWelcomeOnboardingComplete(): void {
  writeFlag(WELCOME_ONBOARDING_KEY);
}

export function hasCompletedInteractiveTutorial(): boolean {
  return readFlag(INTERACTIVE_TUTORIAL_KEY);
}

export function markInteractiveTutorialComplete(): void {
  writeFlag(INTERACTIVE_TUTORIAL_KEY);
}

export function getOnboardingUiState(): { showWelcome: boolean; tutorialActive: boolean } {
  const seenWelcome = hasSeenWelcomeOnboarding();
  const completedTutorial = hasCompletedInteractiveTutorial();
  return {
    showWelcome: !seenWelcome,
    tutorialActive: seenWelcome && !completedTutorial,
  };
}

/** 신규 접속과 동일 — localStorage 초기화 + 같은 탭에서 즉시 온보딩 재표시 */
export function resetOnboardingStorage(): void {
  try {
    localStorage.removeItem(WELCOME_ONBOARDING_KEY);
    localStorage.removeItem(INTERACTIVE_TUTORIAL_KEY);
    localStorage.removeItem(LEGACY_ONBOARDING_KEY);
    window.dispatchEvent(new Event(ONBOARDING_RESET_EVENT));
  } catch {
    // localStorage unavailable
  }
}
