import { getMapData } from './services/events.js';

let map = null;
let markersLayer = null;

export function initMap() {
  const el = document.getElementById('earth-map');
  if (!el || typeof L === 'undefined') return;

  map = L.map(el, { worldCopyJump: true }).setView([20, 0], 2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    maxZoom: 12
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function quakeColor(mag) {
  if (mag >= 6) return '#ff6b6b';
  if (mag >= 4.5) return '#f3b45d';
  return '#47d18c';
}

export async function updateMap(region) {
  if (!map || !markersLayer) return;
  const data = await getMapData(region);
  markersLayer.clearLayers();

  for (const q of data.earthquakes || []) {
    L.circleMarker([q.lat, q.lon], {
      radius: Math.max(4, (q.mag || 1) * 2.5),
      color: quakeColor(q.mag),
      fillColor: quakeColor(q.mag),
      fillOpacity: 0.6,
      weight: 1
    })
      .bindPopup(`<strong>M${q.mag?.toFixed(1)}</strong> — ${q.place}<br/><a href="${q.url}" target="_blank" rel="noopener noreferrer">USGS details ↗</a>`)
      .addTo(markersLayer);
  }

  for (const city of data.airQuality || []) {
    L.marker([city.lat, city.lon], {
      icon: L.divIcon({ className: 'aqi-marker', html: '🟣', iconSize: [20, 20] })
    })
      .bindPopup(`<strong>${city.name}</strong><br/>Air quality monitoring point`)
      .addTo(markersLayer);
  }
}
