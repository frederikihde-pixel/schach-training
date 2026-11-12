// Zusammenstellung einer Sitzung. Reine Logik (der Zufall wird von außen übergeben).

export function makeRng(seed) {
  // mulberry32: kleiner, reproduzierbarer Zufallsgenerator für Tests
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const DUE_SHARE = 0.3;

// due:        fällige Karten ({ stufe, faellig, raetsel }), älteste zuerst
// candidates: neue Rätsel im passenden Wertungsbereich (bereits ohne schon Gesehene)
// weakThemes: Themen-Schlagworte, schwächstes zuerst
// themeFilter: nur Rätsel mit diesem Thema (dann keine Aufteilung nach schwachen Themen)
export function buildSession({ size = 10, due = [], candidates = [], weakThemes = [], themeFilter = null, rng = Math.random }) {
  const wanted = (p) => !themeFilter || p.themen.includes(themeFilter);
  const dueUse = due.filter((c) => wanted(c.raetsel));
  const nDue = Math.min(dueUse.length, Math.round(size * DUE_SHARE));
  const items = dueUse.slice(0, nDue).map((c) => ({ art: "wiederholung", puzzle: c.raetsel }));
  const used = new Set(items.map((i) => i.puzzle.id));

  const nNew = size - nDue;
  const pool = shuffled(candidates.filter((p) => wanted(p) && !used.has(p.id)), rng);
  const picked = [];
  const take = (p) => {
    picked.push({ art: "neu", puzzle: p });
    used.add(p.id);
  };

  // Hälfte der neuen Rätsel aus den schwächsten Themen (reihum), der Rest zufällig.
  const weakWanted = themeFilter ? 0 : Math.round(nNew / 2);
  if (weakWanted > 0 && weakThemes.length > 0) {
    const lists = weakThemes.map((t) => pool.filter((p) => p.themen.includes(t)));
    let progress = true;
    while (picked.length < weakWanted && progress) {
      progress = false;
      for (const list of lists) {
        const p = list.find((x) => !used.has(x.id));
        if (p && picked.length < weakWanted) {
          take(p);
          progress = true;
        }
      }
    }
  }
  for (const p of pool) {
    if (picked.length >= nNew) break;
    if (!used.has(p.id)) take(p);
  }
  items.push(...picked);

  // Fehlen neue Rätsel, werden weitere fällige Karten aufgefüllt.
  for (const c of dueUse.slice(nDue)) {
    if (items.length >= size) break;
    items.push({ art: "wiederholung", puzzle: c.raetsel });
  }
  return shuffled(items, rng);
}
