// Rätsel-Daten laden. Die Bandateien (data/puzzles/band-*.json) werden erst geladen, wenn sie
// gebraucht werden, und im Speicher gehalten. Der Service Worker legt sie zusätzlich im Cache ab.
import { bandOf, bandsFor } from "./rating.js";

const BASE = "data/puzzles/";

export function parsePuzzle(row) {
  const [id, fen, zuege, rating, themen] = row;
  return { id, fen, zuege, rating, themen };
}

export function splitMoves(puzzle) {
  return puzzle.zuege.split(" ");
}

async function defaultFetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function createPuzzleStore({ fetchJson = defaultFetchJson, base = BASE } = {}) {
  const bands = new Map(); // band -> Promise<Puzzle[]>
  let indexPromise = null;
  let pruefsetPromise = null;

  function loadIndex() {
    indexPromise ||= fetchJson(`${base}index.json`).catch((e) => {
      indexPromise = null;
      throw e;
    });
    return indexPromise;
  }

  function loadBand(band) {
    const key = bandOf(band);
    if (!bands.has(key)) {
      bands.set(
        key,
        fetchJson(`${base}band-${key}.json`)
          .then((data) => data.raetsel.map(parsePuzzle))
          .catch((e) => {
            bands.delete(key);
            throw e;
          }),
      );
    }
    return bands.get(key);
  }

  function loadPruefset() {
    pruefsetPromise ||= fetchJson(`${base}pruefset.json`)
      .then((data) => ({ satz: data.satz, raetsel: data.raetsel.map(parsePuzzle) }))
      .catch((e) => {
        pruefsetPromise = null;
        throw e;
      });
    return pruefsetPromise;
  }

  // Alle Rätsel mit Wertung in [low, high] (lädt nur die nötigen Bänder).
  async function inRange(low, high) {
    const lists = await Promise.all(bandsFor(low, high).map(loadBand));
    return lists.flat().filter((p) => p.rating >= low && p.rating <= high);
  }

  // Holt Dateien im Hintergrund ab, damit der Service Worker sie für den Offline-Betrieb
  // zwischenspeichert. Läuft die Seite noch nicht unter dem Service Worker, wird beim nächsten
  // Aufruf erneut geholt. Fehler sind hier egal.
  const warmed = new Set();
  function warm(urls) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const controlled = typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.controller ? "#sw" : "";
    for (const url of urls) {
      const key = url + controlled;
      if (warmed.has(key)) continue;
      warmed.add(key);
      fetch(url).then((res) => res.arrayBuffer()).catch(() => {});
    }
  }
  const warmBands = (list) => warm(list.map((b) => `${base}band-${bandOf(b)}.json`));
  const warmPruefset = () => warm([`${base}pruefset.json`]);

  return { loadIndex, loadBand, loadPruefset, inRange, warmBands, warmPruefset };
}

export const puzzleStore = createPuzzleStore();
