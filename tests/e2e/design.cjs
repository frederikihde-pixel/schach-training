// Brett-Designs: Standard, Wechsel wirkt sofort auf alle Bretter, Speichern, Migration, Vorschau, Umwandlung.
const { startServer, launch, newPage, tapMove, reporter } = require("./lib.cjs");

const COLORS = {
  klassisch: { hell: "rgb(240, 230, 210)", dunkel: "rgb(139, 94, 60)" },
  dunkel: { hell: "rgb(131, 147, 173)", dunkel: "rgb(86, 97, 113)" },
  gruen: { hell: "rgb(236, 235, 208)", dunkel: "rgb(111, 143, 95)" },
};

(async () => {
  const r = reporter("Brett-Designs");
  const { server, url } = await startServer();
  const browser = await launch();

  const bg = (page, sel) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
  const feldHell = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--feld-hell").trim());
  const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("schach-training")));
  const dataset = (page) => page.evaluate(() => document.documentElement.dataset.brettDesign);

  // ---- Neue Nutzer: Klassisch ----
  const { page } = await newPage(browser);
  await page.goto(url + "index.html#/brett");
  await page.waitForTimeout(500);
  r.check("Neue Nutzer: Standard ist Klassisch", (await dataset(page)) === "klassisch" && (await bg(page, "#board cg-board")) === COLORS.klassisch.hell, await dataset(page));

  // ---- Auswahl über Mehr > Darstellung ----
  await page.click("#link-mehr");
  await page.click('a[href="#/mehr/darstellung"]');
  await page.waitForSelector("#design-liste .design-card");
  const cards = await page.$$eval(".design-card", (c) => c.map((x) => ({ name: x.querySelector("strong").textContent, h: x.getBoundingClientRect().height, w: x.getBoundingClientRect().width, pressed: x.getAttribute("aria-pressed") })));
  r.check("Drei Karten: Klassisch, Dunkel, Grün", cards.map((c) => c.name).join() === "Klassisch,Dunkel,Grün", cards.map((c) => c.name).join());
  r.check("Karten mindestens 44 px hoch und breit", cards.every((c) => c.h >= 44 && c.w >= 44));
  r.check("Klassisch ist als gewählt markiert", cards[0].pressed === "true" && cards[1].pressed === "false" && cards[2].pressed === "false");
  const previews = await page.$$eval(".design-preview cg-board", (b) => b.map((x) => getComputedStyle(x).backgroundColor));
  r.check("Jede Vorschau zeigt ihre eigenen Farben (ohne auf andere Bretter abzufärben)", previews.join() === [COLORS.klassisch.hell, COLORS.dunkel.hell, COLORS.gruen.hell].join(), previews.join(" | "));
  r.check("Vorschau zeigt Figuren, Zielpunkte, Schlagring, letzten Zug, gewähltes Feld und Schach", await page.evaluate(() => { const b = document.querySelector(".design-preview"); return b.querySelectorAll("piece").length >= 7 && b.querySelectorAll("square.move-dest").length >= 8 && b.querySelectorAll("square.oc").length >= 1 && b.querySelectorAll("square.last-move").length === 2 && b.querySelectorAll("square.selected").length === 1 && b.querySelectorAll("square.check").length === 1; }));

  // Dunkel wählen
  await page.locator(".design-card").nth(1).click();
  await page.waitForTimeout(150);
  r.check("Wechsel wirkt sofort (Dunkel)", (await dataset(page)) === "dunkel" && (await feldHell(page)) === "#8393ad");
  r.check("Gewählt wird angezeigt", (await page.locator(".design-card").nth(1).getAttribute("aria-pressed")) === "true" && /Gewählt/.test(await page.locator(".design-card").nth(1).innerText()));
  r.check("Gespeichert (Einstellungen)", (await stored(page)).einstellungen.brettDesign === "dunkel");

  // Wirkt auf das Brett
  await page.click("#tab-brett");
  await page.waitForTimeout(300);
  r.check("Brett zeigt die Dunkel-Farben", (await bg(page, "#board cg-board")) === COLORS.dunkel.hell, await bg(page, "#board cg-board"));
  await tapMove(page, "e2", "e4");
  r.check("Brett bleibt bedienbar", (await page.inputValue("#fen-input")).startsWith("rnbqkbnr/pppppppp/8/8/4P3/"));

  // Wirkt auf das Taktik-Brett (Einstufung) und die Standortbestimmung (gleiches Brett)
  await page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    store.update((d) => { d.taktik.staerke = 1500; d.taktik.eingestuft = true; });
  });
  await page.reload();
  await page.waitForTimeout(500);
  r.check("Nach Neuladen bleibt Dunkel erhalten", (await dataset(page)) === "dunkel" && (await feldHell(page)) === "#8393ad");
  await page.click("#tab-taktik");
  await page.click("#btn-sitzung");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
  await page.waitForTimeout(600);
  r.check("Taktik-Brett zeigt die Dunkel-Farben", (await bg(page, "#taktik-board cg-board")) === COLORS.dunkel.hell, await bg(page, "#taktik-board cg-board"));
  await page.click("#btn-beenden");
  await page.click("#btn-beenden-ja");
  await page.goto(url + "index.html#/taktik/statistik");
  await page.waitForTimeout(600);
  await page.click("#btn-standort");
  await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 15000 });
  await page.waitForTimeout(600);
  r.check("Standortbestimmung zeigt die Dunkel-Farben", (await bg(page, "#taktik-board cg-board")) === COLORS.dunkel.hell);
  await page.click("#btn-beenden");
  await page.click("#btn-beenden-ja");

  // Wechsel zu Grün und Klassisch, zurück auf die Darstellung
  await page.goto(url + "index.html#/mehr/darstellung");
  await page.waitForSelector(".design-card");
  await page.locator(".design-card").nth(2).click();
  await page.waitForTimeout(100);
  r.check("Wechsel auf Grün wirkt sofort", (await dataset(page)) === "gruen" && (await feldHell(page)) === "#ecebd0");
  await page.locator(".design-card").nth(0).click();
  await page.waitForTimeout(100);
  r.check("Wechsel zurück auf Klassisch", (await dataset(page)) === "klassisch" && (await stored(page)).einstellungen.brettDesign === "klassisch");

  // ---- Umwandlungsauswahl: Figuren auf der Feldfarbe mit dem besten Kontrast ----
  await page.locator(".design-card").nth(1).click();
  await page.click("#tab-brett");
  await page.waitForTimeout(300);
  await page.fill("#fen-input", "8/8/8/8/8/8/p6k/4K3 b - - 0 1");
  await page.click("#btn-fen-load");
  await page.waitForTimeout(250);
  await tapMove(page, "a2", "a1");
  await page.waitForSelector("#promotion-overlay:not([hidden])");
  const tiles = await page.$$eval(".promo-piece", (t) => t.map((x) => getComputedStyle(x).backgroundColor));
  r.check("Schwarze Figuren der Umwandlung liegen auf dem hellen Feld des Designs", tiles.length === 4 && tiles.every((t) => t === COLORS.dunkel.hell), tiles.join());
  await page.locator(".promo-btn").first().click();
  await page.waitForTimeout(200);
  await page.fill("#fen-input", "8/P6k/8/8/8/8/8/4K3 w - - 0 1");
  await page.click("#btn-fen-load");
  await tapMove(page, "a7", "a8");
  await page.waitForSelector("#promotion-overlay:not([hidden])");
  const tilesW = await page.$$eval(".promo-piece", (t) => t.map((x) => getComputedStyle(x).backgroundColor));
  r.check("Weiße Figuren der Umwandlung liegen auf dem dunklen Feld des Designs", tilesW.every((t) => t === COLORS.dunkel.dunkel), tilesW.join());
  await page.locator(".promo-btn").first().click();

  // ---- Migration: bisheriger Stand (Version 2) behält Dunkel, neuer Nutzer bekommt Klassisch ----
  const v2 = { app: "schach-training", version: 2, erstelltAm: "2026-11-01T10:00:00.000Z", letzterExport: null, einstellungen: {}, taktik: { staerke: 1450, eingestuft: true, anzahl: 12, versuche: [{ id: "a" }], themen: {}, karten: {}, gesehen: {}, sitzungen: [], verlauf: [], standort: [], aktiv: null } };
  const old = await newPage(browser, { seed: false });
  await old.page.addInitScript((state) => { if (!localStorage.getItem("schach-training")) localStorage.setItem("schach-training", JSON.stringify(state)); }, v2);
  await old.page.goto(url + "index.html#/brett");
  await old.page.waitForTimeout(500);
  r.check("Bisheriger Stand (Version 2): Dunkel bleibt", (await dataset(old.page)) === "dunkel" && (await bg(old.page, "#board cg-board")) === COLORS.dunkel.hell);
  r.check("Daten des bisherigen Stands bleiben erhalten", (await old.page.evaluate(async () => (await import("./js/storage.js")).store.get().taktik.staerke)) === 1450);

  r.check("keine Skriptfehler", page.__errors.length === 0 && old.page.__errors.length === 0, [...page.__errors, ...old.page.__errors].join("; "));
  await browser.close();
  server.close();
  r.done();
})();
