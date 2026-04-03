const STORAGE_KEY = 'earth-watch-v2-state';

export const state = {
  region: 'global',
  lastRefreshIso: null,
  collapsedSections: [],
  cards: {},
  feed: []
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
  } catch {
    // ignore broken storage
  }
}

export function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      region: state.region,
      lastRefreshIso: state.lastRefreshIso,
      collapsedSections: state.collapsedSections,
      cards: state.cards,
      feed: state.feed
    })
  );
}
