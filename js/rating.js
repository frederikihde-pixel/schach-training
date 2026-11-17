// Geschätzte Taktikstärke: Einstufung (adaptiv) und einfaches Elo-Verfahren. Reine Logik.

export const MIN_RATING = 400;
export const MAX_RATING = 2700;

export const PLACEMENT_COUNT = 10;
export const PLACEMENT_START = 700;
// Schrittweite der Einstufung: anfangs groß, halbiert sich bei jedem Richtungswechsel (mindestens
// MIN_STEP), wächst bei gleicher Richtung um die Hälfte (höchstens MAX_STEP).
export const PLACEMENT_FIRST_STEP = 250;
export const PLACEMENT_MIN_STEP = 50;
export const PLACEMENT_MAX_STEP = 400;

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
  return clamp(strength + kFactor(count) * ((solved ? 1 : 0) - expectedScore(puzzleRating, strength)));
}

// Schrittweite nach dem Rätsel mit Index `index` (0-basiert). history: [{ target, rating, solved }]
function placementStep(history, index) {
  let step = PLACEMENT_FIRST_STEP;
  for (let i = 1; i <= index; i++) {
    step = history[i].solved === history[i - 1].solved ? Math.min(PLACEMENT_MAX_STEP, step * 1.5) : Math.max(PLACEMENT_MIN_STEP, step / 2);
  }
  return step;
}

// Zielwertung des nächsten Einstufungsrätsels. history: [{ target, rating, solved }]
export function placementNextTarget(history) {
  if (history.length === 0) return PLACEMENT_START;
  const last = history[history.length - 1];
  const step = placementStep(history, history.length - 1);
  return clamp(Math.round(last.target + (last.solved ? step : -step)));
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
