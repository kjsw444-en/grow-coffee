import { getTodayKey } from '../game/attendance';

const STORAGE_KEY = 'grow-coffee-daily-roulette-v1';
export const DAILY_ROULETTE_RESET_EVENT = 'grow-coffee-daily-roulette-reset';

type DailyRouletteRecord = {
  dateKey: string;
  shown?: boolean;
  claimed: boolean;
  rewardCups?: number;
};

function readRecord(): DailyRouletteRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyRouletteRecord;
  } catch {
    return null;
  }
}

function writeRecord(record: DailyRouletteRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

export function hasClaimedDailyLoginRouletteLocal(dateKey = getTodayKey()) {
  const record = readRecord();
  return record?.dateKey === dateKey && record.claimed === true;
}

export function hasSeenDailyLoginRouletteLocal(dateKey = getTodayKey()) {
  const record = readRecord();
  return record?.dateKey === dateKey && (record.shown === true || record.claimed === true);
}

/** 서버는 미수령인데 로컬만 claimed인 경우(테스트·동기화 꼬임) 정리 */
export function syncDailyLoginRouletteLocalWithServer(
  serverDayKey: string | undefined,
  dateKey = getTodayKey(),
) {
  if (String(serverDayKey ?? '') === dateKey) return;

  const record = readRecord();
  if (record?.dateKey === dateKey && record.claimed) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

const DISMISS_SESSION_KEY = 'grow-coffee-daily-roulette-dismissed';

export function isDailyLoginRouletteDismissedForSession(dateKey = getTodayKey()) {
  try {
    return sessionStorage.getItem(DISMISS_SESSION_KEY) === dateKey;
  } catch {
    return false;
  }
}

export function dismissDailyLoginRouletteForSession(dateKey = getTodayKey()) {
  try {
    sessionStorage.setItem(DISMISS_SESSION_KEY, dateKey);
  } catch {
    // ignore
  }
}

export function markDailyLoginRouletteShownLocal(dateKey = getTodayKey()) {
  const record = readRecord();
  writeRecord({
    dateKey,
    shown: true,
    claimed: record?.dateKey === dateKey ? record.claimed : false,
    rewardCups: record?.dateKey === dateKey ? record.rewardCups : undefined,
  });
}

export function markDailyLoginRouletteClaimedLocal(rewardCups: number, dateKey = getTodayKey()) {
  writeRecord({ dateKey, shown: true, claimed: true, rewardCups });
}

export function resetDailyLoginRouletteStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(DISMISS_SESSION_KEY);
    window.dispatchEvent(new Event(DAILY_ROULETTE_RESET_EVENT));
  } catch {
    // ignore
  }
}

declare global {
  interface Window {
    resetGrowCoffeeDailyRoulette?: () => void;
    resetGrowCoffeeOnboarding?: () => void;
  }
}
