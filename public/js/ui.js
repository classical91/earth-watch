import { formatRefreshLabel, formatRelativeFromNow, formatSourceStatus, safeOpenExternal } from './utils.js';

const SEVERITY_ICON = { critical: '🚨', high: '⚠️', medium: '🟡', low: '🟢' };
const CATEGORY_LABEL = { earthquake: 'Seismic', weather: 'Alert', air: 'AQI', space: 'Solar' };

export function bindRegionControls(state, onChange) {
  document.querySelectorAll('.region-btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.region === state.region);
    button.addEventListener('click', () => onChange(button.dataset.region));
  });
}

export function updateRegionControls(region) {
  document.querySelectorAll('.region-btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.region === region);
  });
}

export function renderCards(cards, sources) {
  const mappings = [
    ['quake', cards?.earthquakes, sources?.earthquakes],
    ['alerts', cards?.alerts, sources?.weather],
    ['aqi', cards?.airQuality, sources?.airQuality],
    ['space', cards?.spaceWeather, sources?.spaceWeather]
  ];
  for (const [key, card, source] of mappings) {
    document.getElementById(`${key}-value`).textContent = card?.value ?? '—';
    document.getElementById(`${key}-subtitle`).textContent = card?.subtitle ?? 'No data yet';
    document.getElementById(`${key}-status`).textContent = formatSourceStatus(source);
    safeOpenExternal(document.getElementById(`${key}-link`), card?.url);
  }
}

export function renderFeed(feedItems) {
  const root = document.getElementById('priority-feed');
  root.innerHTML = '';
  if (!feedItems?.length) {
    root.innerHTML = '<div class="feed-item"><p>🟢 All clear — no priority alerts right now.</p></div>';
    return;
  }
  for (const item of feedItems) {
    const article = document.createElement('article');
    article.className = 'feed-item';
    const icon = SEVERITY_ICON[item.severity] ?? '🟢';
    const label = CATEGORY_LABEL[item.category] ?? 'Update';
    article.innerHTML = `
      <div class="feed-item-header">
        <h3 class="feed-item-title">${icon} ${item.title}</h3>
        <span class="severity-${item.severity ?? 'low'}">${label}</span>
      </div>
      <p>${item.summary}</p>
      <p class="feed-item-meta">${item.source} · Updated ${formatRelativeFromNow(item.observedAt)}</p>
      ${item.sourceUrl ? `<p><a class="inline-link" href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">Open source ↗</a></p>` : ''}
    `;
    root.appendChild(article);
  }
}

export function renderRiskScore(risk) {
  const scoreEl = document.getElementById('risk-score');
  const levelEl = document.getElementById('risk-level');
  const gaugeEl = document.getElementById('risk-gauge');
  if (!scoreEl || !levelEl) return;

  const score = risk?.score ?? 0;
  const level = risk?.level ?? 'Calm';
  scoreEl.textContent = score;
  levelEl.textContent = level;
  levelEl.className = `risk-level risk-level--${level.toLowerCase().replace(/\s+/g, '-')}`;
  if (gaugeEl) gaugeEl.style.setProperty('--risk-pct', `${score}%`);
}

export function renderRefreshTime(isoString, locale) {
  const label = formatRefreshLabel(isoString, locale);
  document.getElementById('refresh-time').textContent = label;
  document.getElementById('footer-refresh').textContent = `Refreshed ${label}`;
}

export function renderSourceSections(sourceConfig) {
  const sectionDefs = [
    { key: 'seismic',      label: 'Seismic & Volcanic' },
    { key: 'weather',      label: 'Weather & Storms' },
    { key: 'airQuality',   label: 'Air Quality' },
    { key: 'spaceWeather', label: 'Space Weather' },
    { key: 'maritime',     label: 'Maritime & Tracking' },
    { key: 'intel',        label: 'Intel / Global Monitor' },
    { key: 'liveCams',     label: 'Live Cams' }
  ];

  const root = document.getElementById('sources-root');
  root.innerHTML = '';

  for (const { key, label } of sectionDefs) {
    const items = sourceConfig[key];
    if (!items?.length) continue;

    const id = `section-${key}`;
    const block = document.createElement('div');
    block.className = 'section-block';
    block.innerHTML = `
      <button class="section-toggle" data-section="${id}" aria-expanded="true" type="button">
        <span>${label}</span>
        <span class="chevron">▾</span>
      </button>
      <div id="${id}" class="section-content">
        <div class="source-grid">
          ${items.map(item => `
            <a class="source-card" href="${item.url}" target="_blank" rel="noopener noreferrer">
              <strong>${item.title}</strong>
              <p>${item.description}</p>
              <p class="feed-item-meta">${item.domain}</p>
            </a>
          `).join('')}
        </div>
      </div>
    `;
    root.appendChild(block);
  }
}

export function initSectionToggles(state, onToggle) {
  document.querySelectorAll('.section-toggle').forEach((button) => {
    const id = button.dataset.section;
    const target = document.getElementById(id);
    if (!target) return;
    const isCollapsed = state.collapsedSections.includes(id);
    if (isCollapsed) {
      button.setAttribute('aria-expanded', 'false');
      target.classList.add('is-hidden');
    }
    button.addEventListener('click', () => {
      const nextExpanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(nextExpanded));
      target.classList.toggle('is-hidden', !nextExpanded);
      onToggle(id, !nextExpanded);
    });
  });
}
