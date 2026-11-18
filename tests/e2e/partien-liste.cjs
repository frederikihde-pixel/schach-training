// Meine Partien: Liste, Im Brett ansehen, PGN kopieren, PGN im Brett laden, Obergrenzen, Export und Import.
const fs = require("fs");
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

async function seedPartien(page, anzahl, versuche) {
  await page.evaluate(async ({ anzahl, versuche }) => {
    const { store } = await import("./js/storage.js");
    const { neueAktive, ende, eintrag, stellung } = await import("./js/partie.js");
    const mk = (modus, farbe, stufe, zuege, extra = {}, aufgegeben = false) => {
      const a = neueAktive({ modus, farbe, stufe, warnung: modus === "partie", ...(extra.startFen ? { startFen: extra.startFen } : {}), extra: extra.extra || {} });
      a.zuege = zuege;
      a.aufgegeben = aufgegeben;
      a.warnungen = 1;
      a.trotzdem = 0;
      const e = ende(stellung(a), a);
      return eintrag(a, e, { now: new Date("2026-11-1" + (store.get().spielen.partien.length % 9) + "T18:30:00Z") });
    };
    store.update((d) => {
      for (let i = 0; i < anzahl; i++) {
        const e = mk("partie", i % 2 ? "b" : "w", 1 + (i % 3), ["f2f3", "e7e5", "g2g4", "d8h4"]);
        e.id = "p" + i;
        d.spielen.partien.push(e);
      }
      for (let i = 0; i < versuche; i++) {
        const e = mk("vorteil", "w", 2, ["e2e4", "e7e5"], { extra: { art: "dame" }, startFen: "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }, true);
        e.id = "v" + i;
        d.spielen.versuche.push(e);
      }
    });
  }, { anzahl, versuche });
}

(async () => {
  const r = reporter("Meine Partien");
  const { server, url } = await startServer();
  const browser = await launch();
  const { context, page } = await newPage(browser, { acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  await page.goto(url + "index.html#/spielen/liste");
  r.check("Leer: ruhige Hinweise statt leerer Liste", /Noch keine Partie gespeichert/.test(await page.textContent("#liste-partien")) && /Noch keine Übung/.test(await page.textContent("#liste-versuche")));

  await seedPartien(page, 3, 2);
  await page.goto(url + "index.html#/spielen/start");
  await page.goto(url + "index.html#/spielen/liste");
  await page.reload();
  r.check("Liste zeigt 3 Partien und 2 Übungen", (await page.locator("#liste-partien .game-item").count()) === 3 && (await page.locator("#liste-versuche .game-item").count()) === 2);
  r.check("Eintrag nennt Stufe, Farbe, Ausgang, Grund, Datum, Züge", /Stufe 3.*Weiß|Stufe 2.*Schwarz|Stufe 1.*Weiß/.test(await page.textContent("#liste-partien")) && /verloren|gewonnen/.test(await page.textContent("#liste-partien .game-item")) && /2026|\d{2}\.\d{2}\./.test(await page.textContent("#liste-partien .game-item")));
  const knoepfe = await page.locator("#sp-liste .game-buttons button").evaluateAll((els) => els.map((e) => [e.textContent, e.getBoundingClientRect().height, e.getBoundingClientRect().width]));
  r.check("Jeder Eintrag hat 'Im Brett ansehen' und 'PGN kopieren', mindestens 44 px", knoepfe.length === 10 && knoepfe.every(([t, h, w]) => (t === "Im Brett ansehen" || t === "PGN kopieren") && h >= 44 && w >= 44), JSON.stringify(knoepfe.slice(0, 2)));

  // PGN kopieren
  await page.locator("#liste-partien .game-item").first().locator("button", { hasText: "PGN kopieren" }).click();
  await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  r.check("PGN kopieren legt ein PGN in die Zwischenablage, mit chess.js ladbar", await page.evaluate(async (pgn) => {
    const { Chess } = await import("./vendor/chess.js/chess.js");
    const c = new Chess();
    c.loadPgn(pgn);
    return c.history().length === 4 && c.isCheckmate();
  }, clip) && /Training: Partie/.test(clip), clip.slice(0, 60));

  // Im Brett ansehen (Eintrag 2 ist Schwarz: Reihenfolge neueste zuerst: p2 (Stufe 3, Weiß), p1 (Stufe 2, Schwarz))
  await page.locator("#liste-partien .game-item").nth(1).locator("button", { hasText: "Im Brett ansehen" }).click();
  await page.waitForSelector("#page-brett:not([hidden])");
  r.check("Im Brett ansehen: Zugliste mit allen Zügen, Brett aus Sicht von Schwarz", (await page.locator("#move-list .move-entry").count()) === 5 && (await page.evaluate(() => document.getElementById("board").classList.contains("orientation-black"))));
  await page.click("#btn-forward");
  await page.waitForTimeout(250);
  r.check("Vor-Knopf geht durch die geladene Partie", (await page.inputValue("#fen-input")).includes("5P2") || (await page.inputValue("#fen-input")).includes("f3") || (await page.inputValue("#fen-input")) !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

  // Vorteil-Partie mit eigener Startstellung im Brett
  await page.goto(url + "index.html#/spielen/liste");
  await page.locator("#liste-versuche .game-item").first().locator("button", { hasText: "Im Brett ansehen" }).click();
  await page.waitForSelector("#page-brett:not([hidden])");
  r.check("Übung mit eigener Startstellung (ohne Dame) lässt sich im Brett laden", (await page.locator("#board piece.queen.black").count()) === 0 && (await page.locator("#move-list .move-entry").count()) === 3);

  // PGN im Brett laden (Chess.com-Stil)
  const pgnText = '[Event "Live Chess"]\n[Site "Chess.com"]\n[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0';
  await page.fill("#pgn-input", pgnText);
  await page.click("#btn-pgn-load");
  await page.waitForTimeout(250);
  r.check("PGN laden im Brett: 7 Züge, kein Fehler", (await page.locator("#move-list .move-entry").count()) === 8 && (await page.isHidden("#pgn-error")));
  await page.fill("#pgn-input", "das ist kein pgn 1. e9 xx");
  await page.click("#btn-pgn-load");
  r.check("Ungültiges PGN: verständliche Meldung, Brett bleibt", /konnte nicht gelesen werden/.test(await page.textContent("#pgn-error")) && (await page.locator("#move-list .move-entry").count()) === 8);
  const tapen = await page.locator("#btn-pgn-load, #btn-pgn-copy").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  r.check("PGN-Knöpfe mindestens 44 px", tapen.every((h) => h >= 44));

  // Obergrenzen: 35 Partien und 120 Übungen werden auf 30 und 100 gekürzt
  await seedPartien(page, 35, 120);
  const sp = await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    const s = store.get().spielen;
    return { p: s.partien.length, v: s.versuche.length, erste: s.partien[0].id, status: store.status.error };
  });
  r.check("Obergrenzen: höchstens 30 Partien und 100 Übungen, älteste fallen weg", sp.p === 30 && sp.v === 100 && !sp.status, JSON.stringify(sp));
  await page.goto(url + "index.html#/spielen/liste");
  await page.reload();
  r.check("Liste zeigt 30 Partien und 100 Übungen ohne seitlichen Überlauf", (await page.locator("#liste-partien .game-item").count()) === 30 && (await page.locator("#liste-versuche .game-item").count()) === 100 && (await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth)));

  // Export und Import nehmen alles mit
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    const { neueAktive } = await import("./js/partie.js");
    store.update((d) => {
      d.spielen.aktiv = { ...neueAktive({ modus: "partie", farbe: "w", stufe: 4 }), zuege: ["e2e4"] };
      d.spielen.gestartet = 7;
      d.einstellungen.chesscomWertung = 452;
    });
  });
  const vorher = await page.evaluate(async () => JSON.stringify((await import("./js/storage.js")).store.get()));
  await page.goto(url + "index.html#/mehr/daten");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btn-export")]);
  const file = "/tmp/schach-export-partien.json";
  await download.saveAs(file);
  const ex = JSON.parse(fs.readFileSync(file, "utf8"));
  r.check("Exportdatei enthält Partien, Übungen, laufende Partie und Wertung", ex.spielen.partien.length === 30 && ex.spielen.versuche.length === 100 && ex.spielen.aktiv.zuege[0] === "e2e4" && ex.einstellungen.chesscomWertung === 452 && ex.spielen.gestartet === 7);
  r.check("Exportdatei bleibt klein (Speichergrenze etwa 5 MB)", fs.statSync(file).size < 600000, String(fs.statSync(file).size));

  // in einem ganz neuen Browser-Kontext importieren
  const { page: page2 } = await newPage(browser, { acceptDownloads: true });
  await page2.goto(url + "index.html#/mehr/daten");
  await page2.setInputFiles("#datei-import", file);
  await page2.waitForTimeout(300);
  const vorschau = await page2.textContent("#import-bestaetigung-text");
  r.check("Import-Vorschau nennt Partien und Übungen", /30 Partien/.test(vorschau) && /100 Übungsversuche/.test(vorschau), vorschau);
  await page2.click("#btn-import-ja");
  const nachher = await page2.evaluate(async () => {
    const s = JSON.parse(JSON.stringify((await import("./js/storage.js")).store.get()));
    return s;
  });
  const alt = JSON.parse(vorher);
  r.check("Import ergibt dieselben Partien, Übungen, laufende Partie und Einstellungen", JSON.stringify(nachher.spielen) === JSON.stringify(alt.spielen) && nachher.einstellungen.chesscomWertung === 452);
  await page2.goto(url + "index.html#/spielen/liste");
  await page2.waitForTimeout(300);
  r.check("Importierte Partien erscheinen in der Liste", (await page2.locator("#liste-partien .game-item").count()) === 30);
  await page2.goto(url + "index.html#/spielen");
  r.check("Importierte laufende Partie lässt sich fortsetzen", await page2.isVisible("#sp-fortsetzen"));

  r.check("Keine Seitenfehler", page.__errors.length === 0 && page2.__errors.length === 0, [...page.__errors, ...page2.__errors].join(" | "));
  await context.close();
  await browser.close();
  server.close();
  r.done();
})();
