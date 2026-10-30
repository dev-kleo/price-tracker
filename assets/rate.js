/* One-time review prompt: shown after the user has tracked enough products and used the extension for a couple of days. */
export const RATE_MIN_PRODUCTS = 3, RATE_MIN_DAYS = 2;
const DAY = 864e5;

export function shouldShowRate({ trackedCount, firstRunAt, now = Date.now(), done }) {
  return done !== true
    && Number(trackedCount) >= RATE_MIN_PRODUCTS
    && Number(firstRunAt) > 0
    && now - Number(firstRunAt) >= RATE_MIN_DAYS * DAY;
}

export const reviewUrl = (id) => `https://chrome.google.com/webstore/detail/${id}/reviews`;
