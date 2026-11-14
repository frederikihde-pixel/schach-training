// Kontrast der Brett-Designs, berechnet (nicht geschätzt). Start: node --test tests/unit/kontrast.test.mjs
// Maß: Verhältnis der relativen Luminanz (WCAG): (hellere + 0,05) / (dunklere + 0,05).
// Figuren: schwarz #000 und weiß #fff (die Umrandung der Cburnett-Figuren ist zusätzlich schwarz).
import test from "node:test";
import assert from "node:assert/strict";
import { DESIGNS, DESIGN_IDS } from "../../js/board-designs.js";

const toRgb = (c) => {
  if (Array.isArray(c)) return c.slice(0, 3);
  const n = parseInt(c.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const lin = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => {
  const [hi, lo] = [lum(toRgb(a)), lum(toRgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// Überlagerung mit Alpha im sRGB-Raum, wie ein Browser es zeichnet.
const over = ([r, g, b, a], square) => {
  const s = toRgb(square);
  return [r, g, b].map((v, i) => Math.round(a * v + (1 - a) * s[i]));
};

const SCHWARZ = "#000000";
const WEISS = "#ffffff";
const f2 = (x) => x.toFixed(2).padStart(5);

function werte(d) {
  const felder = { hell: d.hell, dunkel: d.dunkel };
  const rows = [];
  for (const [fn, feld] of Object.entries(felder)) {
    rows.push({ was: `Feld ${fn} ${feld}`, wert: lum(toRgb(feld)).toFixed(3) + " (Luminanz)" });
    rows.push({ was: `  schwarze Figur auf ${fn}`, wert: ratio(SCHWARZ, feld) });
    rows.push({ was: `  weiße Figur auf ${fn}`, wert: ratio(WEISS, feld) });
    rows.push({ was: `  Zielpunkt, Ring, Schach-Rahmen auf ${fn}`, wert: ratio(d.zeichen, feld) });
    rows.push({ was: `  Koordinaten auf ${fn}`, wert: ratio(d.koordinaten, feld) });
    for (const name of ["letzter", "gewaehlt", "schach"]) {
      const c = over(d[name], feld);
      rows.push({ was: `  ${name} gegen normales Feld ${fn}`, wert: ratio(c, feld) });
      rows.push({ was: `    schwarze Figur auf ${name}-Feld (${fn})`, wert: ratio(SCHWARZ, c) });
      rows.push({ was: `    weiße Figur auf ${name}-Feld (${fn})`, wert: ratio(WEISS, c) });
    }
  }
  return rows;
}

test("alle Werte ausgeben", () => {
  for (const id of DESIGN_IDS) {
    console.log(`\n=== Design ${DESIGNS[id].name} ===`);
    for (const r of werte(DESIGNS[id])) console.log(`${r.was.padEnd(46)} ${typeof r.wert === "number" ? f2(r.wert) + " : 1" : r.wert}`);
  }
});

const feldFarben = (d) => [d.hell, d.dunkel];

test("Dunkel: schwarze und weiße Figuren auf BEIDEN Feldfarben mindestens 3:1", () => {
  const d = DESIGNS.dunkel;
  for (const feld of feldFarben(d)) {
    assert.ok(ratio(SCHWARZ, feld) >= 3, `schwarz auf ${feld}: ${ratio(SCHWARZ, feld)}`);
    assert.ok(ratio(WEISS, feld) >= 3, `weiß auf ${feld}: ${ratio(WEISS, feld)}`);
  }
});

test("Dunkel: Zielpunkt, Ring, Schach-Rahmen und Koordinaten mindestens 3:1 auf beiden Feldern", () => {
  const d = DESIGNS.dunkel;
  for (const feld of feldFarben(d)) {
    assert.ok(ratio(d.zeichen, feld) >= 3, `Zeichen auf ${feld}: ${ratio(d.zeichen, feld)}`);
    assert.ok(ratio(d.koordinaten, feld) >= 3, `Koordinaten auf ${feld}: ${ratio(d.koordinaten, feld)}`);
  }
});

test("Dunkel: markierte Felder heben sich ab (mindestens 1,3:1) und Figuren bleiben darauf mindestens 3:1", () => {
  const d = DESIGNS.dunkel;
  for (const feld of feldFarben(d)) {
    for (const name of ["letzter", "gewaehlt", "schach"]) {
      const c = over(d[name], feld);
      assert.ok(ratio(c, feld) >= 1.3, `${name} auf ${feld} gegen Feld: ${ratio(c, feld)}`);
      assert.ok(ratio(SCHWARZ, c) >= 3, `schwarz auf ${name}/${feld}: ${ratio(SCHWARZ, c)}`);
      assert.ok(ratio(WEISS, c) >= 3, `weiß auf ${name}/${feld}: ${ratio(WEISS, c)}`);
    }
  }
});

for (const id of ["klassisch", "gruen"]) {
  test(`${DESIGNS[id].name}: Zielpunkt, Ring und Schach-Rahmen mindestens 1,5:1 (Vorgabe) auf beiden Feldfarben, Ziel 3:1`, () => {
    const d = DESIGNS[id];
    for (const feld of feldFarben(d)) {
      const r = ratio(d.zeichen, feld);
      assert.ok(r >= 1.5, `Zeichen auf ${feld}: ${r}`);
      assert.ok(r >= 3, `Zeichen auf ${feld} unter dem eigenen Ziel 3:1: ${r}`);
    }
  });

  test(`${DESIGNS[id].name}: letzter Zug, gewähltes Feld und Schach heben sich mindestens 1,2:1 vom normalen Feld ab`, () => {
    const d = DESIGNS[id];
    for (const feld of feldFarben(d)) {
      for (const name of ["letzter", "gewaehlt", "schach"]) {
        const r = ratio(over(d[name], feld), feld);
        assert.ok(r >= 1.2, `${name} auf ${feld}: ${r}`);
      }
    }
  });
}

test("Alle Designs: schwarze Figuren auf beiden Feldfarben mindestens 3:1, weiße auf dem dunklen Feld mindestens 3:1", () => {
  for (const id of DESIGN_IDS) {
    const d = DESIGNS[id];
    for (const feld of feldFarben(d)) assert.ok(ratio(SCHWARZ, feld) >= 3, `${id}: schwarz auf ${feld}: ${ratio(SCHWARZ, feld)}`);
    assert.ok(ratio(WEISS, d.dunkel) >= 3, `${id}: weiß auf ${d.dunkel}: ${ratio(WEISS, d.dunkel)}`);
  }
});

test("Alle Designs: schwarze Figuren bleiben auf markierten Feldern mindestens 3:1 erkennbar", () => {
  for (const id of DESIGN_IDS) {
    const d = DESIGNS[id];
    for (const feld of feldFarben(d)) {
      for (const name of ["letzter", "gewaehlt", "schach"]) {
        const r = ratio(SCHWARZ, over(d[name], feld));
        assert.ok(r >= 3, `${id}: schwarz auf ${name}/${feld}: ${r}`);
      }
    }
  }
});
