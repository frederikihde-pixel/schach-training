// Prüft: kein seitliches Überlaufen (scrollWidth == Fensterbreite) auf allen Seiten.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

const ROUTES = (process.env.ROUTES || "#/brett,#/taktik,#/taktik/statistik,#/mehr,#/mehr/daten,#/mehr/info").split(",");

(async () => {
  const r = reporter("Seitenüberlauf");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  for (const route of ROUTES) {
    await page.goto(url + "index.html" + route);
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      bw: document.body.scrollWidth,
      iw: window.innerWidth,
    }));
    r.check(`${route} scrollWidth == ${m.iw}`, m.sw === m.iw && m.bw <= m.iw, `html=${m.sw} body=${m.bw}`);
  }
  await browser.close();
  server.close();
  r.done();
})();
