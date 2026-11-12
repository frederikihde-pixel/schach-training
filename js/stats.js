// Auswertung der gespeicherten Zähler. Reine Logik.
import { dayKey, addDays } from "./leitner.js";

export const MIN_ATTEMPTS = 5; // darunter: "zu wenig Daten"
export const MS_CAP = 120000; // längere Zeiten (z. B. Pause) zählen als 120 Sekunden

export function cappedMs(ms) {
  return Math.max(0, Math.min(MS_CAP, Math.round(ms)));
}

// Zähler je Thema fortschreiben: themen[tag] = { n, ok, ms }
export function addAttempt(themen, tags, solved, ms) {
  for (const tag of tags) {
    const t = themen[tag] || (themen[tag] = { n: 0, ok: 0, ms: 0 });
    t.n += 1;
    if (solved) t.ok += 1;
    t.ms += cappedMs(ms);
  }
}

export function themeStats(themen) {
  return Object.entries(themen).map(([tag, t]) => ({
    tag,
    n: t.n,
    ok: t.ok,
    rate: t.n ? t.ok / t.n : 0,
    avgMs: t.n ? t.ms / t.n : 0,
    enough: t.n >= MIN_ATTEMPTS,
  }));
}

// Die schwächsten Themen (mindestens MIN_ATTEMPTS Versuche): niedrigste Trefferquote zuerst.
export function weakestThemes(themen, count = 3) {
  return themeStats(themen)
    .filter((t) => t.enough)
    .sort((a, b) => a.rate - b.rate || b.n - a.n || (a.tag < b.tag ? -1 : 1))
    .slice(0, count);
}

// Schwächstes Thema einer Sitzung: höchste Fehlerquote bei mindestens 2 Rätseln des Themas,
// sonst irgendein Thema mit Fehler. null, wenn es keinen Fehler gab.
export function sessionWeakest(results) {
  const per = {};
  for (const r of results) {
    for (const tag of r.themen) {
      const t = per[tag] || (per[tag] = { n: 0, fail: 0 });
      t.n += 1;
      if (!r.ok) t.fail += 1;
    }
  }
  const failed = Object.entries(per).filter(([, t]) => t.fail > 0);
  if (failed.length === 0) return null;
  const rank = (entries) =>
    entries.sort(([ta, a], [tb, b]) => b.fail / b.n - a.fail / a.n || b.fail - a.fail || (ta < tb ? -1 : 1))[0][0];
  const repeated = failed.filter(([, t]) => t.n >= 2);
  return rank(repeated.length ? repeated : failed);
}

export function mondayOf(key) {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Montag = 0
  return addDays(key, -weekday);
}

// Sitzungen je Woche (Wochenbeginn Montag), älteste zuerst. sitzungen: [{ datum: ISO-Zeit }]
export function sessionsPerWeek(sitzungen, today, weeks = 8) {
  const thisWeek = mondayOf(today);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ start: addDays(thisWeek, -7 * i), anzahl: 0 });
  for (const s of sitzungen) {
    const start = mondayOf(dayKey(new Date(s.datum)));
    const slot = out.find((w) => w.start === start);
    if (slot) slot.anzahl += 1;
  }
  return out;
}

export function averageMs(results) {
  if (!results.length) return 0;
  return results.reduce((sum, r) => sum + cappedMs(r.ms), 0) / results.length;
}
