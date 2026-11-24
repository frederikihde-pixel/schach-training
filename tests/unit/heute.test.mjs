import test from "node:test";
import assert from "node:assert/strict";
import { defaults } from "../../js/storage.js";
import { naechsterSchritt, tageSeitLetzterPartie, PARTIE_PAUSE_TAGE, MAX_NEBENZEILEN } from "../../js/heute.js";

const JETZT = new Date("2026-11-23T10:00:00");
const vorTagen = (n) => new Date(JETZT.getTime() - n * 86400000).toISOString();
// Eingestufter Nutzer mit einer Partie von gestern, nichts fällig, nichts offen: Fall f
function basis() {
  const d = defaults(JETZT);
  d.taktik.eingestuft = true;
  d.taktik.staerke = 600;
  d.spielen.partien.push({ id: "p1", datum: vorTagen(1), modus: "partie", ausgang: "verloren" });
  d.spielen.analysen.push({ id: "p1", version: 1 });
  d.taktik.standort.push({ datum: vorTagen(5), geloest: 10, von: 20, pruefset: "einsteiger" });
  return d;
}
const karte = (id, faellig, eigen = false) => ({ stufe: 1, faellig, raetsel: { id, eigen, themen: [] } });

test("Fall a: noch keine Einstufung -> Einstufung starten", () => {
  const d = defaults(JETZT);
  const s = naechsterSchritt(d, JETZT);
  assert.equal(s.fall, "a");
  assert.equal(s.knopf, "Einstufung starten");
  assert.equal(s.aktion.typ, "einstufung");
  assert.deepEqual(s.neben, [], "ohne Einstufung keine Nebenzeilen");
});

test("Fall a gewinnt vor allem Übrigen (auch vor fälligen Karten und offenen Rückblicken)", () => {
  const d = defaults(JETZT);
  d.taktik.karten.x = karte("x", "2026-11-01");
  d.spielen.partien.push({ id: "p", datum: vorTagen(10), modus: "partie" });
  assert.equal(naechsterSchritt(d, JETZT).fall, "a");
});

test("Fall b: fällige Wiederholungen -> 'Sitzung starten (N fällig)', eigene Fehler werden genannt", () => {
  const d = basis();
  d.taktik.karten.a = karte("a", "2026-11-22");
  d.taktik.karten.b = karte("b", "2026-11-23");
  d.taktik.karten.c = karte("c", "2026-11-24"); // morgen: noch nicht fällig
  const s = naechsterSchritt(d, JETZT);
  assert.equal(s.fall, "b");
  assert.equal(s.knopf, "Sitzung starten (2 fällig)");
  assert.equal(s.text, "2 Wiederholungen sind fällig.");
  d.taktik.karten.e1 = karte("e1", "2026-11-20", true);
  const s2 = naechsterSchritt(d, JETZT);
  assert.equal(s2.knopf, "Sitzung starten (3 fällig)");
  assert.equal(s2.text, "3 Wiederholungen sind fällig, 1 davon aus eigenen Fehlern.");
  assert.deepEqual(s2.zahlen, { ...s2.zahlen, faellig: 3, eigeneFaellig: 1 });
  const einzeln = basis();
  einzeln.taktik.karten.a = karte("a", "2026-11-23");
  assert.equal(naechsterSchritt(einzeln, JETZT).text, "1 Wiederholung ist fällig.");
});

test("Fall b gewinnt vor c, d und e", () => {
  const d = basis();
  d.taktik.karten.a = karte("a", "2026-11-22");
  d.spielen.partien.push({ id: "p2", datum: vorTagen(30), modus: "partie" }); // offener Rückblick, aber letzte Partie ist die von gestern
  d.spielen.partien[0].datum = vorTagen(20);
  d.taktik.standort[0].datum = vorTagen(40);
  assert.equal(naechsterSchritt(d, JETZT).fall, "b");
});

test("Fall c: ein Rückblick ist offen -> 'Rückblick ansehen', der Knopf öffnet die neueste offene Partie", () => {
  const d = basis();
  d.spielen.partien.push({ id: "p2", datum: vorTagen(1), modus: "partie" });
  const s = naechsterSchritt(d, JETZT);
  assert.equal(s.fall, "c");
  assert.equal(s.knopf, "Rückblick ansehen");
  assert.deepEqual(s.aktion, { typ: "rueckblick", id: "p2" });
  d.spielen.partien.push({ id: "p3", datum: vorTagen(0), modus: "partie" });
  const s2 = naechsterSchritt(d, JETZT);
  assert.equal(s2.aktion.id, "p3", "neueste zuerst");
  assert.match(s2.text, /2 Partien warten/);
});

test("Rückblick: Grundmatts zählen nicht, Vorteil-Übungen schon", () => {
  const d = basis();
  d.spielen.versuche.push({ id: "g1", datum: vorTagen(0), modus: "grundmatt" });
  assert.equal(naechsterSchritt(d, JETZT).fall, "f");
  d.spielen.versuche.push({ id: "v1", datum: vorTagen(0), modus: "vorteil" });
  assert.equal(naechsterSchritt(d, JETZT).fall, "c");
});

test("Fall d: letzte Partie 3 Tage oder länger her -> 'Partie spielen'; 2 Tage noch nicht", () => {
  const d = basis();
  d.spielen.partien[0].datum = vorTagen(2);
  assert.equal(naechsterSchritt(d, JETZT).fall, "f", "2 Tage: noch kein Fall d");
  d.spielen.partien[0].datum = vorTagen(PARTIE_PAUSE_TAGE);
  const s = naechsterSchritt(d, JETZT);
  assert.equal(s.fall, "d");
  assert.equal(s.knopf, "Partie spielen");
  assert.equal(s.text, "Deine letzte Partie war vor 3 Tagen. Eine Partie hält dein Training im Spiel.");
  assert.deepEqual(s.aktion, { typ: "partie" });
  d.spielen.partien[0].datum = vorTagen(12);
  assert.match(naechsterSchritt(d, JETZT).text, /vor 12 Tagen/);
});

test("Fall d auch ohne jede Partie; Vorteil-Übungen und Grundmatts zählen nicht als Partie", () => {
  const d = basis();
  d.spielen.partien = [];
  d.spielen.analysen = [];
  assert.equal(naechsterSchritt(d, JETZT).fall, "d");
  assert.match(naechsterSchritt(d, JETZT).text, /noch keine Partie/);
  d.spielen.versuche.push({ id: "v", datum: vorTagen(0), modus: "vorteil" });
  d.spielen.analysen.push({ id: "v", version: 1 });
  assert.equal(naechsterSchritt(d, JETZT).fall, "d");
  assert.equal(tageSeitLetzterPartie(d, JETZT), null);
});

test("Fall e: Standortbestimmung nach 4 Wochen fällig (wenn kein früherer Fall zutrifft)", () => {
  const d = basis();
  d.taktik.standort[0].datum = vorTagen(28);
  const s = naechsterSchritt(d, JETZT);
  assert.equal(s.fall, "e");
  assert.equal(s.knopf, "Standortbestimmung");
  assert.deepEqual(s.aktion, { typ: "standort" });
  d.taktik.standort[0].datum = vorTagen(27);
  assert.equal(naechsterSchritt(d, JETZT).fall, "f", "27 Tage: noch nicht");
  const ohne = basis();
  ohne.taktik.standort = [];
  assert.equal(naechsterSchritt(ohne, JETZT).fall, "f", "wer nie eine gemacht hat, wird nicht erinnert");
});

test("Fall e wird von d verdeckt, solange keine Partie gespielt wurde (Reihenfolge a bis f)", () => {
  const d = basis();
  d.taktik.standort[0].datum = vorTagen(40);
  d.spielen.partien[0].datum = vorTagen(5);
  assert.equal(naechsterSchritt(d, JETZT).fall, "d");
  assert.ok(naechsterSchritt(d, JETZT).neben.some((n) => n.aktion.typ === "standort"), "die Erinnerung bleibt als Nebenzeile sichtbar");
});

test("Fall f: sonst 'Sitzung starten'", () => {
  const s = naechsterSchritt(basis(), JETZT);
  assert.equal(s.fall, "f");
  assert.equal(s.knopf, "Sitzung starten");
  assert.deepEqual(s.aktion, { typ: "sitzung" });
});

test("Etwas läuft: Fortsetzen geht allen Fällen voraus", () => {
  const d = defaults(JETZT);
  d.taktik.aktiv = { typ: "einstufung", plan: [], index: 3 };
  let s = naechsterSchritt(d, JETZT);
  assert.deepEqual([s.fall, s.knopf, s.aktion.typ], ["fortsetzen", "Sitzung fortsetzen", "sitzung-fortsetzen"]);
  const e = basis();
  e.spielen.aktiv = { modus: "partie", zuege: [] };
  e.taktik.karten.a = karte("a", "2026-11-01");
  s = naechsterSchritt(e, JETZT);
  assert.deepEqual([s.fall, s.knopf, s.aktion.typ], ["fortsetzen", "Partie fortsetzen", "partie-fortsetzen"]);
});

test("Höchstens zwei Nebenzeilen, nie dasselbe wie der Hauptknopf, keine Doppelung 'Sitzung starten' bei Fall b", () => {
  const d = basis();
  d.taktik.karten.a = karte("a", "2026-11-22");
  d.spielen.partien.push({ id: "p2", datum: vorTagen(1), modus: "partie" });
  d.taktik.standort[0].datum = vorTagen(40);
  const s = naechsterSchritt(d, JETZT);
  assert.equal(s.fall, "b");
  assert.ok(s.neben.length <= MAX_NEBENZEILEN);
  assert.deepEqual(s.neben.map((n) => n.text), ["Rückblick offen: 1", "Standortbestimmung ist fällig"]);
  assert.ok(!s.neben.some((n) => n.aktion.typ === "sitzung"));
  // Fall f: Nebenzeilen Partie spielen kommt, Sitzung nicht doppelt
  const f = naechsterSchritt(basis(), JETZT);
  assert.deepEqual(f.neben.map((n) => n.text), ["Partie spielen"]);
});

test("Keine Gamification: kein Wort zu Serien, Punkten oder Auszeichnungen in den Texten", () => {
  const fälle = [defaults(JETZT), basis()];
  const d = basis();
  d.taktik.karten.a = karte("a", "2026-11-22");
  fälle.push(d);
  for (const x of fälle) {
    const s = naechsterSchritt(x, JETZT);
    const alles = [s.knopf, s.text, ...s.neben.map((n) => n.text)].join(" ");
    assert.doesNotMatch(alles, /Serie|Streak|Punkte|Abzeichen|Bravo|Super|Glückwunsch|Tag in Folge/i);
  }
});
