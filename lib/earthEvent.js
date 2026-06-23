// Normalized event shape shared by every data source.
//
// EarthEvent = {
//   id: string,
//   category: "earthquake" | "weather" | "air" | "space",
//   title: string,
//   summary: string,
//   severity: "low" | "medium" | "high" | "critical",
//   score: number,        // 0-100, contribution to the Earth Risk Index
//   region: string,
//   source: string,
//   sourceUrl: string,
//   observedAt: string,   // ISO timestamp
//   status: "live" | "cached" | "unavailable",
// }

function severityFromScore(score) {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function makeEvent({
  id,
  category,
  title,
  summary,
  score,
  region,
  source,
  sourceUrl,
  observedAt,
  status,
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    id,
    category,
    title,
    summary,
    severity: severityFromScore(clamped),
    score: clamped,
    region,
    source,
    sourceUrl,
    observedAt: observedAt || new Date().toISOString(),
    status: status || 'live',
  };
}

const RISK_LEVELS = [
  { max: 20, label: 'Calm' },
  { max: 40, label: 'Watch' },
  { max: 60, label: 'Elevated' },
  { max: 80, label: 'High Risk' },
  { max: 100, label: 'Critical' },
];

function riskLevelFor(score) {
  return RISK_LEVELS.find((tier) => score <= tier.max)?.label || 'Critical';
}

// Combines per-category event scores into a single 0-100 Earth Risk Index.
// Weighted toward the worst single event, but a pile-up of moderate events
// across categories still pushes the score up.
function computeRiskScore(events) {
  if (!events.length) {
    return { score: 0, level: riskLevelFor(0), breakdown: [] };
  }

  const byCategory = new Map();
  for (const event of events) {
    const current = byCategory.get(event.category) || 0;
    byCategory.set(event.category, Math.max(current, event.score));
  }

  const categoryScores = [...byCategory.values()];
  const maxScore = Math.max(...categoryScores);
  const avgScore = categoryScores.reduce((sum, s) => sum + s, 0) / categoryScores.length;
  const score = Math.round(maxScore * 0.65 + avgScore * 0.35);

  return {
    score,
    level: riskLevelFor(score),
    breakdown: [...byCategory.entries()].map(([category, categoryScore]) => ({
      category,
      score: categoryScore,
    })),
  };
}

module.exports = { makeEvent, severityFromScore, computeRiskScore, riskLevelFor };
