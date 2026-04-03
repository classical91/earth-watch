import { readJson } from '../utils.js';
import { APP_CONFIG } from '../config.js';

const mock = {
  card: { value: '—', subtitle: 'Fetching alert data…', url: 'https://www.weather.gov/' },
  feed: null
};

export async function getAlertsSummary(region) {
  try {
    return await readJson(`${APP_CONFIG.endpoints.alerts}?region=${region}`);
  } catch {
    return mock;
  }
}
