// Themen-Seite: Erklärungen, Einsteiger-Themen oben, "Dieses Thema üben", dritter Reiter. 390 px, Touch.
const { startServer, launch, newPage, reporter } = require("./lib.cjs");

(async () => {
  const r = reporter("Themen-Seite");
  const { server, url } = await startServer();
  const browser = await launch();

  const setTaktik = (page, src) =>
    page.evaluate(async (code) => {
      const { store } = await import("./js/storage.js");
      store.update(new Function("d", code));
    }, src);

  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik");
    await page.waitForTimeout(400);
    await setTaktik(page, "d.taktik.staerke = 800; d.taktik.eingestuft = true;");
    await page.reload();
    await page.waitForTimeout(500);
    r.check("Taktik-Seite führt zur Themen-Übersicht (keine zweite Reihe von Reitern mehr)", (await page.locator("#page-taktik .subnav").count()) === 0 && (await page.locator('#taktik-start a[href="#/taktik/themen"]').count()) === 1);
    await page.evaluate(() => { document.getElementById("taktik-optionen").open = true; });
    await page.click('#taktik-start a[href="#/taktik/themen"]');
    await page.waitForTimeout(300);
    r.check("Themen-Seite sichtbar, Reiter Taktik markiert", await page.evaluate(() => !document.getElementById("page-themen").hidden && document.getElementById("tab-taktik").getAttribute("aria-current") === "page"));
    r.check("Kopfzeile nennt 'Themen', der Zurück-Pfeil führt zur Taktik", (await page.textContent("#app-titel")) === "Themen" && (await page.getAttribute("#btn-zurueck", "href")) === "#/taktik");
    const info = await page.evaluate(() => {
      const names = (id) => [...document.querySelectorAll(`#${id} .theme-row strong`)].map((e) => e.textContent);
      const rows = [...document.querySelectorAll(".theme-row")];
      return {
        einstieg: names("themen-einstieg"),
        weitere: names("themen-weitere"),
        alleMitSatz: rows.every((li) => li.querySelector("p").textContent.length > 20),
        alleMitKnopf: rows.every((li) => li.querySelector("button").textContent === "Üben"),
        gabel: rows.find((li) => li.querySelector("strong").textContent === "Gabel").querySelector("p").textContent,
      };
    });
    r.check("Einsteiger-Themen stehen oben, zehn Stück, Matt in 1 zuerst", info.einstieg.length === 10 && info.einstieg[0] === "Matt in 1" && info.einstieg.includes("Gabel") && info.einstieg.includes("Fesselung") && info.einstieg.includes("Ungedeckte Figur"), info.einstieg.join());
    r.check("Weitere Themen folgen, nicht doppelt", info.weitere.length > 20 && !info.weitere.includes("Gabel"));
    r.check("Jedes Thema hat einen erklärenden Satz und den Knopf", info.alleMitSatz && info.alleMitKnopf);
    r.check("Erklärung der Gabel ist einfaches Deutsch", /zwei gegnerische Figuren/.test(info.gabel), info.gabel);
    r.check("Kein Überlauf, Tippflächen mindestens 44 px", await page.evaluate(() => {
      const ok = document.documentElement.scrollWidth === window.innerWidth;
      const small = [...document.querySelectorAll("#page-themen a, #page-themen button")].filter((e) => e.offsetParent).filter((e) => { const b = e.getBoundingClientRect(); return b.width < 43.5 || b.height < 43.5; });
      return ok && small.length === 0;
    }));

    // noch nicht eingestuft: Hinweis, keine Sitzung
    await setTaktik(page, "d.taktik.staerke = null; d.taktik.eingestuft = false;");
    await page.click('.theme-row button[data-thema="fork"]');
    r.check("Ohne Einstufung: freundlicher Hinweis statt Sitzung", /zuerst deine Stärke ein/.test(await page.textContent("#themen-meldung")) && !(await page.evaluate(() => document.getElementById("page-themen").hidden)));

    // eingestuft: Sitzung nur mit diesem Thema
    await setTaktik(page, "d.taktik.staerke = 800; d.taktik.eingestuft = true;");
    await page.click('.theme-row button[data-thema="fork"]');
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 20000 });
    const sess = await page.evaluate(async () => {
      const { store } = await import("./js/storage.js");
      const a = store.get().taktik.aktiv;
      return { typ: a.typ, filter: a.filter, alle: a.plan.every((i) => i.puzzle.themen.includes("fork")), n: a.plan.length };
    });
    r.check("'Dieses Thema üben' startet eine Sitzung nur mit Gabel-Rätseln", sess.typ === "sitzung" && sess.filter === "fork" && sess.alle && sess.n > 0, JSON.stringify(sess));
    r.check("keine Skriptfehler (Themen-Seite)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // laufende Sitzung: Hinweis
  {
    const { page } = await newPage(browser);
    await page.goto(url + "index.html#/taktik");
    await page.waitForTimeout(400);
    await setTaktik(page, "d.taktik.staerke = 800; d.taktik.eingestuft = true;");
    await page.reload();
    await page.waitForTimeout(500);
    await page.click("#btn-sitzung");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 20000 });
    await page.goto(url + "index.html#/taktik/themen");
    await page.waitForTimeout(400);
    await page.click('.theme-row button[data-thema="pin"]');
    r.check("Läuft eine Sitzung: Hinweis, keine zweite Sitzung", /Es läuft gerade eine Sitzung/.test(await page.textContent("#themen-meldung")));
  }

  await browser.close();
  server.close();
  r.done();
})();
