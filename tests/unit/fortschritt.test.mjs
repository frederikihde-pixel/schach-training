import test from "node:test";
import assert from "node:assert/strict";
import { auswertung, grundmattZahlen, vorteilZahlen, aeltereVersionen, partienGruppe, bilanz, MIN_PARTIEN, aussagekraft, formatBauerneinheiten } from "../../js/fortschritt.js";
import { empfehlung } from "../../js/empfehlung.js";
import { defaults } from "../../js/storage.js";

const t0 = new Date("2026-11-19T10:00:00Z");
let n = 0;
const partie = (o = {}) => ({ id: "p" + ++n, datum: new Date(t0.getTime() + n * 60000).toISOString(), modus: "partie", farbe: "w", stufe: 2, stufenversion: 1, ausgang: "verloren", warnung: false, ...o });
const analyse = (id, patzer, o = {}) => ({
  id, version: 1, summe: { zuege: 30, patzer, fehler: 0, chancen: 0, verlustSumme: patzer * 600 + 300, ...(o.summe || {}) },
  eintraege: o.eintraege || Array.from({ length: patzer }, () => ({ art: "patzer", ursache: "figur", phase: "mittelspiel" })),
});
const spielen = (partien, analysen = [], versuche = []) => ({ ...defaults(t0).spielen, partien, analysen, versuche });

test("Weniger als 5 Partien: 'zu wenig Daten'", () => {
  const s = spielen([partie(), partie(), partie(), partie()]);
  const a = auswertung(s);
  assert.equal(a.anzahl, 4);
  assert.equal(a.genug, false);
  assert.equal(aussagekraft(4), "zu wenig Daten");
  assert.equal(aussagekraft(7), "noch wenig Daten");
  assert.match(aussagekraft(12), /genug Daten/);
  assert.equal(MIN_PARTIEN, 5);
});

test("Ergebnisse je Stufe: gewonnen, remis, verloren", () => {
  const s = spielen([partie({ stufe: 1, ausgang: "gewonnen" }), partie({ stufe: 1, ausgang: "verloren" }), partie({ stufe: 2, ausgang: "remis" }), partie({ stufe: 2, ausgang: "gewonnen" }), partie({ stufe: 2, ausgang: "gewonnen" })]);
  const a = auswertung(s);
  assert.deepEqual(a.proStufe, [{ stufe: 1, n: 2, gewonnen: 1, remis: 0, verloren: 1 }, { stufe: 2, n: 3, gewonnen: 2, remis: 1, verloren: 0 }]);
  assert.equal(a.genug, true);
});

test("Nur Partien mit der gleichen Stufenversion zählen; frühere Versionen werden getrennt gezählt", () => {
  const alt = [partie({ stufenversion: 0, ausgang: "gewonnen" }), partie({ stufenversion: 0, ausgang: "gewonnen" }), partie({ stufenversion: 0, ausgang: "verloren" })];
  const neu = [1, 2, 3, 4, 5].map(() => partie({ ausgang: "verloren" }));
  const s = spielen([...alt, ...neu], [], [{ id: "v1", modus: "vorteil", stufenversion: 0, ausgang: "gewonnen", art: "dame" }]);
  const a = auswertung(s, { stufenversion: 1 });
  assert.equal(a.anzahl, 5, "die 3 alten Partien sind nicht dabei");
  assert.deepEqual(a.proStufe[0], { stufe: 2, n: 5, gewonnen: 0, remis: 0, verloren: 5 });
  assert.deepEqual(aeltereVersionen(s, { stufenversion: 1 }), [{ version: 0, partien: 3, versuche: 1, gewonnen: 3, remis: 0, verloren: 1 }]);
  // Version 0 für sich ausgewertet
  assert.equal(auswertung(s, { stufenversion: 0 }).anzahl, 3);
  assert.equal(partienGruppe(s, { stufenversion: 1 }).length, 5);
  // Die Empfehlung benutzt ebenfalls nur die aktuelle Version
  const e = empfehlung([...alt, ...neu.slice(0, 2)], 1);
  assert.equal(e, null, "nur 2 Partien der aktuellen Version: keine Empfehlung");
});

test("Partien mit Patzer-Warnung werden getrennt gezählt", () => {
  const s = spielen([partie({ warnung: true }), partie({ warnung: true }), partie({ warnung: false }), partie({ warnung: false }), partie({ warnung: false }), partie({ warnung: false }), partie({ warnung: false })]);
  assert.equal(auswertung(s, { warnung: false }).anzahl, 5);
  assert.equal(auswertung(s, { warnung: true }).anzahl, 2);
});

test("Patzer je Partie mit Mittel der letzten 5; Verlust je Zug; Phasen; Fehlerarten", () => {
  const ps = [3, 2, 4, 1, 0, 2].map((k) => partie());
  const patzer = [3, 2, 4, 1, 0, 2];
  const as = ps.map((p, i) => analyse(p.id, patzer[i]));
  as[0].eintraege = [{ art: "patzer", ursache: "figur", phase: "eroeffnung" }, { art: "patzer", ursache: "matt", phase: "mittelspiel" }, { art: "patzer", ursache: "drohung", phase: "endspiel" }];
  as[1].eintraege = [{ art: "chance", ursache: "chance", phase: "mittelspiel" }, { art: "fehler", ursache: "sonstig", phase: "mittelspiel" }];
  const a = auswertung(spielen(ps, as));
  assert.equal(a.analysiert, 6);
  assert.deepEqual(a.patzerProPartie.map((x) => x.patzer), patzer);
  assert.deepEqual(a.patzerProPartie.map((x) => x.mittel), [null, null, null, null, 2, 1.8], "Mittel (3+2+4+1+0)/5 = 2 und (2+4+1+0+2)/5 = 1,8");
  assert.equal(a.patzerMittel5, 1.8);
  const summeVerlust = patzer.reduce((s, k) => s + k * 600 + 300, 0);
  assert.equal(a.verlustProZug, summeVerlust / (6 * 30));
  // nur Partie 0 und die übrigen mit je k Standardeinträgen (figur, Mittelspiel): Patzer nach Phase
  assert.equal(a.patzerPhasen.eroeffnung, 1);
  assert.equal(a.patzerPhasen.endspiel, 1);
  assert.equal(a.patzerPhasen.mittelspiel, 1 + (4 + 1 + 0 + 2), "Partie 0: 1, Partie 1: 0 Patzer, Partien 2 bis 5: 4+1+0+2");
  assert.equal(a.fehlerArten.chance, 1);
  assert.equal(a.fehlerArten.sonstig, 1);
  assert.equal(a.fehlerArten.drohung, 2, "Drohung übersehen und erlaubtes Matt zählen zusammen");
  assert.equal(a.fehlerArten.figur, 1 + 4 + 1 + 0 + 2);
  assert.equal(a.genugAnalyse, true);
});

test("Analyse-Zahlen brauchen mindestens 5 analysierte Partien", () => {
  const ps = [1, 2, 3, 4, 5].map(() => partie());
  const a = auswertung(spielen(ps, [analyse(ps[0].id, 1), analyse(ps[1].id, 2)]));
  assert.equal(a.anzahl, 5);
  assert.equal(a.analysiert, 2);
  assert.equal(a.genugAnalyse, false);
  assert.equal(a.patzerMittel5, null);
});

test("Grundmatts: Quote und Mittel der letzten 5 Versuche je Figur", () => {
  const v = (art, matt, mattIn) => ({ modus: "grundmatt", art, matt, mattIn: matt ? mattIn : null, stufenversion: 1, ausgang: matt ? "gewonnen" : "remis" });
  const s = spielen([], [], [v("dame", true, 12), v("dame", false), v("dame", true, 10), v("dame", true, 8), v("dame", true, 6), v("dame", true, 4), v("dame", false), v("turm", true, 20), { ...v("dame", true, 3), stufenversion: 0 }]);
  const g = grundmattZahlen(s);
  assert.equal(g.arten.dame.alle.n, 7);
  assert.equal(g.arten.dame.alle.erfolge, 5);
  assert.deepEqual(g.arten.dame.letzte5, { n: 5, erfolge: 4, quote: 0.8, schnitt: 7 }, "letzte 5: 10, 8, 6, 4 und ein Misserfolg; Mittel der Erfolge (10+8+6+4)/4 = 7");
  assert.equal(g.arten.turm.letzte5.schnitt, 20);
  assert.equal(g.gesamt.n, 8, "Versuche einer anderen Version zählen nicht");
});

test("Vorteil verwerten: Quote gewonnen, getrennt von normalen Partien", () => {
  const v = (art, ausgang) => ({ modus: "vorteil", art, ausgang, stufenversion: 1 });
  const s = spielen([partie()], [], [v("dame", "gewonnen"), v("dame", "gewonnen"), v("dame", "remis"), v("turm", "verloren"), v("springer", "gewonnen")]);
  const z = vorteilZahlen(s);
  assert.deepEqual([z.gesamt.n, z.gesamt.gewonnen, z.gesamt.remis, z.gesamt.verloren], [5, 3, 1, 1]);
  assert.equal(z.gesamt.quote, 0.6);
  assert.equal(z.arten.dame.quote, 2 / 3);
  assert.equal(auswertung(s).anzahl, 1, "Vorteil-Versuche zählen nicht als Partien");
});

test("Kleinigkeiten: Bilanz und Bauerneinheiten", () => {
  assert.deepEqual(bilanz([{ ausgang: "gewonnen" }, { ausgang: "remis" }]), { n: 2, gewonnen: 1, remis: 1, verloren: 0 });
  assert.equal(formatBauerneinheiten(85), "0,9");
});
