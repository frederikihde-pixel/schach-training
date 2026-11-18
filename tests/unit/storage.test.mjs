// Start: node --test tests/unit
import test from "node:test";
import assert from "node:assert/strict";
import {
  createStore, defaults, migrate, validate, trim, exportReminderDue, standortReminderDue, standortReminder,
  DataError, STORAGE_KEY, SCHEMA_VERSION, CAPS,
} from "../../js/storage.js";

function backend(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    persistent: true, map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}
const day = 24 * 60 * 60 * 1000;
const t0 = new Date("2026-11-12T10:00:00Z");

test("leerer Start liefert Standardwerte mit Version und App-Kennung", () => {
  const s = createStore({ backend: backend(), now: () => t0 });
  const d = s.get();
  assert.equal(d.version, SCHEMA_VERSION);
  assert.equal(d.app, "schach-training");
  assert.equal(d.taktik.staerke, null);
  assert.equal(d.erstelltAm, t0.toISOString());
});

test("update speichert unter genau einem Schlüssel und übersteht ein neues Laden", () => {
  const b = backend();
  const s1 = createStore({ backend: b, now: () => t0 });
  s1.update((d) => { d.taktik.staerke = 1234; });
  assert.deepEqual([...b.map.keys()], [STORAGE_KEY]);
  const s2 = createStore({ backend: b, now: () => t0 });
  assert.equal(s2.get().taktik.staerke, 1234);
});

test("Migration: Stand ohne Version (0) wird auf 1 gebracht und ergänzt", () => {
  const m = migrate({ taktik: { staerke: 1500 } }, { now: t0 });
  assert.equal(m.version, SCHEMA_VERSION);
  assert.equal(m.taktik.staerke, 1500);
  assert.deepEqual(m.taktik.versuche, []);
  validate(m);
});

test("Migration 1 auf 2: alte Sicherungsdatei bekommt neue Felder, nichts geht verloren", () => {
  const alt = {
    app: "schach-training", version: 1, erstelltAm: t0.toISOString(), letzterExport: null, einstellungen: {},
    taktik: { staerke: 1400, eingestuft: true, versuche: [{ id: "a" }, { id: "b" }], themen: { fork: { n: 1, ok: 1, ms: 1 } }, karten: {}, gesehen: { a: 1 }, sitzungen: [], verlauf: [], aktiv: null },
  };
  const m = migrate(structuredClone(alt), { now: t0 });
  assert.equal(m.version, SCHEMA_VERSION);
  assert.deepEqual(m.taktik.standort, []);
  assert.equal(m.taktik.anzahl, 2);
  assert.equal(m.taktik.staerke, 1400);
  assert.deepEqual(m.taktik.themen, alt.taktik.themen);
  validate(m);
  const s = createStore({ backend: backend(), now: () => t0 });
  s.importJson(JSON.stringify(alt));
  assert.equal(s.get().version, SCHEMA_VERSION);
});

test("Migration 2 auf 3: bisheriger Stand behält Dunkel, Einführung gilt als gesehen", () => {
  const v2 = defaults(t0);
  v2.version = 2;
  v2.einstellungen = {};
  v2.taktik.staerke = 1450;
  const m = migrate(structuredClone(v2), { now: t0 });
  assert.equal(m.version, SCHEMA_VERSION);
  assert.equal(m.einstellungen.brettDesign, "dunkel");
  assert.equal(m.einstellungen.einfuehrungGesehen, true);
  assert.equal(m.taktik.staerke, 1450);
  validate(m);
});

test("Migration 2 auf 3: schon gewählte Werte bleiben erhalten", () => {
  const v2 = defaults(t0);
  v2.version = 2;
  v2.einstellungen = { brettDesign: "gruen", einfuehrungGesehen: false };
  const m = migrate(structuredClone(v2), { now: t0 });
  assert.deepEqual(m.einstellungen, { brettDesign: "gruen", einfuehrungGesehen: false, denkhilfe: true, chesscomWertung: null });
});

test("Neue Nutzer: Design Klassisch, Einführung noch nicht gesehen", () => {
  const d = createStore({ backend: backend(), now: () => t0 }).get();
  assert.equal(d.version, SCHEMA_VERSION);
  assert.deepEqual(d.einstellungen, { brettDesign: "klassisch", einfuehrungGesehen: false, denkhilfe: true, chesscomWertung: null });
});

test("Alte Sicherungsdatei (Version 2) lässt sich importieren und bekommt Dunkel", () => {
  const s = createStore({ backend: backend(), now: () => t0 });
  const alt = defaults(t0);
  alt.version = 2;
  alt.einstellungen = {};
  s.importJson(JSON.stringify(alt));
  assert.equal(s.get().einstellungen.brettDesign, "dunkel");
  assert.equal(s.get().einstellungen.einfuehrungGesehen, true);
});

test("Gespeicherter Stand der Version 2 wird beim Laden umgestellt", () => {
  const alt = defaults(t0);
  alt.version = 2;
  alt.einstellungen = {};
  const b = backend({ [STORAGE_KEY]: JSON.stringify(alt) });
  const d = createStore({ backend: b, now: () => t0 }).get();
  assert.equal(d.version, SCHEMA_VERSION);
  assert.equal(d.einstellungen.brettDesign, "dunkel");
});

test("Migration: Kette über mehrere Versionen und Ablehnung neuerer Versionen", () => {
  const migrations = {
    0: (d) => ({ ...d, a: 1 }),
    1: (d) => ({ ...d, b: d.a + 1 }),
    2: (d) => ({ ...d, c: d.b + 1 }),
  };
  const out = migrate({ version: 0 }, { migrations, target: 3 });
  assert.deepEqual([out.a, out.b, out.c, out.version], [1, 2, 3, 3]);
  assert.throws(() => migrate({ version: 99 }), DataError);
  assert.throws(() => migrate({ version: -1 }), DataError);
  assert.throws(() => migrate([]), DataError);
});

test("Export, Löschen, Import ergibt denselben Stand", () => {
  const s = createStore({ backend: backend(), now: () => t0 });
  s.update((d) => {
    d.taktik.staerke = 1400;
    d.taktik.versuche.push({ id: "abc", ok: true, ms: 4000 });
    d.taktik.themen.fork = { n: 3, ok: 2, ms: 9000 };
    d.taktik.karten.abc = { stufe: 1, faellig: "2026-11-13" };
  });
  const json = s.exportJson();
  const before = structuredClone(s.get());
  s.reset();
  assert.equal(s.get().taktik.staerke, null);
  s.importJson(json);
  assert.deepEqual(s.get(), before);
});

test("Export setzt das Exportdatum", () => {
  let now = t0;
  const s = createStore({ backend: backend(), now: () => now });
  assert.equal(s.get().letzterExport, null);
  now = new Date(t0.getTime() + day);
  s.exportJson();
  assert.equal(s.get().letzterExport, now.toISOString());
});

test("Import weist falsche Dateien mit deutscher Meldung ab", () => {
  const s = createStore({ backend: backend(), now: () => t0 });
  s.update((d) => { d.taktik.staerke = 999; });
  for (const bad of ["kein json", "[]", '{"app":"anderes","version":1}', JSON.stringify({ ...defaults(t0), version: 99 })]) {
    assert.throws(() => s.importJson(bad), DataError, bad);
  }
  assert.equal(s.get().taktik.staerke, 999, "bestehende Daten bleiben bei Fehlern unverändert");
});

test("unlesbarer Speicherstand wird nicht still überschrieben", () => {
  const b = backend({ [STORAGE_KEY]: "{kaputt" });
  const s = createStore({ backend: b, now: () => t0 });
  assert.equal(s.get().taktik.staerke, null);
  assert.equal(s.status.recovered, true);
  assert.equal(b.map.get(STORAGE_KEY + ".defekt"), "{kaputt");
});

test("Speicherfehler (voll/gesperrt) wirft nicht, sondern setzt eine Meldung", () => {
  const b = backend();
  b.setItem = () => { throw new Error("Quota"); };
  const s = createStore({ backend: b, now: () => t0 });
  s.update((d) => { d.taktik.staerke = 1; });
  assert.match(s.status.error, /nicht gespeichert/);
});

test("Begrenzung: nur die letzten Einträge bleiben", () => {
  const d = defaults(t0);
  d.taktik.versuche = Array.from({ length: CAPS.versuche + 50 }, (_, i) => ({ i }));
  trim(d);
  assert.equal(d.taktik.versuche.length, CAPS.versuche);
  assert.equal(d.taktik.versuche[0].i, 50);
});

test("Export-Erinnerung nach 14 Tagen, nur wenn es etwas zu sichern gibt", () => {
  const d = defaults(t0);
  const later = new Date(t0.getTime() + 20 * day);
  assert.equal(exportReminderDue(d, later), false, "ohne Daten keine Erinnerung");
  d.taktik.versuche.push({ id: "x" });
  assert.equal(exportReminderDue(d, new Date(t0.getTime() + 13 * day)), false);
  assert.equal(exportReminderDue(d, new Date(t0.getTime() + 14 * day)), true);
  d.letzterExport = later.toISOString();
  assert.equal(exportReminderDue(d, new Date(later.getTime() + 5 * day)), false);
  assert.equal(exportReminderDue(d, new Date(later.getTime() + 14 * day)), true);
});

test("Erinnerung an die Standortbestimmung: nach 28 Tagen, nur wenn schon eine gemacht wurde", () => {
  const d = defaults(t0);
  assert.equal(standortReminderDue(d, new Date(t0.getTime() + 90 * day)), false, "ohne Ergebnis keine Erinnerung");
  d.taktik.standort.push({ datum: t0.toISOString(), geloest: 12, von: 20, msSchnitt: 30000 });
  assert.equal(standortReminderDue(d, new Date(t0.getTime() + 27 * day)), false);
  assert.equal(standortReminderDue(d, new Date(t0.getTime() + 28 * day)), true);
  d.taktik.standort.push({ datum: new Date(t0.getTime() + 30 * day).toISOString(), geloest: 14, von: 20, msSchnitt: 28000 });
  assert.equal(standortReminderDue(d, new Date(t0.getTime() + 40 * day)), false, "zählt ab dem letzten Ergebnis");
});

test("Migration 3 auf 4: bisherige Standortergebnisse gehören zum Prüfset Fortgeschritten, Denkhilfe an", () => {
  const v3 = defaults(t0);
  v3.version = 3;
  delete v3.einstellungen.denkhilfe;
  v3.taktik.standort = [
    { datum: "2026-10-01T10:00:00.000Z", geloest: 11, von: 20, msSchnitt: 30000, satz: "abcd1234" },
    { datum: "2026-11-01T10:00:00.000Z", geloest: 13, von: 20, msSchnitt: 28000, satz: "abcd1234" },
  ];
  v3.taktik.staerke = 1300;
  const m = migrate(structuredClone(v3), { now: t0 });
  assert.equal(m.version, SCHEMA_VERSION);
  assert.deepEqual(m.taktik.standort.map((e) => e.pruefset), ["fortgeschritten", "fortgeschritten"]);
  assert.equal(m.taktik.standort[1].geloest, 13, "Ergebnisse bleiben unverändert");
  assert.equal(m.einstellungen.denkhilfe, true);
  assert.equal(m.taktik.staerke, 1300);
  validate(m);
});

test("Migration 3 auf 4: schon gesetzte Werte bleiben, Prüfset wird nicht überschrieben", () => {
  const v3 = defaults(t0);
  v3.version = 3;
  v3.einstellungen.denkhilfe = false;
  v3.taktik.standort = [{ datum: "2026-11-01T10:00:00.000Z", geloest: 5, von: 20, msSchnitt: 1, satz: "x", pruefset: "einsteiger" }];
  const m = migrate(structuredClone(v3), { now: t0 });
  assert.equal(m.einstellungen.denkhilfe, false);
  assert.equal(m.taktik.standort[0].pruefset, "einsteiger");
});

test("Prüfung: Ergebnis mit unbekanntem Prüfset und falsche Denkhilfe-Angabe werden abgelehnt", () => {
  const d = defaults(t0);
  d.taktik.standort = [{ datum: "2026-11-01T10:00:00.000Z", geloest: 5, von: 20, msSchnitt: 1, satz: "x", pruefset: "unbekannt" }];
  assert.throws(() => validate(d), DataError);
  const e = defaults(t0);
  e.einstellungen.denkhilfe = "ja";
  assert.throws(() => validate(e), DataError);
});

test("Erinnerung nach 4 Wochen nennt das Prüfset des letzten Ergebnisses", () => {
  const d = defaults(t0);
  d.taktik.standort = [
    { datum: "2026-09-01T10:00:00.000Z", geloest: 5, von: 20, msSchnitt: 1, satz: "x", pruefset: "fortgeschritten" },
    { datum: "2026-10-01T10:00:00.000Z", geloest: 6, von: 20, msSchnitt: 1, satz: "y", pruefset: "einsteiger" },
  ];
  assert.equal(standortReminder(d, new Date("2026-10-28T09:00:00.000Z")), null, "27 Tage: keine Erinnerung");
  assert.deepEqual(standortReminder(d, new Date("2026-10-29T10:00:00.000Z")), { pruefset: "einsteiger" });
  d.taktik.standort.push({ datum: "2026-10-20T10:00:00.000Z", geloest: 7, von: 20, msSchnitt: 1, satz: "x", pruefset: "fortgeschritten" });
  assert.equal(standortReminder(d, new Date("2026-10-29T10:00:00.000Z")), null, "zählt ab dem letzten Ergebnis");
  assert.deepEqual(standortReminder(d, new Date("2026-11-17T10:00:00.000Z")), { pruefset: "fortgeschritten" });
});

test("Migration 4 auf 5: Bereich spielen und Wertung kommen dazu, alles Bisherige bleibt", () => {
  const v4 = defaults(t0);
  v4.version = 4;
  delete v4.spielen;
  delete v4.einstellungen.chesscomWertung;
  v4.taktik.staerke = 777;
  v4.taktik.standort = [{ datum: "2026-11-01T10:00:00.000Z", geloest: 5, von: 20, msSchnitt: 1, satz: "x", pruefset: "einsteiger" }];
  const m = migrate(structuredClone(v4), { now: t0 });
  assert.equal(m.version, 5);
  assert.deepEqual(m.spielen, { partien: [], versuche: [], aktiv: null, gestartet: 0 });
  assert.equal(m.einstellungen.chesscomWertung, null);
  assert.equal(m.taktik.staerke, 777);
  assert.equal(m.taktik.standort[0].pruefset, "einsteiger");
  validate(m);
});

test("Alte Sicherungsdatei (Version 4) lässt sich importieren", () => {
  const s = createStore({ backend: backend(), now: () => t0 });
  const alt = defaults(t0);
  alt.version = 4;
  delete alt.spielen;
  delete alt.einstellungen.chesscomWertung;
  s.importJson(JSON.stringify(alt));
  assert.equal(s.get().version, SCHEMA_VERSION);
  assert.deepEqual(s.get().spielen.partien, []);
});

test("Prüfung: kaputte Partien-Daten werden abgelehnt", () => {
  const a = defaults(t0);
  a.spielen.partien = "x";
  assert.throws(() => validate(a), DataError);
  const b = defaults(t0);
  b.spielen.aktiv = { zuege: "nein" };
  assert.throws(() => validate(b), DataError);
  const c = defaults(t0);
  c.einstellungen.chesscomWertung = "440";
  assert.throws(() => validate(c), DataError);
  const d = defaults(t0);
  delete d.spielen;
  assert.throws(() => validate(d), DataError);
});

test("Obergrenzen: 30 Partien und 100 Versuche, Export und Import nehmen alles mit", () => {
  const s = createStore({ backend: backend(), now: () => t0 });
  const pgn = "[Event \"Training\"]\n\n" + Array.from({ length: 60 }, (_, i) => `${i + 1}. e4 e5`).join(" ");
  s.update((d) => {
    for (let i = 0; i < 45; i++) d.spielen.partien.push({ id: "p" + i, pgn });
    for (let i = 0; i < 130; i++) d.spielen.versuche.push({ id: "v" + i, pgn });
    d.spielen.aktiv = { zuege: ["e2e4"] };
  });
  const d = s.get();
  assert.equal(d.spielen.partien.length, 30);
  assert.equal(d.spielen.partien[0].id, "p15", "die ältesten werden verworfen");
  assert.equal(d.spielen.versuche.length, 100);
  assert.equal(d.spielen.versuche[99].id, "v129");
  const json = s.exportJson();
  const s2 = createStore({ backend: backend(), now: () => t0 });
  s2.importJson(json);
  assert.equal(s2.get().spielen.partien.length, 30);
  assert.equal(s2.get().spielen.versuche.length, 100);
  assert.deepEqual(s2.get().spielen.aktiv, { zuege: ["e2e4"] });
  assert.ok(json.length < 500000, "weit unter der Speichergrenze (etwa 5 MB): " + json.length);
});
