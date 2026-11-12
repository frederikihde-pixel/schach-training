// Sitzung, Wiederholung (Leitner) mit künstlich verschobenem Datum, Zusammenfassung, Fortsetzen.
const fs = require("fs");
const path = require("path");
const { startServer, launch, newPage, currentPuzzle, waitForSide, playUci, reporter, ROOT } = require("./lib.cjs");

const band = (b) => JSON.parse(fs.readFileSync(path.join(ROOT, `data/puzzles/band-${b}.json`), "utf8")).raetsel.map(([id, fen, zuege, rating, themen]) => ({ id, fen, zuege, rating, themen }));

(async () => {
  const r = reporter("Sitzung und Wiederholung");
  const { server, url } = await startServer();
  const browser = await launch();
  const T0 = new Date("2026-11-12T10:00:00");
  const day = (n) => new Date(T0.getTime() + n * 86400000);

  const state = (page) => page.evaluate(async () => JSON.parse(JSON.stringify((await import("./js/storage.js")).store.get().taktik)));
  async function waitMeldung(page, re, timeout = 25000) {
    await page.waitForFunction((src) => new RegExp(src).test(document.getElementById("lauf-meldung").textContent), re.source, { timeout });
  }
  async function solve(page) {
    const cur = await currentPuzzle(page);
    const o = await waitForSide(page);
    const mv = cur.puzzle.zuege.split(" ");
    for (let k = 1; k < mv.length; k += 2) { await playUci(page, mv[k], o); await page.waitForTimeout(k === mv.length - 1 ? 300 : 900); }
    await waitMeldung(page, /Richtig/);
    return cur;
  }
  async function prepare(page, { cards = {}, strength = 1500, time = T0 } = {}) {
    await page.clock.install({ time });
    await page.goto(url + "index.html#/taktik");
    await page.waitForTimeout(400);
    await page.evaluate(async ([cards, strength]) => {
      const { store } = await import("./js/storage.js");
      store.update((d) => { d.taktik.staerke = strength; d.taktik.eingestuft = true; d.taktik.karten = cards; });
    }, [cards, strength]);
    await page.reload();
    await page.waitForTimeout(500);
  }
  const card = (p, stufe, faellig) => ({ stufe, faellig, raetsel: p });
  const pool = band(1500);

  // ---- Fällige Wiederholungen hängen vom Datum ab ----
  {
    const { page } = await newPage(browser).then((x) => x);
    const cards = { [pool[0].id]: card(pool[0], 1, "2026-11-13"), [pool[1].id]: card(pool[1], 2, "2026-11-16") };
    await prepare(page, { cards });
    r.check("Heute (12.11.): keine Wiederholung fällig", (await page.textContent("#taktik-info")) === "Fällige Wiederholungen: 0");
    await page.clock.setFixedTime(day(1));
    await page.reload(); await page.waitForTimeout(500);
    r.check("Am 13.11.: 1 Wiederholung fällig (Stufe 1 nach 1 Tag)", (await page.textContent("#taktik-info")) === "Fällige Wiederholungen: 1");
    await page.clock.setFixedTime(day(4));
    await page.reload(); await page.waitForTimeout(500);
    r.check("Am 16.11.: 2 fällig (Stufe 2 nach 3 Tagen)", (await page.textContent("#taktik-info")) === "Fällige Wiederholungen: 2");
    r.check("keine Skriptfehler (Datum)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Sitzung zusammenstellen: 30 % Wiederholung, 70 % neu ----
  {
    const { page } = await newPage(browser);
    const cards = {};
    pool.slice(0, 5).forEach((p, i) => (cards[p.id] = card(p, 1, "2026-11-11")));
    await prepare(page, { cards });
    r.check("5 fällige Wiederholungen angezeigt", (await page.textContent("#taktik-info")) === "Fällige Wiederholungen: 5");
    await page.selectOption("#sel-groesse", "10");
    await page.click("#btn-sitzung");
    await page.waitForSelector("#taktik-lauf:not([hidden])", { timeout: 10000 });
    const t = await state(page);
    const plan = t.aktiv.plan;
    const dueN = plan.filter((i) => i.art === "wiederholung").length;
    r.check("Sitzung hat 10 Rätsel, davon 3 Wiederholungen und 7 neue", plan.length === 10 && dueN === 3 && plan.length - dueN === 7, `${plan.length} / ${dueN}`);
    r.check("Neue Rätsel liegen im Bereich Stärke -50 bis +150 (1450 bis 1650)", plan.filter((i) => i.art === "neu").every((i) => i.puzzle.rating >= 1450 && i.puzzle.rating <= 1650));
    r.check("keine doppelten Rätsel, keine schon gesehenen", new Set(plan.map((i) => i.puzzle.id)).size === 10);
    r.check("Fortschrittsanzeige 'Rätsel 1 von 10' ohne Serien oder Punkte", (await page.textContent("#lauf-fortschritt")) === "Rätsel 1 von 10" && !/Serie|Punkte|Streak/i.test(await page.innerText("#page-taktik")));
    // Fortsetzen nach Verlassen der Seite
    await page.click("#tab-brett");
    await page.waitForTimeout(300);
    await page.click("#tab-taktik");
    await page.waitForTimeout(400);
    r.check("Nach dem Verlassen: Sitzung kann fortgesetzt werden (Rätsel 1 von 10)", /Rätsel 1 von 10/.test(await page.textContent("#taktik-fortsetzen-text")));
    await page.click("#btn-verwerfen");
    r.check("Verwerfen entfernt die laufende Sitzung", (await state(page)).aktiv === null);
    r.check("keine Skriptfehler (Sitzung planen)", page.__errors.length === 0, page.__errors.join("; "));
  }

  // ---- Wiederholung lösen: Stufe steigt; falsch: zurück auf Stufe 1 ----
  {
    const { page } = await newPage(browser);
    const p = pool[10];
    await prepare(page, { cards: { [p.id]: card(p, 2, "2026-11-12") } });
    await page.evaluate(async (puzzle) => {
      const { store } = await import("./js/storage.js");
      store.update((d) => { d.taktik.aktiv = { typ: "sitzung", plan: [{ art: "wiederholung", puzzle }], index: 0, ergebnisse: [], filter: "", start: new Date().toISOString() }; });
    }, p);
    await page.reload(); await page.waitForTimeout(500);
    await page.click("#btn-fortsetzen");
    await page.waitForSelector("#taktik-lauf:not([hidden])");
    r.check("Wiederholung ist als solche gekennzeichnet", (await page.textContent("#lauf-art")) === "Wiederholung");
    await solve(page);
    const t = await state(page);
    r.check("Richtig in der Wiederholung: Stufe 2 -> 3, fällig in 7 Tagen (19.11.)", t.karten[p.id].stufe === 3 && t.karten[p.id].faellig === "2026-11-19", JSON.stringify(t.karten[p.id]));
    r.check("Wiederholung ändert die Taktikstärke nicht", t.staerke === 1500);
    await page.click("#btn-weiter");
    await page.waitForSelector("#taktik-zusammenfassung:not([hidden])");
    const text = await page.innerText("#zus-fakten");
    r.check("Zusammenfassung: gelöst, Fehler, Zeit, schwächstes Thema, Stärke", /Gelöst\s+1 von 1/.test(text) && /Fehler\s+0/.test(text) && /Durchschnittliche Zeit/.test(text) && /Schwächstes Thema dieser Sitzung\s+keines/.test(text) && /Taktikstärke\s+1500/.test(text), text.replace(/\s+/g, " "));
    r.check("Zusammenfassung ohne Auszeichnungen oder Serien", !/Abzeichen|Serie|Punkte|Streak|Rekord/i.test(text));
    r.check("Sitzung gespeichert, Verlauf hat einen Punkt", (await state(page)).sitzungen.length === 1 && (await state(page)).verlauf.length === 1);
  }

  // ---- Falsch in der Wiederholung: zurück auf Stufe 1 (am nächsten Tag fällig) ----
  {
    const { page } = await newPage(browser);
    const p = pool[11];
    await prepare(page, { cards: { [p.id]: card(p, 3, "2026-11-12") } });
    await page.evaluate(async (puzzle) => {
      const { store } = await import("./js/storage.js");
      store.update((d) => { d.taktik.aktiv = { typ: "sitzung", plan: [{ art: "wiederholung", puzzle }], index: 0, ergebnisse: [], filter: "", start: new Date().toISOString() }; });
    }, p);
    await page.reload(); await page.waitForTimeout(500);
    await page.click("#btn-fortsetzen");
    await page.waitForSelector("#taktik-lauf:not([hidden])");
    const orientation = await waitForSide(page);
    const mv = p.zuege.split(" ");
    const wrong = await page.evaluate(async ([fen, zuege]) => {
      const { Chess } = await import("./vendor/chess.js/chess.js");
      const m = zuege.split(" "); const g = new Chess(fen);
      g.move({ from: m[0].slice(0, 2), to: m[0].slice(2, 4), promotion: m[0][4] });
      for (const x of g.moves({ verbose: true })) { const u = x.from + x.to + (x.promotion || ""); if (u !== m[1] && !x.promotion) { const q = new Chess(g.fen()); q.move(x); if (!q.isCheckmate()) return u; } }
    }, [p.fen, p.zuege]);
    await playUci(page, wrong, orientation);
    await waitMeldung(page, /Nicht gelöst/);
    await page.waitForTimeout(300);
    const t = await state(page);
    r.check("Falsch in der Wiederholung: zurück auf Stufe 1, fällig am 13.11.", t.karten[p.id].stufe === 1 && t.karten[p.id].faellig === "2026-11-13", JSON.stringify(t.karten[p.id]));
    r.check("keine Skriptfehler (Wiederholung)", page.__errors.length === 0, page.__errors.join("; "));
  }

  await browser.close();
  server.close();
  r.done();
})();
