// Wiederholung nach Leitner: Stufen 1 bis 4 mit 1, 3, 7 und 21 Tagen. Reine Logik, Tage als "JJJJ-MM-TT".

export const INTERVALS = [1, 3, 7, 21];

export function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

// Nicht gelöst: Karte (neu oder bestehend) kommt auf Stufe 1, fällig am nächsten Tag.
export function afterFailure(puzzle, today) {
  return { stufe: 1, faellig: addDays(today, INTERVALS[0]), raetsel: puzzle };
}

// Richtig in der Wiederholung: eine Stufe höher. Nach Stufe 4 ist das Rätsel erledigt (null).
export function afterSuccess(card, today) {
  if (card.stufe >= INTERVALS.length) return null;
  const stufe = card.stufe + 1;
  return { ...card, stufe, faellig: addDays(today, INTERVALS[stufe - 1]) };
}

export function isDue(card, today) {
  return card.faellig <= today;
}

export function dueCards(cards, today) {
  return Object.values(cards)
    .filter((c) => isDue(c, today))
    .sort((a, b) => (a.faellig < b.faellig ? -1 : a.faellig > b.faellig ? 1 : a.raetsel.id < b.raetsel.id ? -1 : 1));
}
