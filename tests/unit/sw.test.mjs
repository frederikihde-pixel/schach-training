// Prüft, dass die Vorab-Liste des Service Workers alle App-Dateien enthält.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const src = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const precache = new Function(`${src.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/^/, "return ")}`)();

function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

test("Vorab-Liste enthält alle Dateien aus css/, js/ und icons/", () => {
  const expected = [...walk("css"), ...walk("js"), ...walk("icons")].map((f) => "./" + f.split(path.sep).join("/"));
  for (const f of expected) assert.ok(precache.includes(f), `fehlt in PRECACHE: ${f}`);
});

test("Vorab-Liste enthält die genutzten Bibliotheksdateien, die Startdateien und die Lizenzen", () => {
  for (const f of ["./", "./index.html", "./manifest.webmanifest", "./LICENSE", "./vendor/chess.js/chess.js", "./vendor/chess.js/LICENSE", "./vendor/chessground/chessground.min.js", "./vendor/chessground/chessground.base.css", "./vendor/chessground/chessground.cburnett.css", "./vendor/chessground/LICENSE"]) {
    assert.ok(precache.includes(f), `fehlt in PRECACHE: ${f}`);
  }
});

test("jeder Eintrag der Liste existiert", () => {
  for (const f of precache) {
    if (f === "./") continue;
    assert.ok(fs.existsSync(path.join(root, f)), `Datei fehlt: ${f}`);
  }
});

test("Cache-Name enthält eine Versionsnummer", () => {
  assert.match(src, /const CACHE_VERSION = \d+;/);
  assert.match(src, /CACHE_NAME = `\$\{CACHE_PREFIX\}v\$\{CACHE_VERSION\}`/);
});
