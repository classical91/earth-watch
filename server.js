const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

// --- Live data API routes ---

// USGS Earthquake summary
app.get('/api/earthquakes', async (_req, res) => {
  try {
    const r = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson'
    );
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
    const mag = top.properties.mag?.toFixed(1);
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
        severity: mag >= 7 ? 'high' : mag >= 6 ? 'medium' : 'low',
        label: 'Seismic',
        updatedAt: when,
        url: `https://earthquake.usgs.gov/earthquakes/eventpage/${top.id}`
      }
    });
  } catch {
    res.json({
      card: { value: '—', subtitle: 'Data unavailable', url: 'https://earthquake.usgs.gov/earthquakes/map/' },
      feed: null
    });
  }
});

// NWS Weather alerts
app.get('/api/weather-alerts', async (req, res) => {
  const region = req.query.region || 'global';
  const areaMap = { us: '&area=US', canada: '', global: '' };
  const area = areaMap[region] || '';
  try {
    const r = await fetch(
      `https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe${area}`,
      { headers: { 'User-Agent': 'EarthWatch/1.0 (contact@earthwatch.app)' } }
    );
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
  } catch {
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
    const json = await r.json();
    // json[0] is header row, rest are data: [time_tag, kp, observed, noaa_scale]
    const rows = json.slice(1).filter(row => row[2] === 'observed');
    const latest = rows[rows.length - 1];
    const kp = latest ? parseFloat(latest[1]).toFixed(0) : null;
    const severity = kp >= 7 ? 'high' : kp >= 5 ? 'medium' : kp >= 3 ? 'low' : 'info';
    const label = kp >= 7 ? 'Severe storm' : kp >= 5 ? 'G-storm' : kp >= 3 ? 'Elevated' : 'Quiet';
    res.json({
      card: {
        value: kp !== null ? `Kp ${kp}` : '—',
        subtitle: label,
        url: 'https://www.spaceweatherlive.com/'
      },
      feed: kp >= 3
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
  } catch {
    res.json({
      card: { value: '—', subtitle: 'Data unavailable', url: 'https://www.spaceweatherlive.com/' },
      feed: null
    });
  }
});

// Air quality (WAQI world feed — no key required for feed endpoint)
app.get('/api/airquality', async (_req, res) => {
  try {
    const token = process.env.WAQI_TOKEN || 'demo';
    const r = await fetch(`https://api.waqi.info/feed/here/?token=${token}`);
    const json = await r.json();
    if (json.status === 'ok') {
      const aqi = json.data.aqi;
      const city = json.data.city?.name || 'Unknown';
      const severity = aqi > 150 ? 'high' : aqi > 100 ? 'medium' : aqi > 50 ? 'low' : 'info';
      return res.json({
        card: { value: `AQI ${aqi}`, subtitle: city, url: 'https://waqi.info/' },
        feed: aqi > 100
          ? {
              title: `Unhealthy air in ${city}`,
              summary: `AQI is ${aqi}. Sensitive groups should limit outdoor activity.`,
              severity,
              label: 'AQI',
              updatedAt: new Date().toISOString(),
              url: 'https://waqi.info/'
            }
          : null
      });
    }
    throw new Error('bad response');
  } catch {
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
