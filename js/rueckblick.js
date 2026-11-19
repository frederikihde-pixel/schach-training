// Steuerung der Analyse einer Partie: startet sie, speichert nach jeder Stellung (so geht sie nach Neuladen oder
// App-Wechsel weiter), meldet den Fortschritt und legt das Ergebnis ab. Kein DOM; die Seite hört auf die Meldungen.

import { analysiere, analyseEintrag, leseEingabe, SUCHZEIT_MS, stellungen } from "./analyse.js";
import { store as appStore } from "./storage.js";
import { getEngine as appEngine } from "./engine.js";
import { ausAnalyse } from "./eigene.js";
import { dayKey } from "./leitner.js";

// store: js/storage.js, engine: js/engine.js (getEngine()), movetime: Suchzeit je Stellung.
export function createRueckblick({ store, getEngine, movetime = SUCHZEIT_MS, nachAnalyse = null }) {
  const hoerer = new Set();
  let laufend = null; // { id, abbruch }
  const melde = (typ, daten = {}) => {
    for (const f of hoerer) f({ typ, ...daten });
  };
  const sp = () => store.get().spielen;

  function eintrag(id) {
    return sp().analysen.find((a) => a.id === id) || null;
  }

  // Fortschritt der laufenden (oder unterbrochenen) Analyse oder null.
  function status() {
    const l = sp().analyseLauf;
    if (!l) return null;
    return { id: l.id, fertig: l.ergebnisse.length, gesamt: l.gesamt, laeuft: !!laufend && laufend.id === l.id, fehler: l.fehler || null };
  }

  async function lauf() {
    const l = sp().analyseLauf;
    if (!l || laufend) return;
    const abbruch = { stop: false };
    laufend = { id: l.id, abbruch };
    melde("fortschritt", { id: l.id, fertig: l.ergebnisse.length, gesamt: l.gesamt });
    try {
      const eingabe = { startFen: l.startFen, zuege: l.zuege, farbe: l.farbe };
      const r = await analysiere(eingabe, {
        engine: getEngine(),
        movetime,
        start: l.ergebnisse.length,
        ergebnisse: l.ergebnisse,
        abbruch,
        onPosition: (res, fertig, gesamt) => {
          store.update((d) => {
            const x = d.spielen.analyseLauf;
            if (x && x.id === l.id) {
              x.ergebnisse.push(res);
              x.fehler = null;
            }
          });
          melde("fortschritt", { id: l.id, fertig, gesamt });
        },
      });
      if (r.fertig) {
        const e = analyseEintrag({ id: l.id, quelle: l.quelle, eingabe, ergebnisse: r.ergebnisse, datum: store.now().toISOString() });
        store.update((d) => {
          d.spielen.analysen.push(e);
          d.spielen.analyseLauf = null;
          if (nachAnalyse) nachAnalyse(d, e, r.ergebnisse);
        });
        melde("fertig", { id: l.id });
      }
    } catch (err) {
      const text = err && err.message ? err.message : "Die Analyse konnte nicht fortgesetzt werden.";
      store.update((d) => {
        if (d.spielen.analyseLauf && d.spielen.analyseLauf.id === l.id) d.spielen.analyseLauf.fehler = text;
      });
      melde("fehler", { id: l.id, text });
    } finally {
      laufend = null;
    }
  }

  // Startet die Analyse einer Partie (oder setzt eine unterbrochene fort). Gibt "fertig", "laeuft", "andere" oder "gestartet" zurück.
  function starte({ id, quelle = "partie", pgn = null, zuege = null, startFen = null, farbe }) {
    if (eintrag(id)) return "fertig";
    const alt = sp().analyseLauf;
    if (alt && alt.id !== id) return "andere";
    if (!alt) {
      const eingabe = leseEingabe({ pgn, zuege, startFen, farbe });
      store.update((d) => {
        d.spielen.analyseLauf = {
          id,
          quelle,
          startFen: eingabe.startFen,
          zuege: eingabe.zuege,
          farbe: eingabe.farbe,
          gesamt: stellungen(eingabe).length,
          ergebnisse: [],
          fehler: null,
          start: store.now().toISOString(),
        };
      });
    }
    if (laufend) return "laeuft";
    lauf();
    return "gestartet";
  }

  // Setzt eine unterbrochene Analyse fort (nach Neuladen, App-Wechsel oder Fehler).
  function fortsetzen() {
    if (sp().analyseLauf && !laufend) lauf();
  }

  // Verwirft die laufende Analyse.
  function abbrechen() {
    if (laufend) {
      laufend.abbruch.stop = true;
      try {
        getEngine().stop();
      } catch (err) {
        /* Engine nicht erreichbar */
      }
    }
    store.update((d) => {
      d.spielen.analyseLauf = null;
    });
    melde("abgebrochen");
  }

  return {
    eintrag,
    status,
    starte,
    fortsetzen,
    abbrechen,
    get laeuft() {
      return !!laufend;
    },
    auf(f) {
      hoerer.add(f);
      return () => hoerer.delete(f);
    },
    // für Tests: wartet, bis die laufende Analyse zu Ende ist
    async warteBisFertig() {
      while (laufend) await new Promise((r) => setTimeout(r, 5));
    },
  };
}

// Partien und Übungen (nicht Grundmatts) ohne fertigen Rückblick, neueste zuerst. Eine laufende Analyse zählt als offen.
export function offeneRueckblicke(spielen) {
  const fertig = new Set(spielen.analysen.map((a) => a.id));
  return [...spielen.partien, ...spielen.versuche]
    .filter((e) => (e.modus === "partie" || e.modus === "vorteil") && !fertig.has(e.id))
    .sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
}

// Die Analyse der App: Nach jeder fertigen Analyse werden Patzer und verpasste Chancen zu eigenen Rätseln.
export const rueckblick = createRueckblick({
  store: appStore,
  getEngine: appEngine,
  nachAnalyse: (d, e) => ausAnalyse(d, e, { today: dayKey(appStore.now()), nowIso: appStore.now().toISOString() }),
});
