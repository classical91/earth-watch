import { readJson } from '../utils.js';
import { APP_CONFIG } from '../config.js';

const mock = {
  card: { value: '—', subtitle: 'Fetching AQI data…', url: 'https://waqi.info/' },
  feed: null
};

export async function getAirQualitySummary() {
  try {
    return await readJson(APP_CONFIG.endpoints.airQuality);
  } catch {
    return mock;
  }
}
