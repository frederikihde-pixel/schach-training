// Regressionstest Phase 1 (Brett) bei 390 px mit Touch-Emulation.
const { startServer, launch, newPage, tapMove, dragMove, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Brett (Phase 1)");
  const { server, url } = await startServer();
  const browser = await launch();

  async function fresh(hash = "#/brett") {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html" + hash);
    await page.waitForTimeout(350);
    return page;
  }
  const fenOf = (page) => page.inputValue("#fen-input");
  const status = (page) => page.evaluate(() => document.getElementById("status-message").textContent);
  const playAll = async (page, moves) => {
    for (const [f, t] of moves) await tapMove(page, f, t);
  };

  // Rochade kurz (Ziehen)
  {
    const p = await fresh();
    await playAll(p, [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["f8", "c5"]]);
    await dragMove(p, "e1", "g1");
    r.check("Rochade kurz", (await fenOf(p)).includes("RNBQ1RK1"), await fenOf(p));
  }
  // Rochade lang (Tippen)
  {
    const p = await fresh();
    await playAll(p, [["d2", "d4"], ["d7", "d5"], ["b1", "c3"], ["b8", "c6"], ["c1", "f4"], ["c8", "f5"], ["d1", "d2"], ["d8", "d7"], ["e1", "c1"]]);
    r.check("Rochade lang", (await fenOf(p)).includes("2KR1BNR"), await fenOf(p));
  }
  // en passant
  {
    const p = await fresh();
    await playAll(p, [["e2", "e4"], ["a7", "a6"], ["e4", "e5"]]);
    await dragMove(p, "d7", "d5");
    await dragMove(p, "e5", "d6");
    r.check("en passant", (await fenOf(p)).startsWith("rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR"), await fenOf(p));
  }
  // Umwandlung (Dame, Springer)
  for (const [idx, label, prefix] of [[0, "Dame", "Qnbqkbnr"], [3, "Springer", "Nnbqkbnr"]]) {
    const p = await fresh();
    await playAll(p, [["a2", "a4"], ["h7", "h5"], ["a4", "a5"], ["h5", "h4"], ["a5", "a6"], ["h4", "h3"], ["a6", "b7"], ["h3", "g2"], ["b7", "a8"]]);
    const shown = await p.evaluate(() => !document.getElementById("promotion-overlay").hidden);
    await p.locator(".promo-btn").nth(idx).click();
    await p.waitForTimeout(250);
    r.check(`Umwandlung in ${label}`, shown && (await fenOf(p)).startsWith(prefix), await fenOf(p));
  }
  // Narrenmatt
  {
    const p = await fresh();
    await playAll(p, [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
    r.check("Narrenmatt", (await status(p)) === "Schachmatt. Schwarz gewinnt.", await status(p));
  }
  // Spielende per FEN
  {
    const p = await fresh();
    const cases = [
      ["7k/5K2/6Q1/8/8/8/8/8 b - - 0 1", "Patt. Die Partie ist remis."],
      ["8/8/8/8/8/5k2/8/5K1N w - - 0 1", "Remis durch zu wenig Material."],
      ["4k3/8/8/8/8/8/8/4K2R w - - 100 60", "Remis durch die 50-Züge-Regel."],
    ];
    for (const [fen, expected] of cases) {
      await p.fill("#fen-input", fen);
      await p.click("#btn-fen-load");
      await p.waitForTimeout(150);
      r.check("Spielende: " + expected, (await status(p)) === expected, await status(p));
    }
    await p.fill("#fen-input", "kein fen");
    await p.click("#btn-fen-load");
    r.check("ungültige FEN zeigt Fehler", await p.evaluate(() => !document.getElementById("fen-error").hidden));
  }
  // Dreifache Wiederholung
  {
    const p = await fresh();
    await playAll(p, [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"], ["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]]);
    r.check("dreifache Wiederholung", (await status(p)) === "Remis durch dreifache Stellungswiederholung.", await status(p));
  }
  // Zurück / Vor / Zugliste / Drehen / Neustart
  {
    const p = await fresh();
    await playAll(p, [["e2", "e4"], ["e7", "e5"], ["g1", "f3"]]);
    await p.click("#btn-back");
    await p.click("#btn-back");
    const hint = await p.evaluate(() => !document.getElementById("view-hint").hidden);
    r.check("Zug zurück zeigt Hinweis", hint && (await fenOf(p)).startsWith("rnbqkbnr/pppppppp/8/8/4P3/8/"), await fenOf(p));
    await p.click("#btn-forward");
    await p.click("#btn-forward");
    r.check("Zug vor", (await fenOf(p)).startsWith("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/"), await fenOf(p));
    await p.locator(".move-entry").nth(1).click();
    r.check("Zugliste springt zur Stellung", (await fenOf(p)).startsWith("rnbqkbnr/pppppppp/8/8/4P3/8/"), await fenOf(p));
    await p.click("#btn-flip");
    await p.waitForTimeout(250);
    r.check("Brett drehen", await p.evaluate(() => !!document.querySelector("#board.orientation-black, #board .orientation-black, .cg-wrap.orientation-black")));
    await p.click("#btn-reset");
    r.check("Neustart", (await fenOf(p)).startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w"), await fenOf(p));
  }
  // Nach "Schach." verschiebt sich das Brett (Hinweis erscheint darüber): Züge müssen trotzdem treffen.
  {
    const p = await fresh();
    await playAll(p, [["e2", "e4"], ["f7", "f6"], ["d1", "h5"]]);
    r.check("Schach-Hinweis erscheint", (await status(p)) === "Schach.");
    await playAll(p, [["g7", "g6"], ["h5", "g6"]]);
    r.check("Zug nach verschobenem Brett trifft das richtige Feld", (await fenOf(p)).startsWith("rnbqkbnr/ppppp2p/5pQ1/8/4P3/8/PPPP1PPP/RNB1KBNR b"), await fenOf(p));
  }
  // Seitenwechsel behält die Partie und das Brett bleibt bedienbar
  {
    const p = await fresh("#/taktik");
    await p.click("#tab-brett");
    await p.waitForTimeout(300);
    await tapMove(p, "e2", "e4");
    await p.click("#tab-taktik");
    await p.waitForTimeout(150);
    await p.click("#tab-brett");
    await p.waitForTimeout(300);
    r.check("Partie bleibt beim Seitenwechsel erhalten", (await fenOf(p)).startsWith("rnbqkbnr/pppppppp/8/8/4P3/8/"), await fenOf(p));
    await tapMove(p, "e7", "e5");
    r.check("Brett nach Seitenwechsel bedienbar", (await fenOf(p)).startsWith("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/"), await fenOf(p));
    r.check("keine Skriptfehler", p.__errors.length === 0, p.__errors.join("; "));
  }

  await browser.close();
  server.close();
  r.done();
})();
