import { readJson } from '../utils.js';
import { APP_CONFIG } from '../config.js';

const mock = {
  card: { value: '—', subtitle: 'Fetching AQI data…', url: 'https://waqi.info/' },
  feed: null
};

export async function getAirQualitySummary(region) {
  try {
    return await readJson(`${APP_CONFIG.endpoints.airQuality}?region=${region}`);
  } catch {
    return mock;
  }
}
