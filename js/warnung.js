// Patzer-Warnung: Vor der Ausführung eines Zugs wird kurz geprüft, ob er eine Figur (ab Springer) kostenlos
// einstellt oder ein Matt in 1 erlaubt. Es gibt keinen Hinweis auf den besseren Zug.
//
// Ablauf: Aus den legalen Antworten des Gegners werden genaue Fälle bestimmt (Matt in 1; Schlagzug auf eine Figur
// ab Springer, auf die der Spieler danach nicht zurückschlagen kann). Bei einer freien Figur fragt die Engine
// kurz nach, ob der Gegner sie wirklich nehmen würde (Bestzug oder Bewertung deutlich über dem Ausgleich); so
// gibt es keinen Fehlalarm, wenn ein Zwischenzug oder Schach das Schlagen verbietet.

import { Chess } from "../vendor/chess.js/chess.js";
import { uciMove, scoreToCp } from "./engine.js";
import { WERT } from "./material.js";

export const WARN_TEXT_FIGUR = "Dabei kann der Computer etwas schlagen. Trotzdem ziehen?";
export const WARN_TEXT_MATT = "Dabei kann der Computer Matt setzen. Trotzdem ziehen?";
export const PRUEF_MS = 150;

// chess: Stellung NACH dem geplanten Zug des Spielers (der Gegner ist am Zug).
// Rückgabe: { matt: [uci], frei: [{ uci, square, type }] }
export function kandidaten(chess) {
  const spieler = chess.turn() === "w" ? "b" : "w";
  const matt = [];
  const frei = [];
  for (const m of chess.moves({ verbose: true })) {
    if (m.san.endsWith("#")) {
      matt.push(uciMove(m));
      continue;
    }
    if (!m.captured || WERT[m.captured] < 3) continue;
    const nachher = new Chess(chess.fen());
    nachher.move({ from: m.from, to: m.to, promotion: m.promotion });
    const zurueck = nachher.moves({ verbose: true }).some((r) => r.to === m.to && r.captured && r.color === spieler);
    if (!zurueck) frei.push({ uci: uciMove(m), square: m.to, type: m.captured });
  }
  return { matt, frei };
}

// engine: optional, mit setOptions und search wie js/engine.js. Gibt { warnen, art } zurück.
export async function pruefeZug(chessNachZug, engine = null) {
  const k = kandidaten(chessNachZug);
  if (k.matt.length) return { warnen: true, art: "matt", text: WARN_TEXT_MATT };
  if (!k.frei.length) return { warnen: false };
  if (engine) {
    try {
      await engine.setOptions({ UCI_LimitStrength: false, "Skill Level": 20 });
      const r = await engine.search({ fen: chessNachZug.fen(), movetime: PRUEF_MS, multipv: 1 });
      const bestFrei = k.frei.some((f) => f.uci === r.best);
      const cp = r.lines[0] ? scoreToCp(r.lines[0].score) : 0;
      // Der Gegner ist am Zug: Seine Bewertung muss deutlich über dem Ausgleich liegen.
      if (!bestFrei && cp < 150) return { warnen: false };
    } catch (err) {
      /* Engine nicht verfügbar: die genaue Prüfung gilt allein */
    }
  }
  return { warnen: true, art: "figur", text: WARN_TEXT_FIGUR, frei: k.frei };
}
