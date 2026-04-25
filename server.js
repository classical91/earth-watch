const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

// --- Live data API routes ---

// Geographic bounds for regional earthquake filtering
const QUAKE_BOUNDS = {
  us:     'minlatitude=24&maxlatitude=50&minlongitude=-125&maxlongitude=-66',
  canada: 'minlatitude=42&maxlatitude=84&minlongitude=-141&maxlongitude=-52',
};

// USGS Earthquake summary
app.get('/api/earthquakes', async (req, res) => {
  const region = req.query.region || 'global';
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = QUAKE_BOUNDS[region]
    ? `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=magnitude&limit=20&minmagnitude=4.5&starttime=${weekAgo}&${QUAKE_BOUNDS[region]}`
    : 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson';
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const quakes = (json.features || []).sort(
      (a, b) => b.properties.mag - a.properties.mag
    );
    const top = quakes[0];
    if (!top) {
      return res.json({
        card: { value: 'None', subtitle: 'No significant quakes this week', url: 'https://earthquake.usgs.gov/earthquakes/map/' },
        feed: null
      });
    }
    const magNum = top.properties.mag ?? 0;
    const mag = magNum.toFixed(1);
    const place = top.properties.place || 'Unknown location';
    const when = new Date(top.properties.time).toISOString();
    res.json({
      card: {
        value: `M${mag}`,
        subtitle: place,
        url: `https://earthquake.usgs.gov/earthquakes/eventpage/${top.id}`
      },
      feed: {
        title: `M${mag} — ${place}`,
        summary: `${quakes.length} significant earthquake(s) recorded this week. Strongest: magnitude ${mag} near ${place}.`,
        severity: magNum >= 7 ? 'high' : magNum >= 6 ? 'medium' : 'low',
        label: 'Seismic',
        updatedAt: when,
        url: `https://earthquake.usgs.gov/earthquakes/eventpage/${top.id}`
      }
    });
  } catch (err) {
    console.error('[earthquakes]', err.message);
    res.json({
      card: { value: '—', subtitle: 'Data unavailable', url: 'https://earthquake.usgs.gov/earthquakes/map/' },
      feed: null
    });
  }
});

// Weather alerts
app.get('/api/weather-alerts', async (req, res) => {
  const region = req.query.region || 'global';

  if (region === 'canada') {
    // MSC (Meteorological Service of Canada) GeoMet OGC API
    try {
      const r = await fetch(
        'https://api.weather.gc.ca/collections/alerts/items?lang=en&f=json&limit=50',
        { headers: { 'User-Agent': 'EarthWatch/1.0 (contact@earthwatch.app)' } }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const alerts = (json.features || []).filter(f =>
        f.properties.status === 'Actual' &&
        ['Extreme', 'Severe'].includes(f.properties.severity)
      );
      const count = alerts.length;
      const top = alerts[0];
      return res.json({
        card: {
          value: String(count),
          subtitle: count
            ? `${top.properties.event} — ${top.properties.areaDesc || top.properties.headline?.substring(0, 60)}`
            : 'No active severe alerts',
          url: 'https://weather.gc.ca/warnings/'
        },
        feed: count
          ? {
              title: top.properties.event,
              summary: top.properties.headline || top.properties.description?.substring(0, 200),
              severity: top.properties.severity === 'Extreme' ? 'high' : 'medium',
              label: 'Alert',
              updatedAt: top.properties.sent || new Date().toISOString(),
              url: 'https://weather.gc.ca/warnings/'
            }
          : null
      });
    } catch (err) {
      console.error('[weather-alerts/canada]', err.message);
      return res.json({
        card: { value: '—', subtitle: 'Data unavailable', url: 'https://weather.gc.ca/warnings/' },
        feed: null
      });
    }
  }

  // NWS — covers US; global falls back to full NWS feed
  const area = region === 'us' ? '&area=US' : '';
  try {
    const r = await fetch(
      `https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe${area}`,
      { headers: { 'User-Agent': 'EarthWatch/1.0 (contact@earthwatch.app)' } }
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const alerts = json.features || [];
    const count = alerts.length;
    const top = alerts[0];
    res.json({
      card: {
        value: String(count),
        subtitle: count
          ? `${top.properties.event} — ${top.properties.areaDesc?.split(';')[0]}`
          : 'No active severe alerts',
        url: 'https://www.weather.gov/'
      },
      feed: count
        ? {
            title: top.properties.event,
            summary: top.properties.headline || top.properties.description?.substring(0, 200),
            severity: top.properties.severity === 'Extreme' ? 'high' : 'medium',
            label: 'Alert',
            updatedAt: top.properties.sent || new Date().toISOString(),
            url: 'https://www.weather.gov/'
          }
        : null
    });
  } catch (err) {
    console.error('[weather-alerts]', err.message);
    res.json({
      card: { value: '—', subtitle: 'Data unavailable', url: 'https://www.weather.gov/' },
      feed: null
    });
  }
});

// NOAA Space Weather (planetary K-index)
app.get('/api/spaceweather', async (_req, res) => {
  try {
    const r = await fetch(
      'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    // json[0] is header row, rest are data: [time_tag, kp, observed, noaa_scale]
    const rows = json.slice(1).filter(row => row[2] === 'observed');
    const latest = rows[rows.length - 1];
    const kpNum = latest ? parseFloat(latest[1]) : null;
    const kp = kpNum !== null ? kpNum.toFixed(0) : null;
    const severity = kpNum >= 7 ? 'high' : kpNum >= 5 ? 'medium' : kpNum >= 3 ? 'low' : 'info';
    const label = kpNum >= 7 ? 'Severe storm' : kpNum >= 5 ? 'G-storm' : kpNum >= 3 ? 'Elevated' : 'Quiet';
    res.json({
      card: {
        value: kp !== null ? `Kp ${kp}` : '—',
        subtitle: label,
        url: 'https://www.spaceweatherlive.com/'
      },
      feed: kpNum >= 3
        ? {
            title: `Geomagnetic activity: Kp ${kp}`,
            summary: `Current planetary K-index is ${kp} (${label}). Aurora may be visible at high latitudes.`,
            severity,
            label: 'Solar',
            updatedAt: latest ? new Date(latest[0]).toISOString() : new Date().toISOString(),
            url: 'https://www.spaceweatherlive.com/'
          }
        : null
    });
  } catch (err) {
    console.error('[spaceweather]', err.message);
    res.json({
      card: { value: '—', subtitle: 'Data unavailable', url: 'https://www.spaceweatherlive.com/' },
      feed: null
    });
  }
});

// Air quality (Open-Meteo — free, no API key required)
const AQI_CITIES = {
  us:     { name: 'Los Angeles', lat: 34.05,  lon: -118.24 },
  canada: { name: 'Toronto',     lat: 43.65,  lon:  -79.38 },
  global: { name: 'Delhi',       lat: 28.61,  lon:   77.21 },
};

app.get('/api/airquality', async (req, res) => {
  const region = req.query.region || 'global';
  const city = AQI_CITIES[region] || AQI_CITIES.global;
  try {
    const r = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=us_aqi`
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const aqi = json.current?.us_aqi;
    if (aqi == null) throw new Error('No AQI in response');
    const severity = aqi > 150 ? 'high' : aqi > 100 ? 'medium' : aqi > 50 ? 'low' : 'info';
    return res.json({
      card: { value: `AQI ${aqi}`, subtitle: city.name, url: 'https://waqi.info/' },
      feed: aqi > 100
        ? {
            title: `Unhealthy air in ${city.name}`,
            summary: `AQI is ${aqi}. Sensitive groups should limit outdoor activity.`,
            severity,
            label: 'AQI',
            updatedAt: new Date().toISOString(),
            url: 'https://waqi.info/'
          }
        : null
    });
  } catch (err) {
    console.error('[airquality]', err.message);
    res.json({
      card: { value: '—', subtitle: 'Data unavailable', url: 'https://waqi.info/' },
      feed: null
    });
  }
});

// Serve index.html for all other routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Earth Watch running on port ${PORT}`);
});
