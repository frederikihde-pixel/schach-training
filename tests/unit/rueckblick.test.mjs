import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/storage.js";
import { createRueckblick } from "../../js/rueckblick.js";

const t0 = new Date("2026-11-19T10:00:00Z");
const memory = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { persistent: true, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), m };
};
const fakeEngine = (opts = {}) => {
  const calls = [];
  return {
    calls,
    stopped: 0,
    stop() { this.stopped++; },
    async search(q) {
      calls.push(q);
      if (opts.failAt !== undefined && calls.length === opts.failAt) throw new Error("Engine weg");
      if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
      return { best: "e2e4", lines: [{ pv: ["e2e4"], score: { type: "cp", value: 10 } }] };
    },
  };
};
const spiel = { id: "g1", farbe: "w", zuege: ["e2e4", "e7e5", "g1f3", "b8c6"] };

test("Analyse läuft durch, speichert das Ergebnis und räumt den Laufstand auf", async () => {
  const store = createStore({ backend: memory(), now: () => t0 });
  const engine = fakeEngine();
  const rb = createRueckblick({ store, getEngine: () => engine });
  const ereignisse = [];
  rb.auf((e) => ereignisse.push(e.typ + (e.fertig ? ":" + e.fertig + "/" + e.gesamt : "")));
  assert.equal(rb.starte(spiel), "gestartet");
  await rb.warteBisFertig();
  const e = rb.eintrag("g1");
  assert.ok(e && e.version === 1 && e.farbe === "w" && e.zuege.length === 2);
  assert.equal(store.get().spielen.analyseLauf, null);
  assert.equal(engine.calls.length, 5);
  assert.ok(ereignisse.includes("fortschritt:3/5") && ereignisse.at(-1) === "fertig");
  assert.equal(rb.starte(spiel), "fertig", "schon analysiert");
  assert.equal(rb.status(), null);
});

test("Fortschritt wird nach jeder Stellung gespeichert und nach 'Neuladen' (neuer Store, gleicher Speicher) fortgesetzt", async () => {
  const mem = memory();
  const store1 = createStore({ backend: mem, now: () => t0 });
  const engine1 = fakeEngine({ failAt: 3 });
  const rb1 = createRueckblick({ store: store1, getEngine: () => engine1 });
  rb1.starte(spiel);
  await rb1.warteBisFertig();
  const st = rb1.status();
  assert.equal(st.fertig, 2, "zwei Stellungen waren fertig, die dritte schlug fehl");
  assert.equal(st.fehler, "Engine weg");
  assert.equal(st.laeuft, false);
  // Neuladen: neuer Store liest denselben Speicher
  const store2 = createStore({ backend: mem, now: () => t0 });
  const engine2 = fakeEngine();
  const rb2 = createRueckblick({ store: store2, getEngine: () => engine2 });
  assert.equal(rb2.status().fertig, 2);
  rb2.fortsetzen();
  await rb2.warteBisFertig();
  assert.equal(engine2.calls.length, 3, "nur die restlichen drei Stellungen");
  assert.ok(rb2.eintrag("g1"));
  assert.equal(rb2.status(), null);
});

test("Eine andere Analyse wird nicht gestartet, solange eine läuft; Abbrechen verwirft", async () => {
  const store = createStore({ backend: memory(), now: () => t0 });
  const engine = fakeEngine({ delay: 20 });
  const rb = createRueckblick({ store, getEngine: () => engine });
  rb.starte(spiel);
  assert.equal(rb.starte({ ...spiel, id: "g2" }), "andere");
  assert.equal(rb.starte(spiel), "laeuft");
  await new Promise((r) => setTimeout(r, 30));
  rb.abbrechen();
  await rb.warteBisFertig();
  assert.equal(store.get().spielen.analyseLauf, null);
  assert.equal(rb.eintrag("g1"), null);
  assert.ok(engine.stopped >= 1);
});

test("Die Obergrenze von 50 Analysen gilt", async () => {
  const store = createStore({ backend: memory(), now: () => t0 });
  const rb = createRueckblick({ store, getEngine: () => fakeEngine() });
  for (let i = 0; i < 52; i++) {
    rb.starte({ ...spiel, id: "g" + i });
    await rb.warteBisFertig();
  }
  assert.equal(store.get().spielen.analysen.length, 50);
  assert.equal(store.get().spielen.analysen[0].id, "g2");
});
