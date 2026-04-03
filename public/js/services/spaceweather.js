import { readJson } from '../utils.js';
import { APP_CONFIG } from '../config.js';

const mock = {
  card: { value: '—', subtitle: 'Fetching space weather…', url: 'https://www.spaceweatherlive.com/' },
  feed: null
};

export async function getSpaceWeatherSummary() {
  try {
    return await readJson(APP_CONFIG.endpoints.spaceWeather);
  } catch {
    return mock;
  }
}
