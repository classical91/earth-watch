import { APP_CONFIG } from './config.js';
import { loadState, saveState, state } from './state.js';
import {
  bindRegionControls,
  initSectionToggles,
  renderCards,
  renderFeed,
  renderRefreshTime,
  renderRiskScore,
  renderSourceSections,
  updateRegionControls
} from './ui.js';
import { getEventsSummary } from './services/events.js';
import { initMap, updateMap } from './map.js';

async function bootstrap() {
  loadState();
  state.region = state.region || APP_CONFIG.defaultRegion;

  bindRegionControls(state, async (region) => {
    state.region = region;
    updateRegionControls(region);
    saveState();
    await refreshDashboard();
  });

  // Load and render source cards
  const sourceConfig = await fetch('./data/sources.json')
    .then((r) => r.json())
    .catch(() => null);

  if (sourceConfig) {
    renderSourceSections(sourceConfig);
    initSectionToggles(state, (id, collapsed) => {
      if (collapsed) {
        if (!state.collapsedSections.includes(id)) state.collapsedSections.push(id);
      } else {
        state.collapsedSections = state.collapsedSections.filter((e) => e !== id);
      }
      saveState();
    });
  }

  document.getElementById('refresh-btn').addEventListener('click', refreshDashboard);

  initMap();

  // Render cached data immediately if available
  if (state.cards && state.feed?.length) {
    renderCards(state.cards, state.sources);
    renderFeed(state.feed);
    renderRiskScore(state.risk);
    renderRefreshTime(state.lastRefreshIso, APP_CONFIG.refreshLabelLocale);
  }

  await refreshDashboard();
}

async function refreshDashboard() {
  const summary = await getEventsSummary(state.region);

  state.cards = summary.cards;
  state.sources = summary.sources;
  state.feed = summary.events;
  state.risk = summary.risk;
  state.lastRefreshIso = new Date().toISOString();
  saveState();

  renderCards(state.cards, state.sources);
  renderFeed(state.feed);
  renderRiskScore(state.risk);
  renderRefreshTime(state.lastRefreshIso, APP_CONFIG.refreshLabelLocale);
  updateMap(state.region);
}

bootstrap();
