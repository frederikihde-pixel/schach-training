// Logik des Taktik-Trainers: Einstufung/Elo, Leitner, Statistik, Sitzungsplanung, Rätsel-Laden.
import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedScore, kFactor, updateStrength, placementNextTarget, placementEstimate,
  PLACEMENT_COUNT, bandOf, bandsFor,
} from "../../js/rating.js";
import { dayKey, addDays, afterFailure, afterSuccess, isDue, dueCards, INTERVALS } from "../../js/leitner.js";
import { addAttempt, themeStats, weakestThemes, sessionWeakest, sessionsPerWeek, mondayOf, cappedMs, MS_CAP } from "../../js/stats.js";
import { buildSession, makeRng } from "../../js/session.js";
import { createPuzzleStore, parsePuzzle, splitMoves } from "../../js/puzzles.js";

// ---------- Elo und Einstufung ----------
test("Erwartungswert und K-Wert", () => {
  assert.equal(expectedScore(1500, 1500), 0.5);
  assert.ok(expectedScore(1000, 1500) > 0.9);
  assert.ok(expectedScore(2000, 1500) < 0.1);
  assert.deepEqual([0, 29, 30, 99, 100, 500].map(kFactor), [40, 40, 24, 24, 16, 16]);
});

test("Elo: richtig erhöht, falsch senkt; später kleinere Schritte", () => {
  const up = updateStrength(1500, 1500, true, 0);
  const down = updateStrength(1500, 1500, false, 0);
  assert.equal(up, 1520);
  assert.equal(down, 1480);
  assert.equal(updateStrength(1500, 1500, true, 200), 1508);
  assert.ok(updateStrength(1500, 1000, true, 0) - 1500 < 5, "ein sehr leichtes Rätsel bringt fast nichts");
});

function simulate(L, seed, probabilistic = false) {
  const rng = makeRng(seed * 7919 + L);
  const history = [];
  for (let i = 0; i < PLACEMENT_COUNT; i++) {
    const target = placementNextTarget(history);
    const rating = Math.round(target + (rng() - 0.5) * 100);
    const solved = probabilistic ? rng() < expectedScore(rating, L) : rating <= L;
    history.push({ target, rating, solved });
  }
  return { history, estimate: placementEstimate(history) };
}

test("Einstufung beginnt bei 1000 und geht schrittweise (400, 300, 200 ...)", () => {
  assert.equal(placementNextTarget([]), 1000);
  const h = [{ target: 1000, rating: 1000, solved: true }];
  assert.equal(placementNextTarget(h), 1400);
  h.push({ target: 1400, rating: 1400, solved: false });
  assert.equal(placementNextTarget(h), 1100, "zweiter Schritt ist 300");
  assert.equal(placementNextTarget([{ target: 600, rating: 600, solved: false }]), 600, "nicht unter 600");
});

test("Einstufung mit simulierten Antworten landet im erwarteten Band", () => {
  for (let L = 700; L <= 2400; L += 100) {
    for (let seed = 1; seed <= 30; seed++) {
      const { estimate } = simulate(L, seed);
      assert.ok(Math.abs(estimate - L) <= 100, `Stärke ${L}, Schätzung ${estimate}`);
      assert.ok(Math.abs(bandOf(estimate) - bandOf(L)) <= 100, `Band ${bandOf(L)} erwartet, ${bandOf(estimate)} erhalten`);
    }
  }
});

test("Einstufung mit zufälligen Antworten (realistischer Spieler) ist im Mittel nah dran", () => {
  for (const L of [900, 1300, 1700, 2100]) {
    let sum = 0;
    const runs = 200;
    for (let seed = 1; seed <= runs; seed++) sum += simulate(L, seed, true).estimate - L;
    assert.ok(Math.abs(sum / runs) < 80, `Stärke ${L}: mittlere Abweichung ${sum / runs}`);
  }
});

test("Bänder", () => {
  assert.equal(bandOf(1599), 1500);
  assert.equal(bandOf(100), 600);
  assert.equal(bandOf(3000), 2700);
  assert.deepEqual(bandsFor(1470, 1670), [1400, 1500, 1600]);
});

// ---------- Leitner ----------
test("Leitner: 1, 3, 7, 21 Tage; richtig = nächste Stufe; falsch = zurück auf Stufe 1", () => {
  const p = { id: "a" };
  assert.deepEqual(INTERVALS, [1, 3, 7, 21]);
  let card = afterFailure(p, "2026-11-12");
  assert.deepEqual([card.stufe, card.faellig], [1, "2026-11-13"]);
  card = afterSuccess(card, "2026-11-13");
  assert.deepEqual([card.stufe, card.faellig], [2, "2026-11-16"]);
  card = afterSuccess(card, "2026-11-16");
  assert.deepEqual([card.stufe, card.faellig], [3, "2026-11-23"]);
  card = afterSuccess(card, "2026-11-23");
  assert.deepEqual([card.stufe, card.faellig], [4, "2026-12-14"]);
  assert.equal(afterSuccess(card, "2026-12-14"), null, "nach Stufe 4 ist das Rätsel erledigt");
  const back = afterFailure(p, "2026-12-14");
  assert.deepEqual([back.stufe, back.faellig], [1, "2026-12-15"]);
});

test("Leitner: fällig am Tag selbst und danach; Monats- und Jahreswechsel", () => {
  const card = afterFailure({ id: "x" }, "2026-12-31");
  assert.equal(card.faellig, "2027-01-01");
  assert.equal(isDue(card, "2026-12-31"), false);
  assert.equal(isDue(card, "2027-01-01"), true);
  assert.equal(isDue(card, "2027-02-01"), true);
  assert.equal(addDays("2026-02-27", 3), "2026-03-02");
  assert.equal(dayKey(new Date(2026, 10, 5)), "2026-11-05");
  const cards = { a: { stufe: 2, faellig: "2026-11-10", raetsel: { id: "a" } }, b: { stufe: 1, faellig: "2026-11-20", raetsel: { id: "b" } }, c: { stufe: 1, faellig: "2026-11-09", raetsel: { id: "c" } } };
  assert.deepEqual(dueCards(cards, "2026-11-12").map((c) => c.raetsel.id), ["c", "a"]);
});

// ---------- Statistik ----------
test("Themen-Zähler, Mindestzahl 5 und schwächste Themen", () => {
  const themen = {};
  for (let i = 0; i < 6; i++) addAttempt(themen, ["fork", "endgame"], i < 2, 4000);
  for (let i = 0; i < 5; i++) addAttempt(themen, ["pin"], i < 4, 2000);
  addAttempt(themen, ["skewer"], false, 3000);
  const stats = Object.fromEntries(themeStats(themen).map((t) => [t.tag, t]));
  assert.equal(stats.fork.n, 6);
  assert.equal(stats.fork.avgMs, 4000);
  assert.equal(stats.skewer.enough, false);
  const weak = weakestThemes(themen, 3);
  assert.deepEqual(weak.map((t) => t.tag), ["endgame", "fork", "pin"], "niedrigste Quote zuerst, skewer hat zu wenig Daten");
});

test("Zeiten werden bei 120 Sekunden gedeckelt", () => {
  assert.equal(cappedMs(500000), MS_CAP);
  assert.equal(cappedMs(-5), 0);
});

test("schwächstes Thema der Sitzung", () => {
  assert.equal(sessionWeakest([{ themen: ["fork"], ok: true }]), null);
  const r = [
    { themen: ["fork", "endgame"], ok: false },
    { themen: ["fork"], ok: false },
    { themen: ["pin", "endgame"], ok: true },
    { themen: ["pin"], ok: true },
  ];
  assert.equal(sessionWeakest(r), "fork");
});

test("Sitzungen pro Woche (Wochenbeginn Montag)", () => {
  assert.equal(mondayOf("2026-11-12"), "2026-11-09"); // Donnerstag
  assert.equal(mondayOf("2026-11-15"), "2026-11-09"); // Sonntag
  assert.equal(mondayOf("2026-11-16"), "2026-11-16");
  const weeks = sessionsPerWeek(
    [{ datum: new Date(2026, 10, 9, 12).toISOString() }, { datum: new Date(2026, 10, 12, 8).toISOString() }, { datum: new Date(2026, 10, 3, 8).toISOString() }, { datum: new Date(2026, 0, 3).toISOString() }],
    "2026-11-12", 4);
  assert.deepEqual(weeks.map((w) => [w.start, w.anzahl]), [["2026-10-19", 0], ["2026-10-26", 0], ["2026-11-02", 1], ["2026-11-09", 2]]);
});

// ---------- Sitzungsplanung ----------
function puzzles(n, themen = ["fork"], prefix = "n") {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, fen: "x", zuege: "a b", rating: 1500, themen: i % 2 ? themen : ["pin"] }));
}
const card = (id, themen = ["fork"]) => ({ stufe: 1, faellig: "2026-11-10", raetsel: { id, fen: "x", zuege: "a b", rating: 1400, themen } });

test("Sitzung: 10 Rätsel, etwa 30 Prozent Wiederholungen, 70 Prozent neu", () => {
  const items = buildSession({ size: 10, due: [card("d1"), card("d2"), card("d3"), card("d4"), card("d5")], candidates: puzzles(50), rng: makeRng(1) });
  assert.equal(items.length, 10);
  assert.equal(items.filter((i) => i.art === "wiederholung").length, 3);
  assert.equal(items.filter((i) => i.art === "neu").length, 7);
  assert.equal(new Set(items.map((i) => i.puzzle.id)).size, 10);
});

test("Sitzung: ohne fällige Karten nur neue; zu wenige neue füllen mit fälligen auf", () => {
  const onlyNew = buildSession({ size: 10, due: [], candidates: puzzles(30), rng: makeRng(2) });
  assert.equal(onlyNew.filter((i) => i.art === "neu").length, 10);
  const mixed = buildSession({ size: 10, due: Array.from({ length: 9 }, (_, i) => card("d" + i)), candidates: puzzles(3), rng: makeRng(3) });
  assert.equal(mixed.length, 10);
  assert.equal(mixed.filter((i) => i.art === "neu").length, 3);
});

test("Sitzung: Hälfte der neuen Rätsel aus den schwächsten Themen", () => {
  const cands = [
    ...Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, fen: "x", zuege: "a b", rating: 1500, themen: ["skewer"] })),
    ...Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, fen: "x", zuege: "a b", rating: 1500, themen: ["pin"] })),
  ];
  for (let seed = 1; seed <= 20; seed++) {
    const items = buildSession({ size: 10, due: [], candidates: cands, weakThemes: ["skewer"], rng: makeRng(seed) });
    const weak = items.filter((i) => i.puzzle.themen.includes("skewer")).length;
    assert.ok(weak >= 5, `Seed ${seed}: ${weak} schwache`);
  }
});

test("Sitzung: Themenfilter beschränkt Neue und Fällige", () => {
  const cands = puzzles(40, ["fork"]);
  const items = buildSession({ size: 10, due: [card("dx", ["pin"]), card("dy", ["fork"])], candidates: cands, themeFilter: "fork", rng: makeRng(4) });
  assert.ok(items.every((i) => i.puzzle.themen.includes("fork")));
  assert.ok(!items.some((i) => i.puzzle.id === "dx"));
});

test("Sitzung: gleicher Zufall gleiche Sitzung, andere Größe", () => {
  const a = buildSession({ size: 5, due: [], candidates: puzzles(40), rng: makeRng(9) }).map((i) => i.puzzle.id);
  const b = buildSession({ size: 5, due: [], candidates: puzzles(40), rng: makeRng(9) }).map((i) => i.puzzle.id);
  assert.deepEqual(a, b);
  assert.equal(a.length, 5);
});

// ---------- Rätsel laden ----------
test("Rätsel-Store lädt Bänder erst bei Bedarf und nur einmal", async () => {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(url);
    if (url.endsWith("index.json")) return { baender: [] };
    const band = Number(url.match(/band-(\d+)/)[1]);
    return { raetsel: [[`a${band}`, "fen x y z", "e2e4 e7e5", band + 10, ["fork"]], [`b${band}`, "fen x y z", "d2d4 d7d5", band + 90, ["pin"]]] };
  };
  const store = createPuzzleStore({ fetchJson, base: "p/" });
  assert.deepEqual(calls, []);
  const list = await store.inRange(1450, 1620);
  assert.deepEqual(calls.sort(), ["p/band-1400.json", "p/band-1500.json", "p/band-1600.json"]);
  assert.deepEqual(list.map((p) => p.id).sort(), ["a1500", "a1600", "b1400", "b1500"]);
  await store.inRange(1450, 1620);
  assert.equal(calls.length, 3, "kein zweites Laden");
  assert.deepEqual(splitMoves(parsePuzzle(["x", "f", "e2e4 e7e5 g1f3", 1000, []])), ["e2e4", "e7e5", "g1f3"]);
});

test("Rätsel-Store: Fehler beim Laden wird nicht dauerhaft gemerkt", async () => {
  let fail = true;
  const store = createPuzzleStore({ fetchJson: async () => { if (fail) throw new Error("offline"); return { raetsel: [] }; }, base: "p/" });
  await assert.rejects(store.loadBand(1500));
  fail = false;
  assert.deepEqual(await store.loadBand(1500), []);
});

// ---------- Taktik-Zustand ----------
import { recordAttempt, finishSession, applyPlacement, recordStandort } from "../../js/taktik-state.js";
import { defaults } from "../../js/storage.js";

const P = (id, rating = 1500, themen = ["fork"]) => ({ id, fen: "f", zuege: "a b", rating, themen });
const T0 = "2026-11-12T10:00:00.000Z";

test("Versuch: Zähler, gesehen, Stärke; nicht gelöstes neues Rätsel kommt in die Wiederholung", () => {
  const t = defaults().taktik;
  t.staerke = 1500;
  recordAttempt(t, { puzzle: P("a"), art: "neu", solved: true, ms: 5000, today: "2026-11-12", nowIso: T0 });
  assert.equal(t.versuche.length, 1);
  assert.equal(t.themen.fork.ok, 1);
  assert.equal(t.gesehen.a, 1);
  assert.equal(t.staerke, 1520);
  assert.equal(t.anzahl, 1);
  assert.deepEqual(t.karten, {});
  recordAttempt(t, { puzzle: P("b"), art: "neu", solved: false, ms: 9000, today: "2026-11-12", nowIso: T0 });
  assert.equal(t.karten.b.stufe, 1);
  assert.equal(t.karten.b.faellig, "2026-11-13");
  assert.equal(t.karten.b.raetsel.id, "b", "das Rätsel liegt in der Karte (offline wiederholbar)");
  assert.ok(t.staerke < 1520);
});

test("Wiederholung: richtig = nächste Stufe, falsch = zurück auf Stufe 1, Stärke bleibt", () => {
  const t = defaults().taktik;
  t.staerke = 1500;
  recordAttempt(t, { puzzle: P("b"), art: "neu", solved: false, ms: 1, today: "2026-11-12", nowIso: T0 });
  const strength = t.staerke;
  recordAttempt(t, { puzzle: P("b"), art: "wiederholung", solved: true, ms: 1, today: "2026-11-13", nowIso: T0 });
  assert.deepEqual([t.karten.b.stufe, t.karten.b.faellig], [2, "2026-11-16"]);
  recordAttempt(t, { puzzle: P("b"), art: "wiederholung", solved: false, ms: 1, today: "2026-11-16", nowIso: T0 });
  assert.deepEqual([t.karten.b.stufe, t.karten.b.faellig], [1, "2026-11-17"]);
  assert.equal(t.staerke, strength, "Wiederholungen ändern die Stärke nicht");
  for (const [day, expectStufe] of [["2026-11-17", 2], ["2026-11-20", 3], ["2026-11-27", 4]]) {
    recordAttempt(t, { puzzle: P("b"), art: "wiederholung", solved: true, ms: 1, today: day, nowIso: T0 });
    assert.equal(t.karten.b.stufe, expectStufe);
  }
  recordAttempt(t, { puzzle: P("b"), art: "wiederholung", solved: true, ms: 1, today: "2026-12-18", nowIso: T0 });
  assert.equal(t.karten.b, undefined, "nach Stufe 4 erledigt");
});

test("Einstufungsrätsel zählen für den K-Wert, setzen die Stärke aber nicht selbst", () => {
  const t = defaults().taktik;
  recordAttempt(t, { puzzle: P("p1"), art: "neu", solved: true, ms: 1, today: "2026-11-12", nowIso: T0, placement: true });
  assert.equal(t.staerke, null);
  assert.equal(t.anzahl, 1);
  applyPlacement(t, 1450);
  assert.deepEqual([t.staerke, t.eingestuft], [1450, true]);
});

test("Sitzung abschließen: Zusammenfassung, Verlauf, Zeitmittel", () => {
  const t = defaults().taktik;
  t.staerke = 1432.4;
  const results = [
    { id: "a", themen: ["fork"], ok: true, ms: 10000, art: "neu" },
    { id: "b", themen: ["fork", "pin"], ok: false, ms: 20000, art: "neu" },
    { id: "c", themen: ["fork"], ok: false, ms: 30000, art: "wiederholung" },
  ];
  const s = finishSession(t, { typ: "sitzung", results, nowIso: T0 });
  assert.deepEqual([s.n, s.ok, s.fehler, s.msSchnitt, s.schwaechstes, s.staerke], [3, 1, 2, 20000, "fork", 1432]);
  assert.equal(t.sitzungen.length, 1);
  assert.deepEqual(t.verlauf, [{ t: T0, s: 1432 }]);
});

test("Standortbestimmung: Ergebnis mit Datum, Stärke und Statistik bleiben unberührt", () => {
  const t = defaults().taktik;
  const before = JSON.stringify(t);
  const results = Array.from({ length: 20 }, (_, i) => ({ id: "x" + i, themen: ["pin"], ok: i < 14, ms: 40000 }));
  const e = recordStandort(t, { results, satz: "abcd1234", nowIso: T0 });
  assert.deepEqual(e, { datum: T0, geloest: 14, von: 20, msSchnitt: 40000, satz: "abcd1234" });
  assert.equal(t.standort.length, 1);
  const copy = JSON.parse(before);
  copy.standort = t.standort;
  assert.deepEqual(t, copy);
});
