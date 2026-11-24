// Regeln der Startseite "Heute": Welcher Schritt wird vorgeschlagen? Reine Logik auf dem Speicherstand, kein DOM.
// Die Regeln stehen in docs/HEUTE.md. Der erste zutreffende Fall gilt:
//   0 etwas läuft (Sitzung, Einstufung, Standortbestimmung oder Partie)  -> Fortsetzen
//   a noch keine Einstufung                                            -> Einstufung starten
//   b fällige Wiederholungen oder eigene Fehler                         -> Sitzung starten (N fällig)
//   c ein Rückblick ist offen                                           -> Rückblick ansehen
//   d letzte Partie liegt 3 Tage oder länger zurück (oder keine)         -> Partie spielen
//   e Standortbestimmung nach 4 Wochen fällig                           -> Standortbestimmung
//   f sonst                                                             -> Sitzung starten

import { dayKey, dueCards } from "./leitner.js";
import { offeneRueckblicke } from "./rueckblick.js";
import { standortReminder } from "./storage.js";

export const PARTIE_PAUSE_TAGE = 3;
export const MAX_NEBENZEILEN = 2;

const tagNummer = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

// Tage seit der letzten Partie (Modus "partie"); null, wenn noch keine gespielt wurde.
export function tageSeitLetzterPartie(d, now) {
  const partien = d.spielen.partien.filter((p) => p.modus === "partie");
  if (!partien.length) return null;
  const letzte = partien.reduce((a, b) => (a.datum >= b.datum ? a : b));
  return tagNummer(dayKey(now)) - tagNummer(dayKey(new Date(letzte.datum)));
}

const mehrzahl = (n, eins, viele) => (n === 1 ? eins : viele);

// Gibt { fall, knopf, text, aktion, neben: [{ text, aktion }], zahlen } zurück.
// aktion: { typ, id? } mit typ "sitzung-fortsetzen", "partie-fortsetzen", "einstufung", "sitzung", "rueckblick", "partie", "standort".
export function naechsterSchritt(d, now = new Date()) {
  const heute = dayKey(now);
  const t = d.taktik;
  const faellig = dueCards(t.karten, heute);
  const eigeneFaellig = faellig.filter((c) => c.raetsel && c.raetsel.eigen).length;
  const offen = offeneRueckblicke(d.spielen);
  const tage = tageSeitLetzterPartie(d, now);
  const standortFaellig = standortReminder(d, now) !== null;
  const partieNoetig = tage === null || tage >= PARTIE_PAUSE_TAGE;
  const zahlen = { faellig: faellig.length, eigeneFaellig, offeneRueckblicke: offen.length, tageSeitPartie: tage, standortFaellig };

  const rueckblickAktion = { typ: "rueckblick", id: offen.length === 1 ? offen[0].id : offen.length ? offen[0].id : null };
  const alle = {
    sitzungFortsetzen: { fall: "fortsetzen", knopf: "Sitzung fortsetzen", text: "Du hast eine Sitzung angefangen. Mach dort weiter.", aktion: { typ: "sitzung-fortsetzen" } },
    partieFortsetzen: { fall: "fortsetzen", knopf: "Partie fortsetzen", text: "Du hast eine Partie angefangen. Mach dort weiter.", aktion: { typ: "partie-fortsetzen" } },
    einstufung: { fall: "a", knopf: "Einstufung starten", text: "Zehn Rätsel zeigen, wo du stehst. Danach passt sich alles an dich an.", aktion: { typ: "einstufung" } },
    faellig: {
      fall: "b",
      knopf: `Sitzung starten (${faellig.length} fällig)`,
      text: `${faellig.length} ${mehrzahl(faellig.length, "Wiederholung ist", "Wiederholungen sind")} fällig${eigeneFaellig ? `, ${eigeneFaellig} davon aus eigenen Fehlern` : ""}.`,
      aktion: { typ: "sitzung" },
    },
    rueckblick: {
      fall: "c",
      knopf: "Rückblick ansehen",
      text: offen.length === 1 ? "Eine Partie wartet auf ihren Rückblick. Er zeigt dir deine größten Fehler." : `${offen.length} Partien warten auf ihren Rückblick. Er zeigt dir deine größten Fehler.`,
      aktion: rueckblickAktion,
    },
    partie: {
      fall: "d",
      knopf: "Partie spielen",
      text: tage === null ? "Du hast noch keine Partie gespielt. Eine Partie zeigt, ob du das Gelernte auch im Spiel nutzt." : `Deine letzte Partie war vor ${tage} ${mehrzahl(tage, "Tag", "Tagen")}. Eine Partie hält dein Training im Spiel.`,
      aktion: { typ: "partie" },
    },
    standort: { fall: "e", knopf: "Standortbestimmung", text: "Deine letzte Standortbestimmung ist vier Wochen her. Sie zeigt deinen echten Fortschritt.", aktion: { typ: "standort" } },
    sitzung: { fall: "f", knopf: "Sitzung starten", text: "Heute ist nichts fällig. Eine kurze Sitzung mit neuen Rätseln hält dich in Übung.", aktion: { typ: "sitzung" } },
  };

  let haupt;
  if (t.aktiv) haupt = alle.sitzungFortsetzen;
  else if (d.spielen.aktiv) haupt = alle.partieFortsetzen;
  else if (!t.eingestuft) haupt = alle.einstufung;
  else if (faellig.length > 0) haupt = alle.faellig;
  else if (offen.length > 0) haupt = alle.rueckblick;
  else if (partieNoetig) haupt = alle.partie;
  else if (standortFaellig) haupt = alle.standort;
  else haupt = alle.sitzung;

  // Höchstens zwei ruhige Nebenzeilen, nie dasselbe wie der Hauptknopf. Reihenfolge: Rückblick, Standortbestimmung, Partie, Sitzung.
  const kandidaten = [];
  if (offen.length > 0) kandidaten.push({ fall: "c", text: `Rückblick offen: ${offen.length}`, aktion: rueckblickAktion });
  if (standortFaellig && t.eingestuft) kandidaten.push({ fall: "e", text: "Standortbestimmung ist fällig", aktion: { typ: "standort" } });
  if (t.eingestuft) kandidaten.push({ fall: "d", text: "Partie spielen", aktion: { typ: "partie" } });
  if (t.eingestuft) kandidaten.push({ fall: "f", text: "Sitzung starten", aktion: { typ: "sitzung" } });
  const neben = kandidaten.filter((k) => k.fall !== haupt.fall && !(haupt.fall === "b" && k.fall === "f")).slice(0, MAX_NEBENZEILEN).map(({ text, aktion }) => ({ text, aktion }));
  // Läuft etwas, ist die Fortsetzung der Hauptknopf; die Nebenzeilen bleiben dieselben.
  return { ...haupt, neben, zahlen };
}
