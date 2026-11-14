// Erzeugt Screenshots der Brett-Designs bei 390 px (Startstellung; Stellung mit Schach, letztem Zug,
// gewähltem Feld, Zielpunkten und Schlagring) unter tests/screenshots/. Start: node tests/e2e/screenshots.cjs
const fs = require("fs");
const path = require("path");
const { startServer, launch, newPage, tapMove } = require("./lib.cjs");

const OUT = path.resolve(__dirname, "../screenshots");
const DESIGNS = ["klassisch", "dunkel", "gruen"];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser, { deviceScaleFactor: 2 });
  await page.goto(url + "index.html#/brett");
  await page.waitForTimeout(500);

  async function shot(name) {
    const box = await page.locator("#board").boundingBox();
    await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: box.y - 4, width: 390, height: box.height + 8 } });
  }
  async function setDesign(id) {
    await page.evaluate(async (d) => (await import("./js/design.js")).setDesign(d), id);
    await page.waitForTimeout(250);
  }

  for (const id of DESIGNS) {
    await setDesign(id);
    await page.click("#btn-reset");
    await page.waitForTimeout(300);
    await shot(`${id}-start.png`);

    // Schach: schwarzer Turm d8-e8 gibt Schach, Dame b5 ist gewählt (Zielpunkte e5, e2, Schlagring e8)
    await page.fill("#fen-input", "3r2k1/5ppp/8/1Q6/8/8/5PPP/R3K3 b - - 0 1");
    await page.click("#btn-fen-load");
    await page.waitForTimeout(250);
    await tapMove(page, "d8", "e8");
    await page.waitForTimeout(300);
    const box = await page.locator("#board").boundingBox();
    const sq = (file, rank) => ({ x: box.x + (file + 0.5) * (box.width / 8), y: box.y + (7 - rank + 0.5) * (box.height / 8) });
    const b5 = sq(1, 4);
    await page.touchscreen.tap(b5.x, b5.y);
    await page.waitForTimeout(350);
    await shot(`${id}-schach.png`);
  }

  await page.goto(url + "index.html#/mehr/darstellung");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "darstellung.png") });

  await browser.close();
  server.close();
  console.log("Screenshots in", OUT);
})();
