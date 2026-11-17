// Rätsel-Daten laden. Die Bandateien (data/puzzles/band-*.json) werden erst geladen, wenn sie
// gebraucht werden, und im Speicher gehalten. Der Service Worker legt sie zusätzlich im Cache ab.
import { bandOf, bandsFor, MIN_RATING, MAX_RATING } from "./rating.js";
import { PRUEFSETS, pruefsetInfo, DEFAULT_PRUEFSET } from "./pruefsets.js";

const BASE = "data/puzzles/";

export function parsePuzzle(row) {
  const [id, fen, zuege, rating, themen] = row;
  // "oneMove" kommt fast nur zusammen mit "mateIn1" vor und ist für die App kein eigenes Thema.
  return { id, fen, zuege, rating, themen: themen.filter((t) => t !== "oneMove") };
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
  const pruefsets = new Map(); // id -> Promise

  function loadIndex() {
    indexPromise ||= fetchJson(`${base}index.json`).catch((e) => {
      indexPromise = null;
      throw e;
    });
    return indexPromise;
  }

  // Vorhandene Bänder laut index.json (nur ab MIN_RATING). Fehlt die Datei oder ist sie nicht
  // lesbar, gilt die Standardliste 400 bis 2700.
  const DEFAULT_BANDS = [];
  for (let b = MIN_RATING; b <= MAX_RATING; b += 100) DEFAULT_BANDS.push(b);
  let known = null;
  function bandList() {
    return loadIndex()
      .then((index) => {
        const list = (index.baender || []).map((b) => b.band).filter((b) => Number.isInteger(b) && b >= MIN_RATING);
        known = list.length ? list.sort((a, b) => a - b) : DEFAULT_BANDS;
        return known;
      })
      .catch(() => known || DEFAULT_BANDS);
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

  function loadPruefset(id = DEFAULT_PRUEFSET) {
    const info = pruefsetInfo(id);
    if (!pruefsets.has(info.id)) {
      pruefsets.set(
        info.id,
        fetchJson(`${base}${info.datei}`)
          .then((data) => ({ id: info.id, satz: data.satz, raetsel: data.raetsel.map(parsePuzzle) }))
          .catch((e) => {
            pruefsets.delete(info.id);
            throw e;
          }),
      );
    }
    return pruefsets.get(info.id);
  }

  // Alle Rätsel mit Wertung in [low, high] (lädt nur die nötigen Bänder).
  async function inRange(low, high) {
    const available = await bandList();
    const lists = await Promise.all(bandsFor(low, high).filter((b) => available.includes(b)).map(loadBand));
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
  const warmBands = (list) => {
    warm([`${base}index.json`]);
    const bands = [...new Set(list.map(bandOf))];
    bandList().then((available) => warm(bands.filter((b) => available.includes(b)).map((b) => `${base}band-${b}.json`)));
  };
  const warmPruefset = () => warm(PRUEFSETS.map((p) => `${base}${p.datei}`));

  return { loadIndex, bandList, loadBand, loadPruefset, inRange, warmBands, warmPruefset };
}

export const puzzleStore = createPuzzleStore();
