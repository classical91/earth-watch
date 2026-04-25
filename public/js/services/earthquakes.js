import { readJson } from '../utils.js';
import { APP_CONFIG } from '../config.js';

const mock = {
  card: { value: '—', subtitle: 'Fetching earthquake data…', url: 'https://earthquake.usgs.gov/earthquakes/map/' },
  feed: null
};

export async function getEarthquakeSummary(region) {
  try {
    return await readJson(`${APP_CONFIG.endpoints.earthquakes}?region=${region}`);
  } catch {
    return mock;
  }
}
