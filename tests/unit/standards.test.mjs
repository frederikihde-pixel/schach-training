import test from "node:test";
import assert from "node:assert/strict";
import { defaults } from "../../js/storage.js";
import { warnungStandard, warnungIstAutomatisch, zuruecknahmeStandard, pruefsetStandard } from "../../js/standards.js";

const d0 = () => defaults(new Date("2026-11-23T10:00:00Z"));

test("Patzer-Warnung automatisch: an für die ersten 3 begonnenen Partien, danach aus", () => {
  const d = d0();
  assert.equal(warnungIstAutomatisch(d), true);
  assert.equal(warnungStandard(d), true);
  d.spielen.gestartet = 2;
  assert.equal(warnungStandard(d), true);
  d.spielen.gestartet = 3;
  assert.equal(warnungStandard(d), false);
});

test("Ausdrücklich gewählte Patzer-Warnung gilt immer", () => {
  const d = d0();
  d.spielen.gestartet = 10;
  d.einstellungen.patzerWarnung = true;
  assert.equal(warnungStandard(d), true);
  assert.equal(warnungIstAutomatisch(d), false);
  d.spielen.gestartet = 0;
  d.einstellungen.patzerWarnung = false;
  assert.equal(warnungStandard(d), false);
});

test("Zug zurücknehmen: Standard aus, aus den Einstellungen", () => {
  const d = d0();
  assert.equal(zuruecknahmeStandard(d), false);
  d.einstellungen.zuruecknahme = true;
  assert.equal(zuruecknahmeStandard(d), true);
});

test("Prüfset: automatisch nach Taktikstärke, sonst die Wahl", () => {
  const d = d0();
  assert.equal(pruefsetStandard(d), "einsteiger", "noch nicht eingestuft");
  d.taktik.eingestuft = true;
  d.taktik.staerke = 1200;
  assert.equal(pruefsetStandard(d), "fortgeschritten");
  d.einstellungen.pruefset = "einsteiger";
  assert.equal(pruefsetStandard(d), "einsteiger");
});
