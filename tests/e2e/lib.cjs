// Gemeinsame Helfer für die Browsertests (Playwright muss global installiert sein,
// siehe NODE_PATH). Start: node tests/e2e/<datei>.cjs
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

const ROOT = process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT) : path.resolve(__dirname, "../..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8",
};

// Solange data/puzzles/pruefset.json noch nicht gebaut ist (der Workflow erzeugt es), liefern die
// Tests ein gleichwertiges Prüfset aus den vorhandenen Bandateien: 20 Rätsel von 850 bis 2050.
function fallbackPruefset() {
  const picked = [];
  const used = new Set();
  for (let i = 0; i < 20; i++) {
    const target = Math.round(850 + (i * 1200) / 19);
    const band = Math.floor(target / 100) * 100;
    const list = JSON.parse(fs.readFileSync(path.join(ROOT, `data/puzzles/band-${band}.json`), "utf8")).raetsel;
    const best = list.filter((p) => !used.has(p[0])).sort((a, b) => Math.abs(a[3] - target) - Math.abs(b[3] - target))[0];
    used.add(best[0]);
    picked.push(best);
  }
  return JSON.stringify({ satz: "testsatz1", felder: ["id", "fen", "zuege", "rating", "themen"], raetsel: picked });
}

function startServer(port = 0, overrides = {}) {
  const hits = {};
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let rel = decodeURIComponent(url.pathname);
    hits[rel] = (hits[rel] || 0) + 1;
    if (overrides[rel]) {
      const o = overrides[rel];
      res.writeHead(o.status || 200, { "Content-Type": o.type || "application/json" });
      res.end(o.body);
      return;
    }
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(ROOT, rel);
    if (rel === "/data/puzzles/pruefset.json" && !fs.existsSync(file)) {
      res.writeHead(200, { "Content-Type": "application/json" }).end(fallbackPruefset());
      return;
    }
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("nicht gefunden");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, hits, overrides, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

async function launch() {
  return chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
}

async function newContext(browser, extra = {}) {
  return browser.newContext({ ...devices["iPhone 12"], viewport: { width: 390, height: 844 }, ...extra });
}

async function newPage(browser, extra = {}) {
  const context = await newContext(browser, extra);
  const page = await context.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push("pageerror: " + e));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon\.ico$/.test(m.location().url || "")) {
      page.__errors.push("console: " + m.text() + " " + (m.location().url || ""));
    }
  });
  return { context, page };
}

async function squareCenter(page, square, orientation = "white", boardSel = "#board") {
  const box = await page.locator(boardSel).boundingBox();
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10) - 1;
  const size = box.width / 8;
  let col = file;
  let row = 7 - rank;
  if (orientation === "black") {
    col = 7 - file;
    row = rank;
  }
  return { x: box.x + (col + 0.5) * size, y: box.y + (row + 0.5) * size };
}

async function tapMove(page, from, to, orientation = "white", boardSel = "#board") {
  const a = await squareCenter(page, from, orientation, boardSel);
  const b = await squareCenter(page, to, orientation, boardSel);
  await page.touchscreen.tap(a.x, a.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(b.x, b.y);
  await page.waitForTimeout(200);
}

async function dragMove(page, from, to, orientation = "white", boardSel = "#board") {
  const client = await page.context().newCDPSession(page);
  const a = await squareCenter(page, from, orientation, boardSel);
  const b = await squareCenter(page, to, orientation, boardSel);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
  await page.waitForTimeout(16);
  for (let i = 1; i <= 6; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 6, y: a.y + ((b.y - a.y) * i) / 6 }],
    });
    await page.waitForTimeout(16);
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(200);
}

// Sammelt Ergebnisse und beendet das Skript mit Fehlercode, wenn etwas fehlschlägt.
function reporter(title) {
  const rows = [];
  return {
    check(name, ok, detail = "") {
      rows.push({ name, ok: !!ok, detail });
      console.log(`${ok ? "OK    " : "FEHLER"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
    },
    done() {
      const bad = rows.filter((r) => !r.ok).length;
      console.log(`\n${title}: ${rows.length - bad} von ${rows.length} bestanden`);
      process.exitCode = bad ? 1 : 0;
    },
  };
}

module.exports = { ROOT, startServer, launch, newContext, newPage, squareCenter, tapMove, dragMove, reporter };

// ---- Taktik-Helfer ----

// Liest das gerade laufende Rätsel aus dem Speicher der App.
async function currentPuzzle(page) {
  return page.evaluate(async () => {
    const { store } = await import("./js/storage.js");
    const a = store.get().taktik.aktiv;
    return a ? { puzzle: a.plan[a.index].puzzle, art: a.plan[a.index].art, index: a.index, typ: a.typ } : null;
  });
}

async function waitForSide(page) {
  await page.waitForFunction(() => /am Zug/.test(document.getElementById("lauf-seite").textContent), null, { timeout: 8000 });
  await page.waitForTimeout(350);
  return (await page.textContent("#lauf-seite")).startsWith("Weiß") ? "white" : "black";
}

async function playUci(page, uci, orientation, board = "#taktik-board") {
  await tapMove(page, uci.slice(0, 2), uci.slice(2, 4), orientation, board);
  if (uci[4]) {
    const index = { q: 0, r: 1, b: 2, n: 3 }[uci[4]];
    await page.waitForSelector("#promotion-overlay:not([hidden])", { timeout: 3000 });
    await page.locator(".promo-btn").nth(index).click();
    await page.waitForTimeout(250);
  }
}

// Löst das aktuelle Rätsel mit der gespeicherten Zugfolge. `wrongAt`: ab diesem Zug (Index in zuege,
// 1 = erster Zug des Spielers) wird absichtlich ein falscher legaler Zug gespielt.
async function solveCurrent(page, { wrongMove = null } = {}) {
  const cur = await currentPuzzle(page);
  const orientation = await waitForSide(page);
  const moves = cur.puzzle.zuege.split(" ");
  if (wrongMove) {
    await playUci(page, wrongMove, orientation);
    return { cur, orientation };
  }
  for (let i = 1; i < moves.length; i += 2) {
    await playUci(page, moves[i], orientation);
    await page.waitForTimeout(i === moves.length - 1 ? 300 : 900);
  }
  return { cur, orientation };
}

Object.assign(module.exports, { currentPuzzle, waitForSide, playUci, solveCurrent });
