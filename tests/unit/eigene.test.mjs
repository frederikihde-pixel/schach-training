import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "../../vendor/chess.js/chess.js";
import { defaults } from "../../js/storage.js";
import { leseEingabe, analyseEintrag, bewerteZuege } from "../../js/analyse.js";
import { baueRaetsel, aufnehmen, ausAnalyse, raetselFuerEintrag, eigeneZahlen, raetselId, MAX_EIGENE } from "../../js/eigene.js";
import { buildSession, makeRng, OWN_SHARE } from "../../js/session.js";
import { recordAttempt } from "../../js/taktik-state.js";
import { dueCards } from "../../js/leitner.js";
import { weakestThemes, EIGENER_FEHLER } from "../../js/stats.js";
import { themeLabel, themeInfo } from "../../js/themes.js";

const t0 = new Date("2026-11-19T10:00:00Z");
const ctx = { today: "2026-11-19", nowIso: t0.toISOString() };
const L = (u, cp, m = null, pv = null) => ({ u, cp, m, pv: pv || [u] });
const R = (i, lines, extra = {}) => ({ i, cp: lines[0] ? lines[0].cp : 0, mate: lines[0] ? lines[0].m : null, best: lines[0] && lines[0].u, lines, ...extra });

// 1.e4 e5 2.Dh5 Sc6 3.Dxe5+ Sxe5: Weiß stellt die Dame ein (Zug ply 4)
const ZUEGE = ["e2e4", "e7e5", "d1h5", "b8c6", "h5e5", "c6e5"];
function dameAnalyse(lines4) {
  const e = leseEingabe({ zuege: ZUEGE, farbe: "w" });
  const erg = [
    R(0, [L("e2e4", 30), L("d2d4", 25), L("g1f3", 20)]),
    R(1, [L("e7e5", 30)]),
    R(2, [L("d1h5", 20), L("g1f3", 20), L("f1c4", 15)]),
    R(3, [L("b8c6", 20)]),
    R(4, lines4),
    R(5, [L("c6e5", 800)]),
    { i: 6, cp: 0, mate: null, best: null, lines: [] },
  ];
  erg[5].lines = [L("c6e5", 800)];
  return analyseEintrag({ id: "g1", eingabe: e, ergebnisse: erg, datum: t0.toISOString() });
}
const gut = [L("f1c4", 20, null, ["f1c4", "g8f6", "g1f3"]), L("g1f3", 15), L("h5f3", -300)];

test("Rätsel aus dem Damenverlust: Stellung vor dem Zug, Gegnerzug zuerst, richtiger Zug, kurze Hauptvariante", () => {
  const a = dameAnalyse(gut);
  assert.equal(a.eintraege.length, 1);
  const p = baueRaetsel(a, a.eintraege[0], { datum: a.datum });
  assert.ok(p);
  assert.equal(p.id, "e-g1-4");
  assert.equal(p.zugFen.split(" ")[1], "w", "Weiß ist vor dem eigenen Zug am Zug");
  assert.equal(new Chess(p.fen).turn(), "b", "Runner-Stellung: der Gegner (Schwarz) zieht zuerst");
  assert.equal(p.zuege.split(" ")[0], "b8c6");
  assert.equal(p.zuege.split(" ")[1], "f1c4");
  assert.ok(p.zuege.split(" ").length <= 4, "Gegnerzug plus höchstens 3 Halbzüge");
  assert.deepEqual(p.richtig, ["f1c4", "g1f3"], "Züge bis 50 Centipawn unter dem besten sind richtig");
  assert.deepEqual(p.themen, [EIGENER_FEHLER]);
  assert.equal(p.eigen, true);
  assert.equal(p.nr, 3);
  // Gegnerzug ist in der Runner-Stellung legal
  const c = new Chess(p.fen);
  for (const m of p.zuege.split(" ").slice(0, 2)) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
});

test("Nicht eindeutig: kein Rätsel, wenn der Abstand zum nächsten falschen Zug unter 150 liegt", () => {
  const a = dameAnalyse([L("f1c4", 20), L("g1f3", 0), L("d2d4", -100)]);
  // der Abstand zum ersten Zug außerhalb der 50er-Gruppe (g1f3 bei 0) ist 20, also zu klein
  const p = baueRaetsel(a, a.eintraege[0]);
  assert.equal(p, null);
  // nur zwei Kandidaten mit klarem Abstand: eindeutig
  const a2 = dameAnalyse([L("f1c4", 20), L("g1f3", -200)]);
  assert.ok(baueRaetsel(a2, a2.eintraege[0]));
  // alle drei gleich gut: unbekannt, ob andere Züge schlecht sind -> kein Rätsel
  const a3 = dameAnalyse([L("f1c4", 20), L("g1f3", 10), L("d2d4", 0)]);
  assert.equal(baueRaetsel(a3, a3.eintraege[0]), null);
  // nur ein Kandidat (z. B. ein einziger legaler Zug): kein Rätsel
  const a4 = dameAnalyse([L("f1c4", 20)]);
  assert.equal(baueRaetsel(a4, a4.eintraege[0]), null);
});

test("Kein Rätsel ohne vorherigen Gegnerzug (erster Zug von Weiß)", () => {
  const a = { id: "x", startFen: new Chess().fen(), zuegeUci: ["a2a3"], datum: null };
  const e = { ply: 0, nr: 1, art: "patzer", lines: [L("e2e4", 100), L("a2a3", -300)] };
  assert.equal(baueRaetsel(a, e), null);
});

test("Aufnehmen: Karte (Stufe 1, morgen fällig) und Kurzangabe; doppelt wird nicht noch einmal aufgenommen", () => {
  const d = defaults(t0);
  const a = dameAnalyse(gut);
  assert.equal(ausAnalyse(d, a, ctx), 1);
  const karte = d.taktik.karten["e-g1-4"];
  assert.equal(karte.stufe, 1);
  assert.equal(karte.faellig, "2026-11-20", "nach 1 Tag fällig (Leitner)");
  assert.equal(karte.raetsel.eigen, true);
  assert.equal(d.spielen.eigene.length, 1);
  assert.equal(ausAnalyse(d, a, ctx), 0, "dieselbe Analyse noch einmal: nichts doppelt");
  assert.equal(d.spielen.eigene.length, 1);
});

test("Nur Patzer und verpasste Chancen werden automatisch zu Rätseln, Fehler nicht; auf Wunsch auch Fehler", () => {
  const e = leseEingabe({ zuege: ["a2a3", "e7e5"], farbe: "w" });
  const erg = [R(0, [L("e2e4", 100), L("d2d4", 90), L("a2a3", -80)]), R(1, [L("e7e5", 80)]), { i: 2, cp: 0, mate: null, best: null, lines: [] }];
  erg[2] = R(2, [L("g1f3", 100)]);
  const a = analyseEintrag({ id: "g2", eingabe: e, ergebnisse: erg, datum: t0.toISOString() });
  assert.equal(a.eintraege[0].art, "fehler");
  const d = defaults(t0);
  assert.equal(ausAnalyse(d, a, ctx), 0);
  // ply 0 hat keinen Gegnerzug: auch auf Wunsch kein Rätsel
  assert.equal(raetselFuerEintrag(d, a, a.eintraege[0], ctx), null);
  // Fehler im Mittelspiel auf Wunsch
  const a1 = dameAnalyse(gut);
  a1.eintraege[0].art = "fehler";
  const d1 = defaults(t0);
  assert.equal(ausAnalyse(d1, a1, ctx), 0);
  const p = raetselFuerEintrag(d1, a1, a1.eintraege[0], ctx);
  assert.ok(p && d1.taktik.karten[p.id]);
  assert.equal(raetselFuerEintrag(d1, a1, a1.eintraege[0], ctx).id, p.id, "zweiter Aufruf gibt dasselbe Rätsel");
});

test("Obergrenze 300: die ältesten fallen samt Karte weg", () => {
  const d = defaults(t0);
  for (let i = 0; i < MAX_EIGENE + 5; i++) aufnehmen(d, { id: raetselId("x", i), partieId: "x", nr: i, art: "patzer", eigen: true }, ctx);
  assert.equal(d.spielen.eigene.length, 300);
  assert.equal(Object.keys(d.taktik.karten).length, 300);
  assert.equal(d.taktik.karten[raetselId("x", 0)], undefined);
  assert.ok(d.taktik.karten[raetselId("x", 304)]);
});

test("Im Wiederholungssystem: 1, 3, 7, 21 Tage; ändert die Taktikstärke nicht; zählt als Thema 'Eigener Fehler'", () => {
  const d = defaults(t0);
  d.taktik.staerke = 777;
  d.taktik.eingestuft = true;
  d.taktik.anzahl = 30;
  const a = dameAnalyse(gut);
  ausAnalyse(d, a, ctx);
  const puzzle = d.taktik.karten["e-g1-4"].raetsel;
  let day = "2026-11-20";
  const gaps = [];
  let letzter = "2026-11-19";
  for (let k = 0; k < 4; k++) {
    recordAttempt(d.taktik, { puzzle, art: "wiederholung", solved: true, ms: 5000, today: day, nowIso: day + "T10:00:00Z" });
    const karte = d.taktik.karten[puzzle.id];
    if (!karte) break;
    gaps.push(Math.round((Date.parse(karte.faellig) - Date.parse(day)) / 86400000));
    day = karte.faellig;
  }
  assert.deepEqual(gaps, [3, 7, 21], "nach richtiger Lösung: 3, 7 und 21 Tage; nach der vierten ist das Rätsel erledigt");
  assert.equal(d.taktik.karten[puzzle.id], undefined, "erledigt");
  assert.equal(d.taktik.staerke, 777, "Taktikstärke unverändert");
  assert.equal(d.taktik.anzahl, 30);
  assert.deepEqual(d.taktik.themen[EIGENER_FEHLER], { n: 4, ok: 4, ms: 20000 });
  // falsch gelöst: zurück auf Stufe 1, morgen
  recordAttempt(d.taktik, { puzzle, art: "wiederholung", solved: false, ms: 9000, today: "2026-12-30", nowIso: "2026-12-30T10:00:00Z" });
  assert.deepEqual([d.taktik.karten[puzzle.id].stufe, d.taktik.karten[puzzle.id].faellig], [1, "2026-12-31"]);
  assert.equal(d.taktik.staerke, 777);
});

test("Sitzung: etwa 25 Prozent eigene Fehler, solange fällig; sonst wie bisher", () => {
  const eigene = [1, 2, 3, 4, 5].map((i) => ({ stufe: 1, faellig: "2026-11-18", raetsel: { id: "e-" + i, eigen: true, themen: ["eigenerFehler"], fen: "x", zuege: "a b", rating: null } }));
  const normal = [1, 2, 3].map((i) => ({ stufe: 1, faellig: "2026-11-18", raetsel: { id: "n" + i, themen: ["fork"], fen: "x", zuege: "a b", rating: 800 } }));
  const kandidaten = Array.from({ length: 30 }, (_, i) => ({ id: "c" + i, themen: ["pin"], fen: "x", zuege: "a b", rating: 800 }));
  const plan = buildSession({ size: 10, due: [...eigene, ...normal], candidates: kandidaten, rng: makeRng(1) });
  const own = plan.filter((x) => x.puzzle.eigen);
  assert.equal(plan.length, 10);
  assert.equal(own.length, 3, "25 Prozent von 10, gerundet");
  assert.ok(own.length / 10 >= 0.2 && own.length / 10 <= 0.3);
  assert.ok(own.every((x) => x.art === "wiederholung"));
  assert.equal(plan.filter((x) => x.art === "wiederholung" && !x.puzzle.eigen).length, 3);
  // nichts fällig: keine eigenen
  const ohne = buildSession({ size: 10, due: normal, candidates: kandidaten, rng: makeRng(1) });
  assert.equal(ohne.filter((x) => x.puzzle.eigen).length, 0);
  // nur 1 fällig: 1
  const eins = buildSession({ size: 10, due: [eigene[0]], candidates: kandidaten, rng: makeRng(1) });
  assert.equal(eins.filter((x) => x.puzzle.eigen).length, 1);
  // 5 Rätsel pro Sitzung: 1 eigenes (20 Prozent); 20 Rätsel: 5
  assert.equal(buildSession({ size: 5, due: eigene, candidates: kandidaten, rng: makeRng(2) }).filter((x) => x.puzzle.eigen).length, 1);
  assert.equal(buildSession({ size: 20, due: eigene, candidates: kandidaten, rng: makeRng(2) }).filter((x) => x.puzzle.eigen).length, 5);
  // Themenfilter: ein anderes Thema schließt eigene aus, "Eigener Fehler" lässt nur sie zu
  const fork = buildSession({ size: 10, due: [...eigene, ...normal], candidates: kandidaten.map((c) => ({ ...c, themen: ["fork"] })), themeFilter: "fork", rng: makeRng(3) });
  assert.equal(fork.filter((x) => x.puzzle.eigen).length, 0);
  const nurEigene = buildSession({ size: 10, due: [...eigene, ...normal], candidates: [], themeFilter: EIGENER_FEHLER, rng: makeRng(3) });
  assert.ok(nurEigene.length > 0 && nurEigene.every((x) => x.puzzle.eigen));
  assert.equal(OWN_SHARE, 0.25);
  assert.equal(dueCards({ a: eigene[0] }, "2026-11-19").length, 1);
});

test("Statistik: 'Eigener Fehler' ist ein eigenes Thema mit Namen, zählt aber nicht zu den schwächsten Themen", () => {
  assert.equal(themeLabel(EIGENER_FEHLER), "Eigener Fehler");
  assert.ok(themeInfo(EIGENER_FEHLER).length > 20);
  const themen = { [EIGENER_FEHLER]: { n: 10, ok: 1, ms: 1000 }, fork: { n: 10, ok: 5, ms: 1000 } };
  assert.deepEqual(weakestThemes(themen, 3).map((t) => t.tag), ["fork"]);
});

test("Zahlen für die Anzeige: Anzahl, fällige, Lösungsquote", () => {
  const d = defaults(t0);
  ausAnalyse(d, dameAnalyse(gut), ctx);
  assert.deepEqual(eigeneZahlen(d, "2026-11-19"), { anzahl: 1, faellig: 0, versuche: 0, richtig: 0, quote: null });
  assert.equal(eigeneZahlen(d, "2026-11-20").faellig, 1);
  d.taktik.themen[EIGENER_FEHLER] = { n: 4, ok: 3, ms: 1 };
  assert.equal(eigeneZahlen(d, "2026-11-20").quote, 0.75);
});
