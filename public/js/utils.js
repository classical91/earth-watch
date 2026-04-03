export function formatRefreshLabel(isoString, locale = 'en-CA') {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return `${date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric'
  })} · ${date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

export function formatRelativeFromNow(isoString) {
  if (!isoString) return 'Unknown';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.max(1, Math.round(diffMs / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hr ago`;
}

export function safeOpenExternal(anchor, url) {
  if (!anchor || !url) return;
  anchor.href = url;
  anchor.hidden = false;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
}

export async function readJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}
