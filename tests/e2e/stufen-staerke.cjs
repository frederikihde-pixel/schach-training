// Messung der Stärkestufen mit der echten Engine: alle Stufen (Nachbarn gegeneinander) und ein Zufallsspieler spielen gegeneinander.
// Lang (einige Minuten). Schreibt die Zahlen nach tests/stufen-messung.json und gibt sie aus.
// Aufruf: node tests/e2e/stufen-staerke.cjs [Partien je Paarung, Standard 6]
const fs = require("fs");
const path = require("path");
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

const PER = Number(process.argv[2] || 6);
const MAX_PLIES = 120;
const SPIELER = process.env.SPIELER ? process.env.SPIELER.split(",") : ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "Zufall"];
const PAARE = process.env.PAARE ? JSON.parse(process.env.PAARE) : [["S1", "S3"], ["S1", "S8"], ["S3", "S8"], ["S1", "Zufall"], ["S3", "Zufall"], ["S8", "Zufall"], ["S2", "S1"], ["S2", "S3"], ["S2", "Zufall"], ["S3", "S4"], ["S4", "S5"], ["S5", "S6"], ["S6", "S7"], ["S7", "S8"]];

async function playGames(page, jobs) {
  return page.evaluate(
    async ({ jobs, MAX_PLIES }) => {
      const { getEngine, uciMove } = await import("./js/engine.js");
      const { spieleZug } = await import("./js/stufen.js");
      const { gefaehrdeteFiguren, wertSumme, WERT } = await import("./js/material.js");
      const { Chess } = await import("./vendor/chess.js/chess.js");
      const engine = getEngine();
      function rngFrom(seed) {
        let a = seed >>> 0;
        return () => {
          a = (a + 0x6d2b79f5) >>> 0;
          let t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      const out = [];
      for (const job of jobs) {
        const rng = rngFrom(job.seed);
        const chess = new Chess();
        const moves = [];
        const stat = { w: { zuege: 0, hing: 0, mattVerpasst: 0, mattChance: 0, verloren: 0 }, b: { zuege: 0, hing: 0, mattVerpasst: 0, mattChance: 0, verloren: 0 } };
        await engine.newGame();
        let ende = null;
        while (!chess.isGameOver() && moves.length < MAX_PLIES) {
          const side = chess.turn();
          const name = side === "w" ? job.w : job.b;
          const verbose = chess.moves({ verbose: true });
          const legal = verbose.map(uciMove);
          let zug;
          if (name === "Zufall") zug = legal[Math.floor(rng() * legal.length)];
          else {
            const r = await spieleZug(engine, Number(name.slice(1)), { fen: "startpos", moves, legal }, rng);
            zug = r.zug;
          }
          const m = verbose[legal.indexOf(zug)];
          // Matt in 1 verpasst?
          const matt = verbose.filter((v) => v.san.endsWith("#"));
          if (matt.length) {
            stat[side].mattChance++;
            if (!m.san.endsWith("#")) stat[side].mattVerpasst++;
          }
          chess.move({ from: m.from, to: m.to, promotion: m.promotion });
          moves.push(zug);
          stat[side].zuege++;
          if (m.captured) stat[m.color === "w" ? "b" : "w"].verloren += WERT[m.captured];
          // Steht nach dem eigenen Zug eine Figur (Springer oder mehr) ungedeckt im Angriff?
          if (!chess.isGameOver() && gefaehrdeteFiguren(chess, side, { ohneBauern: true }).some((f) => f.grund === "ungedeckt")) stat[side].hing++;
        }
        const diff = wertSumme(chess, "w") - wertSumme(chess, "b");
        let ergebnis;
        if (chess.isCheckmate()) {
          ergebnis = chess.turn() === "w" ? "0-1" : "1-0";
          ende = "Matt";
        } else if (chess.isGameOver()) {
          ergebnis = "1/2-1/2";
          ende = "Remis";
        } else {
          ergebnis = diff >= 3 ? "1-0" : diff <= -3 ? "0-1" : "1/2-1/2";
          ende = "Wertung nach Material";
        }
        out.push({ w: job.w, b: job.b, ergebnis, ende, plies: moves.length, diff, stat });
      }
      return out;
    },
    { jobs, MAX_PLIES },
  );
}

(async () => {
  const r = reporter("Stärkestufen");
  const { server, url } = await startServer();
  const browser = await launch();
  const jobs = [];
  let seed = 1000;
  for (const [a, b] of PAARE) for (let i = 0; i < PER; i++) jobs.push(i % 2 === 0 ? { w: a, b, seed: seed++ } : { w: b, b: a, seed: seed++ });
  const workers = 4;
  const lists = Array.from({ length: workers }, () => []);
  jobs.forEach((j, i) => lists[i % workers].push(j));
  const t0 = Date.now();
  const results = (
    await Promise.all(
      lists.map(async (list) => {
        const { page } = await newPage(browser);
        await page.goto(url + "index.html");
        const res = await playGames(page, list);
        await page.close();
        return res;
      }),
    )
  ).flat();
  const minuten = ((Date.now() - t0) / 60000).toFixed(1);

  // Auswertung je Spieler gegen jeden Gegner
  const table = {};
  const agg = {};
  for (const g of results) {
    const key = `${g.w} gegen ${g.b}`;
    table[key] = table[key] || { weiss: 0, remis: 0, schwarz: 0, partien: 0, zuege: 0 };
    table[key].partien++;
    table[key].zuege += g.plies;
    if (g.ergebnis === "1-0") table[key].weiss++;
    else if (g.ergebnis === "0-1") table[key].schwarz++;
    else table[key].remis++;
    for (const [side, name] of [["w", g.w], ["b", g.b]]) {
      const s = g.stat[side];
      agg[name] = agg[name] || { zuege: 0, hing: 0, mattChance: 0, mattVerpasst: 0, verloren: 0, partien: 0 };
      for (const k of ["zuege", "hing", "mattChance", "mattVerpasst", "verloren"]) agg[name][k] += s[k];
      agg[name].partien++;
    }
  }
  const punkte = (name, gegner) => {
    let p = 0;
    let n = 0;
    for (const g of results) {
      if (!((g.w === name && g.b === gegner) || (g.b === name && g.w === gegner))) continue;
      n++;
      const wins = g.ergebnis === "1-0" ? "w" : g.ergebnis === "0-1" ? "b" : null;
      const me = g.w === name ? "w" : "b";
      p += wins === me ? 1 : wins === null ? 0.5 : 0;
    }
    return { punkte: p, partien: n };
  };
  console.log(`\n${results.length} Partien in ${minuten} Minuten (höchstens ${MAX_PLIES} Halbzüge, danach Wertung nach Material)\n`);
  for (const [k, v] of Object.entries(table)) console.log(`${k}: ${v.weiss} Siege Weiß, ${v.remis} Remis, ${v.schwarz} Siege Schwarz (Ø ${(v.zuege / v.partien).toFixed(0)} Halbzüge)`);
  console.log("\nSpieler | Zügeanzahl | Figur ungedeckt angegriffen nach eigenem Zug (Anteil) | Matt in 1 verpasst | Ø verlorenes Material je Partie");
  for (const name of SPIELER) {
    const a = agg[name];
    console.log(`${name} | ${a.zuege} | ${((100 * a.hing) / a.zuege).toFixed(1)} % | ${a.mattVerpasst} von ${a.mattChance} | ${(a.verloren / a.partien).toFixed(1)}`);
  }
  const summary = { stufenversion: 1, partienJePaarung: PER, maxHalbzuege: MAX_PLIES, minuten: Number(minuten), paarungen: table, spieler: agg, ergebnisse: results.map((g) => ({ w: g.w, b: g.b, e: g.ergebnis, ende: g.ende, plies: g.plies, diff: g.diff })) };
  fs.writeFileSync(path.join(__dirname, "../stufen-messung.json"), JSON.stringify(summary, null, 1));

  const a = agg;
  if (process.env.PAARE) {
    await browser.close();
    server.close();
    return;
  }
  r.check("Stufe 8 schlägt Stufe 1 (mehr Punkte)", punkte("S8", "S1").punkte > punkte("S1", "S8").punkte, JSON.stringify(punkte("S8", "S1")));
  r.check("Stufe 8 schlägt Stufe 3 (mehr Punkte)", punkte("S8", "S3").punkte > punkte("S3", "S8").punkte, JSON.stringify(punkte("S8", "S3")));
  r.check("Stufe 3 schlägt Stufe 1 (mehr Punkte)", punkte("S3", "S1").punkte > punkte("S1", "S3").punkte, JSON.stringify(punkte("S3", "S1")));
  r.check("Stufe 1 verliert Material, das Stufe 8 nicht verliert (gegen Stufe 8 und Zufall zusammen)", a.S1.verloren / a.S1.partien > a.S8.verloren / a.S8.partien, `${(a.S1.verloren / a.S1.partien).toFixed(1)} gegen ${(a.S8.verloren / a.S8.partien).toFixed(1)}`);
  r.check("Stufe 1 stellt mindestens 1,3-mal so oft Figuren ein wie Stufe 8", a.S1.hing / a.S1.zuege > 1.3 * (a.S8.hing / a.S8.zuege), `${((100 * a.S1.hing) / a.S1.zuege).toFixed(1)} % gegen ${((100 * a.S8.hing) / a.S8.zuege).toFixed(1)} %`);
  r.check("Stufe 8 gewinnt gegen den Zufallsspieler immer", punkte("S8", "Zufall").punkte === punkte("S8", "Zufall").partien);
  r.check("Stufe 1 übersieht Matt in 1 öfter als Stufe 8", a.S1.mattChance === 0 || a.S1.mattVerpasst / Math.max(1, a.S1.mattChance) > a.S8.mattVerpasst / Math.max(1, a.S8.mattChance), `${a.S1.mattVerpasst}/${a.S1.mattChance} gegen ${a.S8.mattVerpasst}/${a.S8.mattChance}`);
  await browser.close();
  server.close();
  r.done();
})();
