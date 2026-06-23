import { getTodayKey } from './dailyGameStorage';

const SHOP_HEARTBEAT_KEY = 'grow-coffee-shop-heartbeat-date';

export function hasSeenShopHeartbeatToday() {
  try {
    return localStorage.getItem(SHOP_HEARTBEAT_KEY) === getTodayKey();
  } catch {
    return false;
  }
}

export function markShopHeartbeatSeenToday() {
  try {
    localStorage.setItem(SHOP_HEARTBEAT_KEY, getTodayKey());
  } catch {
    // localStorage unavailable
  }
}
