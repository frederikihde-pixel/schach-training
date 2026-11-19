import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "../../vendor/chess.js/chess.js";
import { leseEingabe, stellungen, klassifiziere, bewerteZuege, erklaerung, sanDeutsch, phaseVon, analysiere, ergebnisVonSuche, SCHWELLEN, CAP, ANALYSE_VERSION } from "../../js/analyse.js";

const L = (u, cp, m = null, pv = null) => ({ u, cp, m, pv: pv || [u] });
const R = (i, lines, extra = {}) => ({ i, cp: lines[0] ? lines[0].cp : 0, mate: lines[0] ? lines[0].m : null, best: lines[0] && lines[0].u, lines, ...extra });

test("Schwellen: Patzer ab 300, Fehler 150 bis 299, darunter nichts, verpasste Chance wenn die Stellung danach nicht schlecht ist", () => {
  assert.equal(SCHWELLEN.patzer, 300);
  assert.equal(SCHWELLEN.fehler, 150);
  assert.equal(klassifiziere(149, 0), null);
  assert.equal(klassifiziere(150, 0), "fehler");
  assert.equal(klassifiziere(299, -500), "fehler");
  assert.equal(klassifiziere(300, -400), "patzer");
  assert.equal(klassifiziere(900, -900), "patzer");
  assert.equal(klassifiziere(300, 0), "chance");
  assert.equal(klassifiziere(900, 100), "chance");
  assert.equal(CAP, 1000);
});

test("Eingabe aus PGN und aus Zügen, mit Farbe; Fehler bei fehlender Farbe", () => {
  const a = leseEingabe({ pgn: "1. e4 e5 2. Nf3", farbe: "w" });
  assert.deepEqual(a.zuege, ["e2e4", "e7e5", "g1f3"]);
  const b = leseEingabe({ zuege: ["e2e4"], farbe: "b" });
  assert.equal(b.farbe, "b");
  assert.equal(stellungen(a).length, 4);
  assert.throws(() => leseEingabe({ zuege: [] }), RangeError);
  const c = leseEingabe({ pgn: '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/4K2R w K - 0 1"]\n\n1. Rh8+ Kd7', farbe: "w" });
  assert.equal(c.startFen, "4k3/8/8/8/8/8/8/4K2R w K - 0 1");
});

test("Deutsche Zugschreibweise", () => {
  assert.equal(sanDeutsch("Nf3"), "Sf3");
  assert.equal(sanDeutsch("Bxc6+"), "Lxc6+");
  assert.equal(sanDeutsch("Qd5"), "Dd5");
  assert.equal(sanDeutsch("Rae1"), "Tae1");
  assert.equal(sanDeutsch("e4"), "e4");
  assert.equal(sanDeutsch("O-O"), "O-O");
});

test("Spielphase: Eröffnung bis Zug 10, Endspiel bei höchstens 6 Figuren", () => {
  assert.equal(phaseVon(new Chess()), "eroeffnung");
  assert.equal(phaseVon(new Chess("r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P4/2N1PN2/PP1B1PPP/R2QKB1R w KQkq - 0 11")), "mittelspiel");
  assert.equal(phaseVon(new Chess("4k3/pp3ppp/8/8/8/8/PP3PPP/R3K2R w - - 0 30")), "endspiel");
});

test("Patzer mit erlaubtem Matt: Narrenmatt aus Sicht von Weiß", () => {
  const e = leseEingabe({ zuege: ["f2f3", "e7e5", "g2g4", "d8h4"], farbe: "w" });
  const erg = [
    R(0, [L("e2e4", 30), L("d2d4", 20), L("f2f3", -20)]),
    R(1, [L("e7e5", 30)]),
    R(2, [L("d2d4", -10), L("e2e4", -15), L("b1c3", -20)]),
    R(3, [L("d8h4", 1000, 1)]),
    { i: 4, ende: true, cp: -1000, mate: 0, best: null, lines: [] },
  ];
  const b = bewerteZuege(e, erg);
  assert.equal(b.zuege.length, 2);
  assert.equal(b.zuege[0].art, null, "1.f3 verliert nur 50");
  assert.equal(b.eintraege.length, 1);
  const x = b.eintraege[0];
  assert.equal(x.art, "patzer");
  assert.equal(x.ursache, "matt");
  assert.equal(x.nr, 2);
  assert.equal(x.phase, "eroeffnung");
  assert.ok(x.verlust >= 900);
  assert.equal(x.text, "Das erlaubte Matt in 1.");
  assert.equal(x.san, "g4");
  assert.equal(x.bestSan, "d4");
  assert.deepEqual(b.summe, { zuege: 2, patzer: 1, fehler: 0, chancen: 0, verlustSumme: b.zuege[0].verlust + b.zuege[1].verlust });
});

test("Patzer mit eingestellter Dame: ungedeckte Figur wird genannt", () => {
  const e = leseEingabe({ zuege: ["d2d5"], startFen: "4k3/8/1n6/8/8/8/3Q4/4K3 w - - 0 1", farbe: "w" });
  const erg = [R(0, [L("d2d3", 900), L("d2e3", 880)]), R(1, [L("b6d5", 800), L("e8d8", 0)])];
  const x = bewerteZuege(e, erg).eintraege[0];
  assert.equal(x.art, "patzer");
  assert.equal(x.ursache, "figur");
  assert.deepEqual(x.ungedeckt, { square: "d5", type: "q" });
  assert.equal(x.text, "Die Dame auf d5 war danach ungedeckt und konnte geschlagen werden.");
  assert.equal(x.verlust, 1700);
});

test("Verpasste Chance: freie Dame übersehen, Stellung danach ausgeglichen; Text mit besserem Zug", () => {
  const e = leseEingabe({ zuege: ["e1e2"], startFen: "4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1", farbe: "w" });
  const erg = [R(0, [L("d1d5", 900), L("e1e2", 0), L("e1f1", -10)]), R(1, [L("d5d1", 0)])];
  const x = bewerteZuege(e, erg).eintraege[0];
  assert.equal(x.art, "chance");
  assert.equal(x.ursache, "chance");
  assert.match(x.text, /Dieser Zug verlor etwa mehr als 9 Bauerneinheiten, besser war Zug Dxd5\./);
});

test("Verpasstes Matt: 'Hier gab es Matt in N'", () => {
  const e = leseEingabe({ zuege: ["a1a2"], startFen: "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", farbe: "w" });
  const erg = [R(0, [L("a1a8", 1000, 1), L("a1a2", 100), L("e1d1", 90)]), R(1, [L("g8f8", -100)])];
  const x = bewerteZuege(e, erg).eintraege[0];
  assert.equal(x.art, "chance");
  assert.equal(x.text, "Hier gab es Matt in 1.");
});

test("Fehler (150 bis 299): Erklärung mit Bauerneinheiten und besserem Zug; keine Anzeige unter 150", () => {
  const e = leseEingabe({ zuege: ["a2a3"], farbe: "w" });
  const mk = (cp) => [R(0, [L("e2e4", 100), L("d2d4", 90), L("a2a3", 100 - cp)]), R(1, [L("e7e5", -(100 - cp))])];
  assert.equal(bewerteZuege(e, mk(149)).eintraege.length, 0);
  const x = bewerteZuege(e, mk(200)).eintraege[0];
  assert.equal(x.art, "fehler");
  assert.equal(x.text, "Dieser Zug verlor etwa 2,0 Bauerneinheiten, besser war Zug e4.");
  assert.equal(bewerteZuege(e, mk(150)).eintraege[0].art, "fehler");
});

test("Bewertungen sind gedeckelt: in gewonnener Stellung keine Scheinfehler", () => {
  const e = leseEingabe({ zuege: ["a2a3"], farbe: "w" });
  // beide Züge gewinnen klar (gedeckelt auf 1000): Verlust 0
  const erg = [R(0, [L("e2e4", 1000), L("d2d4", 1000), L("a2a3", 1000)]), R(1, [L("e7e5", -1000)])];
  assert.equal(bewerteZuege(e, erg).eintraege.length, 0);
  const s = ergebnisVonSuche(0, { best: "e2e4", lines: [{ pv: ["e2e4", "e7e5"], score: { type: "cp", value: 5000 } }, { pv: ["d2d4"], score: { type: "mate", value: 3 } }] });
  assert.equal(s.cp, 1000);
  assert.equal(s.lines[1].cp, 1000);
  assert.equal(s.lines[1].m, 3);
});

test("Gedeckelter Verlust bei verlorener Stellung: -1000 gegen -1000 ist kein Fehler", () => {
  const e = leseEingabe({ zuege: ["a2a3"], farbe: "w" });
  const erg = [R(0, [L("e2e4", -1000), L("d2d4", -1000), L("a2a3", -1000)]), R(1, [L("e7e5", 1000)])];
  assert.equal(bewerteZuege(e, erg).eintraege.length, 0);
});

test("Drohung übersehen: schon ungedeckt angegriffene Figur bleibt hängen", () => {
  // Weißer Springer d5 wird vom Bauern c6 angegriffen (ungedeckt); Weiß zieht a2-a3 statt etwas zu tun.
  const e = leseEingabe({ zuege: ["a2a3"], startFen: "4k3/8/2p5/3N4/8/8/P7/4K3 w - - 0 1", farbe: "w" });
  const erg = [R(0, [L("d5b4", 100), L("d5f4", 100), L("a2a3", -300)]), R(1, [L("c6d5", 300)])];
  const x = bewerteZuege(e, erg).eintraege[0];
  assert.equal(x.ursache, "drohung");
  assert.match(x.text, /^Der Springer auf d5 war danach ungedeckt/);
});

test("Spieler Schwarz: nur Züge von Schwarz werden bewertet", () => {
  const e = leseEingabe({ zuege: ["e2e4", "e7e5", "g1f3"], farbe: "b" });
  const erg = [R(0, [L("e2e4", 30)]), R(1, [L("e7e5", 20), L("c7c5", 20), L("e7e6", 10)]), R(2, [L("g1f3", 30)]), R(3, [L("b8c6", 20)])];
  const b = bewerteZuege(e, erg);
  assert.equal(b.zuege.length, 1);
  assert.equal(b.zuege[0].ply, 1);
});

test("analysiere: eine Suche je Stellung, MultiPV 3 nur wenn der Spieler am Zug ist, Fortschritt, Fortsetzen, Abbruch", async () => {
  const e = leseEingabe({ zuege: ["e2e4", "e7e5", "g1f3"], farbe: "w" });
  const calls = [];
  const engine = {
    async search(q) {
      calls.push(q);
      return { best: "e2e4", lines: [{ pv: ["e2e4"], score: { type: "cp", value: 10 } }] };
    },
  };
  const fortschritt = [];
  const r = await analysiere(e, { engine, onPosition: (x, k, n) => fortschritt.push([k, n]) });
  assert.equal(r.fertig, true);
  assert.equal(r.ergebnisse.length, 4);
  assert.deepEqual(fortschritt, [[1, 4], [2, 4], [3, 4], [4, 4]]);
  assert.deepEqual(calls.map((c) => c.multipv), [3, 1, 3, 1]);
  assert.equal(calls[0].movetime, 300);
  assert.deepEqual(calls[0].options, { UCI_LimitStrength: false, "Skill Level": 20 });
  // Fortsetzen ab Stellung 2
  calls.length = 0;
  const r2 = await analysiere(e, { engine, start: 2, ergebnisse: r.ergebnisse.slice(0, 2) });
  assert.equal(calls.length, 2);
  assert.equal(r2.ergebnisse.length, 4);
  // Abbruch
  const abbruch = { stop: false };
  const r3 = await analysiere(e, { engine, abbruch, onPosition: (x, k) => { if (k === 2) abbruch.stop = true; } });
  assert.equal(r3.fertig, false);
  assert.equal(r3.ergebnisse.length, 2);
});

test("analysiere: Endstellung (Matt, Remis) wird ohne Suche bewertet", async () => {
  const e = leseEingabe({ zuege: ["f2f3", "e7e5", "g2g4", "d8h4"], farbe: "w" });
  let n = 0;
  const engine = { async search() { n++; return { best: "e2e4", lines: [{ pv: ["e2e4"], score: { type: "cp", value: 0 } }] }; } };
  const r = await analysiere(e, { engine });
  assert.equal(n, 4, "fünf Stellungen, die letzte (Matt) braucht keine Suche");
  assert.deepEqual([r.ergebnisse[4].ende, r.ergebnisse[4].cp, r.ergebnisse[4].mate], [true, -1000, 0]);
});

test("Analyse-Version", () => assert.equal(ANALYSE_VERSION, 1));
