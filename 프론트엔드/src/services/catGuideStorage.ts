import { getTodayKey } from '../game/attendance';

const STORAGE_KEY = 'grow-coffee-cat-guide-v1';

type CatGuideRecord = {
  dateKey: string;
  fortuneGuideSeen: boolean;
  rouletteGuideSeen: boolean;
};

function readRecord(): CatGuideRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CatGuideRecord;
  } catch {
    return null;
  }
}

function writeRecord(record: CatGuideRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

export function hasSeenCatFortuneGuideToday(dateKey = getTodayKey()) {
  const record = readRecord();
  return record?.dateKey === dateKey && record.fortuneGuideSeen === true;
}

export function hasSeenCatRouletteGuideToday(dateKey = getTodayKey()) {
  const record = readRecord();
  return record?.dateKey === dateKey && record.rouletteGuideSeen === true;
}

export function markCatFortuneGuideSeenToday(dateKey = getTodayKey()) {
  const record = readRecord();
  writeRecord({
    dateKey,
    fortuneGuideSeen: true,
    rouletteGuideSeen: record?.dateKey === dateKey ? record.rouletteGuideSeen : false,
  });
}

export function markCatRouletteGuideSeenToday(dateKey = getTodayKey()) {
  const record = readRecord();
  writeRecord({
    dateKey,
    fortuneGuideSeen: record?.dateKey === dateKey ? record.fortuneGuideSeen : false,
    rouletteGuideSeen: true,
  });
}

export function resetCatRouletteGuideForToday(dateKey = getTodayKey()) {
  const record = readRecord();
  if (record?.dateKey !== dateKey) return;
  writeRecord({
    dateKey,
    fortuneGuideSeen: record.fortuneGuideSeen,
    rouletteGuideSeen: false,
  });
}

/** 고양이 선물 보너스 룰렛 — 넛지·세션 dismiss를 다시 켜기 */
export function primeBonusRouletteNudge(dateKey = getTodayKey()) {
  resetCatRouletteGuideForToday(dateKey);
}

export function resetCatGuideStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
