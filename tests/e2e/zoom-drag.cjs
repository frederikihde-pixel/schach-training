// Prüft: Zoom erlaubt (Viewport ohne Sperre), Ziehen auf dem Brett scrollt die Seite nicht.
const { startServer, launch, newPage, dragMove, squareCenter, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Zoom und Ziehen");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  await page.goto(url + "index.html#/brett");
  await page.setViewportSize({ width: 390, height: 600 });
  await page.waitForTimeout(400);

  const meta = await page.getAttribute('meta[name="viewport"]', "content");
  r.check("Viewport ohne user-scalable=no / maximum-scale", !/user-scalable|maximum-scale/.test(meta), meta);

  const ta = await page.evaluate(() => getComputedStyle(document.getElementById("board")).touchAction);
  r.check("touch-action auf dem Brett ist manipulation", ta === "manipulation", ta);

  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  r.check("Seite ist höher als das Fenster (Scrollen wäre möglich)", scrollable);

  // Ziehen: Bauer e2 weit nach oben und über das Brett hinaus ziehen; die Seite darf nicht scrollen.
  const client = await page.context().newCDPSession(page);
  const a = await squareCenter(page, "e2");
  const b = await squareCenter(page, "e4");
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
  for (let i = 1; i <= 10; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: a.x, y: a.y + ((b.y - 300 - a.y) * i) / 10 }],
    });
    await page.waitForTimeout(16);
  }
  const during = await page.evaluate(() => window.scrollY);
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(200);
  r.check("Seite scrollt beim Ziehen nicht", during === 0, "scrollY=" + during);

  // Normaler Zug per Ziehen funktioniert weiterhin.
  await dragMove(page, "e2", "e4");
  const fen = await page.inputValue("#fen-input");
  r.check("Zug per Ziehen e2-e4 gespielt", fen.startsWith("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR"), fen);

  await page.screenshot({ path: process.env.SHOT || "/tmp/zoom-drag.png" });
  r.check("keine Skriptfehler", page.__errors.length === 0, page.__errors.join("; "));
  await browser.close();
  server.close();
  r.done();
})();
