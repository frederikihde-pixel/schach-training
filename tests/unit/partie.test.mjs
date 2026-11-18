import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "../../vendor/chess.js/chess.js";
import { neueAktive, stellung, ende, ausgang, endeText, kannZuruecknehmen, zuruecknehmen, spielerZuege, pgnVon, eintrag, START_FEN, legaleUci, zugAnwenden } from "../../js/partie.js";
import { GRUNDMATT, VORTEIL_ARTEN, vorteilStart, pruefeStellung } from "../../js/uebungen.js";
import { kandidaten, pruefeZug } from "../../js/warnung.js";
import { gefaehrdeteFiguren } from "../../js/material.js";

const t0 = new Date("2026-11-18T10:00:00Z");

test("neue Partie: Felder, Stufenversion, leere Zugliste", () => {
  const a = neueAktive({ modus: "partie", farbe: "w", stufe: 2, warnung: true, now: t0 });
  assert.equal(a.stufenversion, 1);
  assert.deepEqual(a.zuege, []);
  assert.equal(a.startFen, START_FEN);
  assert.equal(a.zuruecknahme, false);
  assert.equal(a.warnung, true);
});

test("Stellung aus Zugliste aufbauen; falscher Zug wirft", () => {
  const a = neueAktive({ modus: "partie", farbe: "w", stufe: 1, now: t0 });
  a.zuege = ["e2e4", "e7e5", "g1f3"];
  assert.equal(stellung(a).turn(), "b");
  a.zuege = ["e2e5"];
  assert.throws(() => stellung(a));
});

test("Spielende: Matt, Patt, Material, Wiederholung, 50 Züge, Aufgabe", () => {
  const a = neueAktive({ modus: "partie", farbe: "w", stufe: 1, now: t0 });
  a.zuege = ["f2f3", "e7e5", "g2g4", "d8h4"];
  const matt = ende(stellung(a), a);
  assert.deepEqual(matt, { ergebnis: "0-1", grund: "Matt" });
  assert.equal(ausgang(matt.ergebnis, "w"), "verloren");
  assert.equal(ausgang(matt.ergebnis, "b"), "gewonnen");
  assert.match(endeText(matt, "w"), /Computer hat gewonnen/);
  assert.equal(ende(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).grund, "Patt");
  assert.equal(ende(new Chess("8/8/8/8/8/8/8/K1k5 w - - 0 1")).grund, "Zu wenig Material");
  assert.equal(ende(new Chess("4k3/8/8/8/8/8/8/R3K3 w - - 100 80")).grund, "50-Züge-Regel");
  const c = new Chess();
  for (const m of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]) c.move(m);
  assert.equal(ende(c).grund, "Dreifache Wiederholung");
  assert.equal(ende(new Chess()), null);
  const b = neueAktive({ modus: "partie", farbe: "b", stufe: 1, now: t0 });
  b.aufgegeben = true;
  assert.deepEqual(ende(new Chess(), b), { ergebnis: "1-0", grund: "Aufgabe" });
});

test("Zug zurücknehmen nur wenn erlaubt, am Zug und nach eigenem Zug; nimmt zwei Halbzüge", () => {
  const a = neueAktive({ modus: "partie", farbe: "w", stufe: 1, zuruecknahme: false, now: t0 });
  a.zuege = ["e2e4", "e7e5"];
  assert.equal(kannZuruecknehmen(a, stellung(a)), false, "nicht erlaubt");
  a.zuruecknahme = true;
  assert.equal(kannZuruecknehmen(a, stellung(a)), true);
  a.zuege = ["e2e4"];
  assert.equal(kannZuruecknehmen(a, stellung(a)), false, "Computer ist am Zug");
  a.zuege = ["e2e4", "e7e5", "g1f3", "b8c6"];
  assert.equal(zuruecknehmen(a), true);
  assert.deepEqual(a.zuege, ["e2e4", "e7e5"]);
  assert.equal(a.zurueck, 1);
  assert.equal(zuruecknehmen(a), true);
  assert.deepEqual(a.zuege, []);
  assert.equal(zuruecknehmen(a), false, "nichts mehr zurückzunehmen");
  // Schwarz: Der Computer beginnt
  const s = neueAktive({ modus: "partie", farbe: "b", stufe: 1, zuruecknahme: true, now: t0 });
  s.zuege = ["e2e4"];
  assert.equal(kannZuruecknehmen(s, stellung(s)), false, "dein erster Zug fehlt noch");
  s.zuege = ["e2e4", "e7e5", "g1f3"];
  assert.equal(kannZuruecknehmen(s, stellung(s)), true);
  zuruecknehmen(s);
  assert.deepEqual(s.zuege, ["e2e4"]);
});

test("PGN mit Kopfzeilen, Ergebnis und Zügen; lässt sich mit chess.js laden", () => {
  const a = neueAktive({ modus: "partie", farbe: "b", stufe: 3, warnung: true, now: t0 });
  a.zuege = ["f2f3", "e7e5", "g2g4", "d8h4"];
  const e = ende(stellung(a), a);
  const pgn = pgnVon(a, e);
  assert.match(pgn, /\[Result "0-1"\]/);
  assert.match(pgn, /\[Black "Ich"\]/);
  assert.match(pgn, /\[White "Computer Stufe 3"\]/);
  assert.match(pgn, /\[Date "2026\.11\.18"\]/);
  assert.match(pgn, /Qh4# 0-1$/);
  const c = new Chess();
  c.loadPgn(pgn);
  assert.equal(c.history().length, 4);
  assert.equal(c.isCheckmate(), true);
});

test("Eintrag: alle geforderten Felder inklusive Stufenversion und Patzer-Warnung", () => {
  const a = neueAktive({ modus: "partie", farbe: "w", stufe: 4, warnung: true, zuruecknahme: false, now: t0 });
  a.zuege = ["f2f3", "e7e5", "g2g4", "d8h4"];
  a.warnungen = 2;
  a.trotzdem = 1;
  const e = eintrag(a, ende(stellung(a), a), { now: t0 });
  for (const k of ["id", "datum", "modus", "farbe", "stufe", "stufenversion", "ergebnis", "ausgang", "pgn", "warnung", "warnungen", "trotzdem"]) assert.ok(k in e, k);
  assert.equal(e.stufenversion, 1);
  assert.equal(e.ausgang, "verloren");
  assert.equal(e.warnung, true);
  assert.equal(e.warnungen, 2);
  assert.equal(e.trotzdem, 1);
  assert.equal(e.zuege, 2, "zwei eigene Züge");
  assert.equal(e.datum, t0.toISOString());
});

test("Grundmatts: je 10 Stellungen, gültig, Weiß am Zug, nicht Schach, nicht zu Ende, keine hängende Figur", () => {
  for (const [art, def] of Object.entries(GRUNDMATT)) {
    assert.equal(def.stellungen.length, 10, art);
    assert.equal(new Set(def.stellungen).size, 10, "alle verschieden");
    for (const fen in def.stellungen.map((f) => f)) void fen;
    for (const fen of def.stellungen) {
      const p = pruefeStellung(fen);
      assert.ok(p.weissAmZug, fen);
      assert.ok(!p.schwarzImSchach, `Schwarz steht im Schach: ${fen}`);
      assert.ok(!p.zuEnde, fen);
      const c = new Chess(fen);
      const stuecke = c.board().flat().filter(Boolean);
      assert.equal(stuecke.length, 3, `König, König und eine Figur: ${fen}`);
      assert.ok(stuecke.some((s) => s.type === (art === "dame" ? "q" : "r") && s.color === "w"), fen);
      assert.deepEqual(gefaehrdeteFiguren(new Chess(fen.replace(" w ", " b ")), "w"), [], `Figur hängt: ${fen}`);
    }
  }
  assert.equal(GRUNDMATT.dame.referenz, 10);
  assert.equal(GRUNDMATT.turm.referenz, 16);
});

test("Vorteil: Stellungen gültig, der Computer fehlt genau die gewählte Figur", () => {
  const zaehle = (fen, farbe, typ) => new Chess(fen).board().flat().filter((s) => s && s.color === farbe && s.type === typ).length;
  for (const art of Object.keys(VORTEIL_ARTEN)) {
    for (const spieler of ["w", "b"]) {
      const fen = vorteilStart(art, spieler);
      const c = new Chess(fen);
      assert.equal(c.turn(), "w");
      assert.equal(c.isGameOver(), false);
      const computer = spieler === "w" ? "b" : "w";
      const typ = { dame: "q", turm: "r", springer: "n" }[art];
      const soll = { q: 1, r: 2, n: 2 }[typ] - 1;
      assert.equal(zaehle(fen, computer, typ), soll, `${art} ${spieler}`);
      assert.equal(zaehle(fen, spieler, typ), { q: 1, r: 2, n: 2 }[typ]);
      assert.ok(legaleUci(c).length > 15);
    }
  }
  assert.equal(vorteilStart("dame", "w"), "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(vorteilStart("turm", "w"), "1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1");
  assert.equal(vorteilStart("springer", "b"), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1");
  assert.throws(() => vorteilStart("läufer", "w"), RangeError);
});

test("Patzer-Warnung: Matt in 1, freie Figur, gedeckte Figur und Bauern warnen nicht", async () => {
  // Weiß zieht f2-f3?? Schwarz hat Dh4 matt: Stellung nach 1.f3 e5 2.g4
  const matt = new Chess("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
  void matt;
  const nachG4 = new Chess();
  for (const m of ["f3", "e5", "g4"]) nachG4.move(m);
  const k = kandidaten(nachG4);
  assert.deepEqual(k.matt, ["d8h4"]);
  const r = await pruefeZug(nachG4, null);
  assert.deepEqual([r.warnen, r.art], [true, "matt"]);
  // Dame wird ungedeckt eingestellt: Weiß zieht Dd1-d5?? Läufer c8 ... Stellung: schwarzer Springer schlägt
  const frei = new Chess("4k3/8/1n6/3Q4/8/8/8/4K3 b - - 0 1");
  assert.equal(kandidaten(frei).frei.length, 1);
  assert.equal(kandidaten(frei).frei[0].type, "q");
  const rf = await pruefeZug(frei, null);
  assert.deepEqual([rf.warnen, rf.art], [true, "figur"]);
  assert.match(rf.text, /etwas schlagen/);
  // gedeckte Figur: Dame auf d5 durch Turm d1 gedeckt -> Gegner Springer schlägt Dame, Weiß schlägt zurück: Dame gegen Springer ist KEINE freie Figur
  const gedeckt = new Chess("4k3/8/1n6/3Q4/8/8/8/3RK3 b - - 0 1");
  assert.equal(kandidaten(gedeckt).frei.length, 0, "es gibt eine Rückschlagmöglichkeit");
  assert.equal((await pruefeZug(gedeckt, null)).warnen, false);
  // Bauer frei: keine Warnung (nur ab Springer)
  const bauer = new Chess("4k3/8/1n6/3P4/8/8/8/4K3 b - - 0 1");
  assert.equal((await pruefeZug(bauer, null)).warnen, false);
});

test("Patzer-Warnung: Engine bestätigt oder entkräftet eine freie Figur", async () => {
  const frei = new Chess("4k3/8/1n6/3Q4/8/8/8/4K3 b - - 0 1");
  const calls = [];
  const ja = { async setOptions() {}, async search(q) { calls.push(q); return { best: "b6d5", lines: [{ score: { type: "cp", value: 800 } }] }; } };
  assert.equal((await pruefeZug(frei, ja)).warnen, true);
  assert.equal(calls[0].movetime, 150);
  const nein = { async setOptions() {}, async search() { return { best: "e8d8", lines: [{ score: { type: "cp", value: 10 } }] }; } };
  assert.equal((await pruefeZug(frei, nein)).warnen, false, "Engine sieht keinen Gewinn für den Gegner");
  const kaputt = { async setOptions() { throw new Error("weg"); }, async search() {} };
  assert.equal((await pruefeZug(frei, kaputt)).warnen, true, "ohne Engine gilt die genaue Prüfung");
});

test("spielerZuege zählt nur die Züge des Spielers", () => {
  const w = neueAktive({ modus: "partie", farbe: "w", stufe: 1, now: t0 });
  w.zuege = ["e2e4", "e7e5", "g1f3"];
  assert.equal(spielerZuege(w), 2);
  const b = neueAktive({ modus: "partie", farbe: "b", stufe: 1, now: t0 });
  b.zuege = ["e2e4", "e7e5", "g1f3"];
  assert.equal(spielerZuege(b), 1);
  void zugAnwenden;
});
