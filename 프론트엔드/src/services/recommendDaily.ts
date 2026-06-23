import { getTodayKey } from './dailyGameStorage';

export type RecommendKind = 'coffee' | 'dinner';

type RecommendDailyRecord = {
  dateKey: string;
  primaryId: string | null;
  rerollUsed: boolean;
  rerollId: string | null;
};

const STORAGE_PREFIX = 'grow-coffee-recommend';

function storageKey(kind: RecommendKind) {
  return `${STORAGE_PREFIX}-${kind}`;
}

function readRecord(kind: RecommendKind): RecommendDailyRecord {
  try {
    const raw = localStorage.getItem(storageKey(kind));
    if (!raw) {
      return { dateKey: '', primaryId: null, rerollUsed: false, rerollId: null };
    }

    const parsed = JSON.parse(raw) as RecommendDailyRecord;
    return {
      dateKey: parsed.dateKey ?? '',
      primaryId: parsed.primaryId ?? null,
      rerollUsed: Boolean(parsed.rerollUsed),
      rerollId: parsed.rerollId ?? null,
    };
  } catch {
    return { dateKey: '', primaryId: null, rerollUsed: false, rerollId: null };
  }
}

function writeRecord(kind: RecommendKind, record: RecommendDailyRecord) {
  localStorage.setItem(storageKey(kind), JSON.stringify(record));
}

export function getRecommendDailyState(kind: RecommendKind, dateKey = getTodayKey()) {
  const record = readRecord(kind);

  if (record.dateKey !== dateKey) {
    return {
      dateKey,
      primaryId: null,
      rerollUsed: false,
      rerollId: null,
      canReroll: true,
    };
  }

  return {
    dateKey,
    primaryId: record.primaryId,
    rerollUsed: record.rerollUsed,
    rerollId: record.rerollId,
    canReroll: !record.rerollUsed,
  };
}

/** 12종 등 후보 전체에서 동일 확률로 1개 뽑고, 당일에는 고정 */
export function getOrCreateDailyPrimaryId(
  kind: RecommendKind,
  itemIds: readonly string[],
  dateKey = getTodayKey(),
) {
  if (itemIds.length === 0) {
    return '';
  }

  const record = readRecord(kind);
  if (
    record.dateKey === dateKey &&
    record.primaryId &&
    itemIds.includes(record.primaryId)
  ) {
    return record.primaryId;
  }

  const primaryId = itemIds[Math.floor(Math.random() * itemIds.length)];
  writeRecord(kind, {
    dateKey,
    primaryId,
    rerollUsed: false,
    rerollId: null,
  });
  return primaryId;
}

export function saveRecommendReroll(kind: RecommendKind, rerollId: string, dateKey = getTodayKey()) {
  const record = readRecord(kind);
  writeRecord(kind, {
    dateKey,
    primaryId: record.primaryId,
    rerollUsed: true,
    rerollId,
  });
}

export function hashDateKey(dateKey: string, salt = 0) {
  let hash = salt;
  for (const char of dateKey) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return hash;
}

export function pickDailyIndex(dateKey: string, length: number, salt = 0) {
  if (length <= 0) return 0;
  return hashDateKey(dateKey, salt) % length;
}

export function pickRerollIndex<T extends { id: string }>(
  items: T[],
  excludeId: string,
  dateKey = getTodayKey(),
) {
  const candidates = items.filter((item) => item.id !== excludeId);
  if (candidates.length === 0) {
    return 0;
  }

  const salt = hashDateKey(`${dateKey}:reroll`, 17);
  const candidateIndex = salt % candidates.length;
  return items.findIndex((item) => item.id === candidates[candidateIndex].id);
}

/** 현재 메뉴를 제외하고 나머지 후보 중 무작위 1개 */
export function pickRandomOtherItem<T extends { id: string }>(items: T[], excludeId: string) {
  const candidates = items.filter((item) => item.id !== excludeId);
  if (candidates.length === 0) {
    return items[0];
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}
