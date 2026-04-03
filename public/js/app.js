import { APP_CONFIG } from './config.js';
import { loadState, saveState, state } from './state.js';
import {
  bindRegionControls,
  initSectionToggles,
  renderCards,
  renderFeed,
  renderRefreshTime,
  renderSourceSections,
  updateRegionControls
} from './ui.js';
import { getEarthquakeSummary } from './services/earthquakes.js';
import { getAlertsSummary } from './services/alerts.js';
import { getAirQualitySummary } from './services/airquality.js';
import { getSpaceWeatherSummary } from './services/spaceweather.js';

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

  // Render cached data immediately if available
  if (state.cards && state.feed?.length) {
    renderCards(state.cards);
    renderFeed(state.feed);
    renderRefreshTime(state.lastRefreshIso, APP_CONFIG.refreshLabelLocale);
  }

  await refreshDashboard();
}

async function refreshDashboard() {
  const [earthquakes, alerts, airQuality, spaceWeather] = await Promise.all([
    getEarthquakeSummary(state.region),
    getAlertsSummary(state.region),
    getAirQualitySummary(state.region),
    getSpaceWeatherSummary(state.region)
  ]);

  state.cards = {
    earthquakes: earthquakes.card,
    alerts: alerts.card,
    airQuality: airQuality.card,
    spaceWeather: spaceWeather.card
  };

  state.feed = [
    earthquakes.feed,
    alerts.feed,
    airQuality.feed,
    spaceWeather.feed
  ].filter(Boolean);

  state.lastRefreshIso = new Date().toISOString();
  saveState();

  renderCards(state.cards);
  renderFeed(state.feed);
  renderRefreshTime(state.lastRefreshIso, APP_CONFIG.refreshLabelLocale);
}

bootstrap();
