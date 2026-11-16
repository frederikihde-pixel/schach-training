// Navigation, untere Leiste, Info-Seite und Mindestgröße der Tippflächen (44 px).
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

const ROUTES = (process.env.ROUTES || "#/brett,#/taktik,#/taktik/statistik,#/mehr,#/mehr/darstellung,#/mehr/daten,#/mehr/info").split(",");

(async () => {
  const r = reporter("Navigation und Tippflächen");
  const { server, url } = await startServer();
  const browser = await launch();
  const { page } = await newPage(browser);
  await page.goto(url + "index.html");
  await page.waitForTimeout(400);

  // Untere Leiste
  const bar = await page.evaluate(() => {
    const el = document.querySelector(".tabbar");
    const b = el.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, h: b.height, pos: getComputedStyle(el).position, labels: [...el.querySelectorAll("a")].map((a) => a.textContent.trim()), ih: innerHeight };
  });
  r.check("Leiste ist fest und enthält Brett und Taktik", bar.pos === "fixed" && bar.labels.join() === "Brett,Taktik", bar.labels.join());
  r.check("Leiste liegt am unteren Rand", Math.abs(bar.bottom - bar.ih) < 1, `bottom=${bar.bottom} innerHeight=${bar.ih}`);

  await page.click("#tab-taktik");
  await page.waitForTimeout(150);
  r.check("Taktik-Seite sichtbar, Reiter markiert", (await page.evaluate(() => !document.getElementById("page-taktik").hidden && document.getElementById("tab-taktik").getAttribute("aria-current") === "page")));
  await page.click("#link-mehr");
  await page.waitForTimeout(150);
  r.check("Mehr-Seite über Knopf oben rechts", await page.evaluate(() => !document.getElementById("page-mehr").hidden));
  await page.click('a[href="#/mehr/info"]');
  await page.waitForTimeout(150);
  r.check("Info-Seite erreichbar", await page.evaluate(() => !document.getElementById("page-info").hidden));
  r.check("Info nennt Cburnett und CC BY-SA 3.0", await page.evaluate(() => /Cburnett/.test(document.body.innerText) && /CC BY-SA 3\.0/.test(document.body.innerText)));
  r.check("Info nennt chess.js, Chessground, Lichess-Rätsel", await page.evaluate(() => /chess\.js/.test(document.body.innerText) && /Chessground/.test(document.body.innerText) && /Lichess-Rätsel/.test(document.body.innerText)));
  await page.locator("details.license").nth(1).locator("summary").click();
  await page.waitForTimeout(400);
  const lic = await page.locator("details.license").nth(1).locator("pre").innerText();
  r.check("Lizenztext chess.js wird geladen", /BSD|Redistribution/.test(lic), lic.slice(0, 40));
  await page.click("#page-info .back-link");
  await page.waitForTimeout(150);
  r.check("Zurück führt zu Mehr", await page.evaluate(() => !document.getElementById("page-mehr").hidden));
  await page.goto(url + "index.html#/gibtesnicht");
  await page.waitForTimeout(200);
  r.check("Unbekannte Adresse zeigt das Brett", await page.evaluate(() => !document.getElementById("page-brett").hidden));

  // Tippflächen
  for (const route of ROUTES) {
    await page.goto(url + "index.html" + route);
    await page.waitForTimeout(300);
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("a, button, summary, input, select, textarea")) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (el.closest("[hidden]")) continue;
        if (b.width < 43.5 || b.height < 43.5) out.push(`${el.tagName.toLowerCase()}#${el.id || el.textContent.trim().slice(0, 12)} ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      return out;
    });
    r.check(`Tippflächen >= 44 px auf ${route}`, small.length === 0, small.join("; "));
  }

  // Letztes Element wird nicht von der Leiste verdeckt
  await page.goto(url + "index.html#/mehr/info");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const covered = await page.evaluate(() => {
    const last = [...document.querySelectorAll("#page-info .block")].pop().getBoundingClientRect();
    return last.bottom > document.querySelector(".tabbar").getBoundingClientRect().top + 1;
  });
  r.check("Leiste verdeckt keinen Inhalt am Seitenende", !covered);

  r.check("keine Skriptfehler", page.__errors.length === 0, page.__errors.join("; "));
  await browser.close();
  server.close();
  r.done();
})();
