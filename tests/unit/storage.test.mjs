// Start: node --test tests/unit
import test from "node:test";
import assert from "node:assert/strict";
import {
  createStore, defaults, migrate, validate, trim, exportReminderDue, standortReminderDue,
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
  assert.equal(m.version, 2);
  assert.deepEqual(m.taktik.standort, []);
  assert.equal(m.taktik.anzahl, 2);
  assert.equal(m.taktik.staerke, 1400);
  assert.deepEqual(m.taktik.themen, alt.taktik.themen);
  validate(m);
  const s = createStore({ backend: backend(), now: () => t0 });
  s.importJson(JSON.stringify(alt));
  assert.equal(s.get().version, 2);
});

test("Migration: Kette über mehrere Versionen und Ablehnung neuerer Versionen", () => {
  const migrations = {
    0: (d) => ({ ...d, a: 1 }),
    1: (d) => ({ ...d, b: d.a + 1 }),
    2: (d) => ({ ...d, c: d.b + 1 }),
  };
  const out = migrate({ version: 0 }, { migrations, target: 3 });
  assert.deepEqual([out.a, out.b, out.c, out.version], [1, 2, 3, 3]);
  assert.throws(() => migrate({ version: 5 }), DataError);
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
