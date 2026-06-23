import { readJson } from '../utils.js';
import { APP_CONFIG } from '../config.js';

const empty = {
  events: [],
  risk: { score: 0, level: 'Calm', breakdown: [] },
  cards: {},
  sources: {}
};

export async function getEventsSummary(region) {
  try {
    return await readJson(`${APP_CONFIG.endpoints.events}?region=${region}`);
  } catch {
    return empty;
  }
}

export async function getMapData(region) {
  try {
    return await readJson(`${APP_CONFIG.endpoints.map}?region=${region}`);
  } catch {
    return { earthquakes: [], airQuality: [] };
  }
}
