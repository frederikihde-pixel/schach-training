// Geschätzte Taktikstärke: Einstufung (adaptiv) und einfaches Elo-Verfahren. Reine Logik.

export const MIN_RATING = 600;
export const MAX_RATING = 2700;

export const PLACEMENT_COUNT = 10;
export const PLACEMENT_START = 1000;
export const PLACEMENT_STEPS = [400, 300, 200, 150, 100, 100, 100, 100, 100, 100];

const clamp = (value) => Math.max(MIN_RATING, Math.min(MAX_RATING, value));

export function expectedScore(puzzleRating, strength) {
  return 1 / (1 + 10 ** ((puzzleRating - strength) / 400));
}

// K-Wert: anfangs hoch, später niedriger. `count` = bisher gewertete Rätsel.
export function kFactor(count) {
  if (count < 30) return 40;
  if (count < 100) return 24;
  return 16;
}

export function updateStrength(strength, puzzleRating, solved, count) {
  return strength + kFactor(count) * ((solved ? 1 : 0) - expectedScore(puzzleRating, strength));
}

// Zielwertung des nächsten Einstufungsrätsels. history: [{ target, rating, solved }]
export function placementNextTarget(history) {
  if (history.length === 0) return PLACEMENT_START;
  const last = history[history.length - 1];
  const step = PLACEMENT_STEPS[Math.min(history.length - 1, PLACEMENT_STEPS.length - 1)];
  return clamp(last.target + (last.solved ? step : -step));
}

// Schätzung nach den Einstufungsrätseln: Mittel aus den Wertungen der letzten vier Rätsel
// und der Zielwertung, die als Nächstes gekommen wäre.
export function placementEstimate(history) {
  const recent = history.slice(-4).map((h) => h.rating);
  const values = [...recent, placementNextTarget(history)];
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function bandOf(rating) {
  if (rating < MIN_RATING) return MIN_RATING;
  if (rating >= MAX_RATING) return MAX_RATING;
  return Math.floor(rating / 100) * 100;
}

// Bänder, die den Bereich [low, high] abdecken (für das Nachladen).
export function bandsFor(low, high) {
  const out = [];
  for (let b = bandOf(low); b <= bandOf(high); b += 100) out.push(b);
  return out;
}
