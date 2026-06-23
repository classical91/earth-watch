const express = require('express');
const path = require('path');
const { makeEvent, computeRiskScore } = require('./lib/earthEvent');
const { fetchWithCache } = require('./lib/cache');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CACHE_TTL_MS = 5 * 60 * 1000;

app.use(express.static(PUBLIC_DIR));

// --- Live data API routes ---

// Geographic bounds for regional earthquake filtering
const QUAKE_BOUNDS = {
  us:     'minlatitude=24&maxlatitude=50&minlongitude=-125&maxlongitude=-66',
  canada: 'minlatitude=42&maxlatitude=84&minlongitude=-141&maxlongitude=-52',
};

function quakeScore(mag, tsunami) {
  let score;
  if (mag >= 8) score = 95;
  else if (mag >= 7) score = 80;
  else if (mag >= 6) score = 60;
  else if (mag >= 5) score = 35;
  else score = 15;
  return tsunami ? Math.min(100, score + 15) : score;
}

async function getEarthquakeData(region) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = QUAKE_BOUNDS[region]
    ? `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=magnitude&limit=20&minmagnitude=4.5&starttime=${weekAgo}&${QUAKE_BOUNDS[region]}`
    : 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson';

  return fetchWithCache(`earthquakes:${region}`, CACHE_TTL_MS, async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    return (json.features || []).sort((a, b) => b.properties.mag - a.properties.mag);
  });
}

async function buildEarthquakeResponse(region) {
  const { data: quakes, status, cachedAt } = await getEarthquakeData(region);
  const top = quakes[0];
  if (!top) {
    return {
      card: { value: 'None', subtitle: 'No significant quakes this week', url: 'https://earthquake.usgs.gov/earthquakes/map/' },
      events: [],
      source: { name: 'USGS', status, updatedAt: cachedAt },
    };
  }
  const magNum = top.properties.mag ?? 0;
  const mag = magNum.toFixed(1);
  const place = top.properties.place || 'Unknown location';
  const when = new Date(top.properties.time).toISOString();
  const event = makeEvent({
    id: `quake-${top.id}`,
    category: 'earthquake',
    title: `M${mag} — ${place}`,
    summary: `${quakes.length} significant earthquake(s) recorded this week. Strongest: magnitude ${mag} near ${place}.`,
    score: quakeScore(magNum, top.properties.tsunami),
    region,
    location: place,
    source: 'USGS',
    sourceUrl: `https://earthquake.usgs.gov/earthquakes/eventpage/${top.id}`,
    observedAt: when,
    status,
  });
  return {
    card: { value: `M${mag}`, subtitle: place, url: event.sourceUrl },
    events: [event],
    source: { name: 'USGS', status, updatedAt: cachedAt },
  };
}

app.get('/api/earthquakes', async (req, res) => {
  const region = req.query.region || 'global';
  try {
    res.json(await buildEarthquakeResponse(region));
  } catch (err) {
    console.error('[earthquakes]', err.message);
    res.json({
      card: { value: '—', subtitle: 'Data unavailable', url: 'https://earthquake.usgs.gov/earthquakes/map/' },
      events: [],
      source: { name: 'USGS', status: 'unavailable', updatedAt: null },
    });
  }
});

async function getWeatherAlertData(region) {
  if (region === 'canada') {
    return fetchWithCache(`alerts:${region}`, CACHE_TTL_MS, async () => {
      const r = await fetch(
        'https://api.weather.gc.ca/collections/alerts/items?lang=en&f=json&limit=50',
        { headers: { 'User-Agent': 'EarthWatch/1.0 (contact@earthwatch.app)' } }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      return (json.features || []).filter(f =>
        f.properties.status === 'Actual' &&
        ['Extreme', 'Severe'].includes(f.properties.severity)
      );
    });
  }

  const area = region === 'us' ? '&area=US' : '';
  return fetchWithCache(`alerts:${region}`, CACHE_TTL_MS, async () => {
    const r = await fetch(
      `https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe${area}`,
      { headers: { 'User-Agent': 'EarthWatch/1.0 (contact@earthwatch.app)' } }
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    return json.features || [];
  });
}

async function buildWeatherResponse(region) {
  const isCanada = region === 'canada';
  const sourceName = isCanada ? 'MSC GeoMet' : 'NWS';
  const sourceUrl = isCanada ? 'https://weather.gc.ca/warnings/' : 'https://www.weather.gov/';
  try {
    const { data: alerts, status, cachedAt } = await getWeatherAlertData(region);
    const count = alerts.length;
    const top = alerts[0];

    const events = alerts.slice(0, 10).map((alert) => {
      const p = alert.properties;
      const severity = p.severity === 'Extreme' ? 90 : 60;
      const location = (p.areaDesc || '').split(';')[0]?.trim() || null;
      return makeEvent({
        id: `alert-${p.id || alert.id}`,
        category: 'weather',
        title: p.event,
        summary: p.headline || p.description?.substring(0, 200) || p.event,
        score: severity,
        region,
        location,
        source: sourceName,
        sourceUrl,
        observedAt: p.sent || new Date().toISOString(),
        status,
      });
    });

    return {
      card: {
        value: String(count),
        subtitle: count
          ? `${top.properties.event} — ${(top.properties.areaDesc || top.properties.headline || '').split(';')[0].substring(0, 60)}`
          : 'No active severe alerts',
        url: sourceUrl,
      },
      events,
      source: { name: sourceName, status, updatedAt: cachedAt },
    };
  } catch (err) {
    console.error('[weather-alerts]', err.message);
    return {
      card: { value: '—', subtitle: 'Data unavailable', url: sourceUrl },
      events: [],
      source: { name: sourceName, status: 'unavailable', updatedAt: null },
    };
  }
}

app.get('/api/weather-alerts', async (req, res) => {
  res.json(await buildWeatherResponse(req.query.region || 'global'));
});

function spaceWeatherTier(kp) {
  if (kp >= 7) return { score: 90, label: 'Severe storm' };
  if (kp >= 5) return { score: 65, label: 'G-storm' };
  if (kp >= 3) return { score: 35, label: 'Elevated' };
  return { score: 10, label: 'Quiet' };
}

async function buildSpaceWeatherResponse() {
  try {
    const { data: rows, status, cachedAt } = await fetchWithCache(
      'spaceweather',
      CACHE_TTL_MS,
      async () => {
        const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        return json.slice(1).filter(row => row[2] === 'observed');
      }
    );
    const latest = rows[rows.length - 1];
    const kpNum = latest ? parseFloat(latest[1]) : null;
    const kp = kpNum !== null ? kpNum.toFixed(0) : null;
    const tier = spaceWeatherTier(kpNum ?? 0);
    const sourceUrl = 'https://www.spaceweatherlive.com/';

    const event = kpNum !== null
      ? makeEvent({
          id: `space-${latest[0]}`,
          category: 'space',
          title: `Geomagnetic activity: Kp ${kp}`,
          summary: `Current planetary K-index is ${kp} (${tier.label}). Aurora may be visible at high latitudes when Kp is elevated.`,
          score: tier.score,
          region: 'global',
          source: 'NOAA SWPC',
          sourceUrl,
          observedAt: new Date(latest[0]).toISOString(),
          status,
        })
      : null;

    return {
      card: { value: kp !== null ? `Kp ${kp}` : '—', subtitle: tier.label, url: sourceUrl },
      events: event && kpNum >= 3 ? [event] : [],
      source: { name: 'NOAA SWPC', status, updatedAt: cachedAt },
    };
  } catch (err) {
    console.error('[spaceweather]', err.message);
    return {
      card: { value: '—', subtitle: 'Data unavailable', url: 'https://www.spaceweatherlive.com/' },
      events: [],
      source: { name: 'NOAA SWPC', status: 'unavailable', updatedAt: null },
    };
  }
}

app.get('/api/spaceweather', async (_req, res) => {
  res.json(await buildSpaceWeatherResponse());
});

// Air quality (Open-Meteo — free, no API key required)
const AQI_CITIES = {
  us:     { name: 'Los Angeles', lat: 34.05,  lon: -118.24 },
  canada: { name: 'Toronto',     lat: 43.65,  lon:  -79.38 },
  global: { name: 'Delhi',       lat: 28.61,  lon:   77.21 },
};

function aqiScore(aqi) {
  return Math.min(100, Math.round((aqi / 300) * 100));
}

async function buildAirQualityResponse(region) {
  const city = AQI_CITIES[region] || AQI_CITIES.global;
  const sourceUrl = 'https://waqi.info/';
  try {
    const { data: aqi, status, cachedAt } = await fetchWithCache(
      `airquality:${region}`,
      CACHE_TTL_MS,
      async () => {
        const r = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=us_aqi`
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        const value = json.current?.us_aqi;
        if (value == null) throw new Error('No AQI in response');
        return value;
      }
    );

    const event = makeEvent({
      id: `aqi-${region}`,
      category: 'air',
      title: `Air quality in ${city.name}`,
      summary: `AQI is ${aqi}. ${aqi > 150 ? 'Health warnings of emergency conditions.' : aqi > 100 ? 'Sensitive groups should limit outdoor activity.' : 'Air quality is acceptable.'}`,
      score: aqiScore(aqi),
      region,
      location: city.name,
      source: 'Open-Meteo',
      sourceUrl,
      observedAt: new Date().toISOString(),
      status,
    });

    return {
      card: { value: `AQI ${aqi}`, subtitle: city.name, url: sourceUrl },
      events: aqi > 100 ? [event] : [],
      source: { name: 'Open-Meteo', status, updatedAt: cachedAt },
    };
  } catch (err) {
    console.error('[airquality]', err.message);
    return {
      card: { value: '—', subtitle: 'Data unavailable', url: sourceUrl },
      events: [],
      source: { name: 'Open-Meteo', status: 'unavailable', updatedAt: null },
    };
  }
}

app.get('/api/airquality', async (req, res) => {
  res.json(await buildAirQualityResponse(req.query.region || 'global'));
});

// Map markers: earthquakes + the representative AQI city for this region
app.get('/api/map', async (req, res) => {
  const region = req.query.region || 'global';
  const city = AQI_CITIES[region] || AQI_CITIES.global;
  try {
    const { data: quakes } = await getEarthquakeData(region);
    res.json({
      earthquakes: quakes.slice(0, 50).map((q) => ({
        id: q.id,
        mag: q.properties.mag,
        place: q.properties.place,
        lat: q.geometry.coordinates[1],
        lon: q.geometry.coordinates[0],
        url: `https://earthquake.usgs.gov/earthquakes/eventpage/${q.id}`,
      })),
      airQuality: [{ name: city.name, lat: city.lat, lon: city.lon }],
    });
  } catch (err) {
    console.error('[map]', err.message);
    res.json({ earthquakes: [], airQuality: [] });
  }
});

// Aggregated normalized events across every source — feeds the priority feed
// and the Earth Risk Score. Built from the same response functions the
// individual /api/* routes use, so there's exactly one code path per source.
app.get('/api/events', async (req, res) => {
  const region = req.query.region || 'global';
  const [eq, weather, air, space] = await Promise.all([
    buildEarthquakeResponse(region).catch(() => ({ events: [] })),
    buildWeatherResponse(region),
    buildAirQualityResponse(region),
    buildSpaceWeatherResponse(),
  ]);
  const events = [...eq.events, ...weather.events, ...air.events, ...space.events]
    .sort((a, b) => b.score - a.score);
  res.json({
    events,
    risk: computeRiskScore(events),
    cards: { earthquakes: eq.card, alerts: weather.card, airQuality: air.card, spaceWeather: space.card },
    sources: { earthquakes: eq.source, weather: weather.source, airQuality: air.source, spaceWeather: space.source },
  });
});

// Serve index.html for all other routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Earth Watch running on port ${PORT}`);
});
