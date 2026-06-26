import { requestReview } from '@apps-in-toss/web-framework';
import { isTossInApp } from './tossBridge';

/** 리뷰 유도 트리거 — 긍정 경험 직후만 사용 */
export type ReviewTrigger =
  | 'daily-point-cap'
  | 'daily-ranking-top3'
  | 'attendance-streak-7'
  | 'hidden-character-unlock'
  | 'brewed-spent-200'
  | 'shop-purchase-2';

export const REVIEW_TRIGGERS: ReviewTrigger[] = [
  'daily-point-cap',
  'daily-ranking-top3',
  'attendance-streak-7',
  'hidden-character-unlock',
  'brewed-spent-200',
  'shop-purchase-2',
];

export const REVIEW_TRIGGER_LABELS: Record<ReviewTrigger, string> = {
  'daily-point-cap': '오늘 4,700원',
  'daily-ranking-top3': '일일 랭킹 TOP3',
  'attendance-streak-7': '7일 출석',
  'hidden-character-unlock': '히든 해금',
  'brewed-spent-200': '내린 커피 200잔',
  'shop-purchase-2': '상점 2회 구매',
};

const STORAGE_KEY = 'grow-coffee-review-milestones';
const MAX_LIFETIME_REQUESTS = 1;
const MIN_DAYS_BETWEEN = 14;

const PREVIEW_PRIME_DELAY_MS = 400;
const PREVIEW_REQUEST_DELAY_MS = 900;

export function isReviewPreviewEnabled() {
  return import.meta.env.DEV;
}

/** 성취 직후 프라이밍 (씬 대사용) */
export const REVIEW_PRIMING_COPY: Record<ReviewTrigger, string> = {
  'daily-point-cap':
    '오늘 커피 한 잔 값, 4,700원 채웠어요! ☕\n\n내일도 함께 키워요.\n재미있다면 토스에 짧은 후기를 남겨 주세요.',
  'daily-ranking-top3':
    '오늘의 커피 랭킹 TOP3에 들었어요! ☕\n\n커피값 프로모션에 참여해 주셔서 감사해요.\n재미있었다면 토스에 짧은 후기를 남겨 주세요.',
  'attendance-streak-7':
    '7일 연속 출석, 대단해요! 🎉\n\n매일 돌아오는 재미가 있다면\n후기로 커피 농부들에게도 알려 주세요.',
  'hidden-character-unlock':
    '히든 커플 커피를 만났어요! 💕\n\n이 설렘이 좋았다면\n토스 후기로 다른 농부에게도 알려 주세요.',
  'brewed-spent-200':
    '내린 커피 200잔, 대단해요! ☕\n\n커피 여정이 즐겁다면\n토스에 짧은 후기를 남겨 주세요.',
  'shop-purchase-2':
    '커피 친구가 늘어났어요! 🛍️\n\n상점이 재미있다면\n다른 농부에게도 알려 주세요.',
};

/** 성취 메시지를 읽을 시간 → 네이티브 리뷰 요청 */
export const REVIEW_DELAY_MS: Record<ReviewTrigger, number> = {
  'daily-point-cap': 2600,
  'daily-ranking-top3': 2600,
  'attendance-streak-7': 2200,
  'hidden-character-unlock': 2400,
  'brewed-spent-200': 2400,
  'shop-purchase-2': 2200,
};

/** 보상 대사 후 프라이밍 카피까지 대기 */
const REVIEW_PRIME_DELAY_MS: Record<ReviewTrigger, number> = {
  'daily-point-cap': 2000,
  'daily-ranking-top3': 1800,
  'attendance-streak-7': 1800,
  'hidden-character-unlock': 1600,
  'brewed-spent-200': 1800,
  'shop-purchase-2': 1600,
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type ReviewMilestoneStore = {
  triggers: ReviewTrigger[];
  lastAt: number | null;
};

function loadStore(): ReviewMilestoneStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { triggers: [], lastAt: null };
    }
    const parsed = JSON.parse(raw) as Partial<ReviewMilestoneStore>;
    return {
      triggers: Array.isArray(parsed.triggers) ? parsed.triggers.filter(isReviewTrigger) : [],
      lastAt: typeof parsed.lastAt === 'number' ? parsed.lastAt : null,
    };
  } catch {
    return { triggers: [], lastAt: null };
  }
}

function saveStore(store: ReviewMilestoneStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function isReviewTrigger(value: unknown): value is ReviewTrigger {
  return REVIEW_TRIGGERS.includes(value as ReviewTrigger);
}

function daysSince(timestamp: number) {
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

export function canPromptReview(trigger: ReviewTrigger) {
  if (!isTossInApp()) {
    return false;
  }

  if (!requestReview.isSupported()) {
    return false;
  }

  const store = loadStore();
  if (store.triggers.includes(trigger)) {
    return false;
  }

  if (store.triggers.length >= MAX_LIFETIME_REQUESTS) {
    return false;
  }

  if (store.lastAt != null && daysSince(store.lastAt) < MIN_DAYS_BETWEEN) {
    return false;
  }

  return true;
}

export function getReviewPrimingCopy(trigger: ReviewTrigger) {
  return REVIEW_PRIMING_COPY[trigger];
}

function markRequested(trigger: ReviewTrigger) {
  const store = loadStore();
  if (store.triggers.includes(trigger)) {
    return;
  }

  saveStore({
    triggers: [...store.triggers, trigger],
    lastAt: Date.now(),
  });
}

async function runReviewPromptFlow({
  trigger,
  onPrime,
  delayMs,
  invokeNative,
  fastPreview = false,
}: {
  trigger: ReviewTrigger;
  onPrime?: (copy: string) => void;
  delayMs?: number;
  invokeNative: boolean;
  fastPreview?: boolean;
}) {
  const primeDelay = fastPreview ? PREVIEW_PRIME_DELAY_MS : REVIEW_PRIME_DELAY_MS[trigger];
  const requestDelay = fastPreview
    ? PREVIEW_REQUEST_DELAY_MS
    : (delayMs ?? REVIEW_DELAY_MS[trigger]);

  if (onPrime && primeDelay > 0) {
    await sleep(primeDelay);
    onPrime(getReviewPrimingCopy(trigger));
    await sleep(requestDelay);
  } else {
    await sleep(requestDelay);
  }

  if (!invokeNative) {
    return;
  }

  if (!canPromptReview(trigger)) {
    return;
  }

  try {
    await requestReview();
  } catch {
    // 게임 흐름 유지 — 리뷰 실패는 무시
  } finally {
    markRequested(trigger);
  }
}

/**
 * 긍정 순간 직후 리뷰 요청.
 * - onPrime: 네이티브 팝업 전 짧은 프라이밍 카피 표시
 * - UI가 뜨지 않아도 호출 기록은 남김 (토스 정책)
 */
export async function scheduleReviewPrompt({
  trigger,
  onPrime,
  delayMs,
}: {
  trigger: ReviewTrigger;
  onPrime?: (copy: string) => void;
  delayMs?: number;
}) {
  if (!canPromptReview(trigger)) {
    return;
  }

  await runReviewPromptFlow({ trigger, onPrime, delayMs, invokeNative: true });
}

/** DEV — 실제 requestReview 없이 타이밍·카피만 미리보기 */
export async function previewReviewPrompt({
  trigger,
  onMilestone,
  onPrime,
  onComplete,
  fastPreview = true,
}: {
  trigger: ReviewTrigger;
  onMilestone?: () => void;
  onPrime?: (copy: string) => void;
  onComplete?: () => void;
  fastPreview?: boolean;
}) {
  onMilestone?.();
  await runReviewPromptFlow({ trigger, onPrime, invokeNative: false, fastPreview });
  onComplete?.();
}

/** 개발·테스트용 */
export function resetReviewPromptStore() {
  localStorage.removeItem(STORAGE_KEY);
}
