# Startseite "Heute": welcher Schritt wird vorgeschlagen?

Die Seite zeigt **einen** großen Hauptknopf mit einer kurzen Begründung darunter und höchstens zwei ruhige Nebenzeilen. Der Knopf startet den
Schritt direkt (ein Tipp). Es gibt keine Serien, keine Punkte, keine Auszeichnungen und keine Begrüßungseffekte.

Die Regeln stehen in `js/heute.js` (reine Logik) und werden mit `tests/unit/heute.test.mjs` und `tests/e2e/heute.cjs` geprüft.

## Der Hauptknopf

Der **erste zutreffende Fall** gilt:

| Fall | Bedingung | Knopf | Begründung (Beispiel) |
| --- | --- | --- | --- |
| 0 | Etwas läuft: eine Sitzung, Einstufung oder Standortbestimmung, oder eine Partie | "Sitzung fortsetzen" oder "Partie fortsetzen" | "Du hast eine Sitzung angefangen. Mach dort weiter." |
| a | Noch keine Einstufung | "Einstufung starten" | "Zehn Rätsel zeigen, wo du stehst ..." |
| b | Wiederholungen oder eigene Fehler sind fällig (Fälligkeit heute oder früher) | "Sitzung starten (N fällig)" | "3 Wiederholungen sind fällig, 1 davon aus eigenen Fehlern." |
| c | Ein Rückblick ist offen (Partie oder Vorteil-Übung ohne fertigen Rückblick, Grundmatts zählen nicht) | "Rückblick ansehen" | "Eine Partie wartet auf ihren Rückblick ..." |
| d | Die letzte Partie liegt 3 Tage oder länger zurück, oder es gab noch keine | "Partie spielen" | "Deine letzte Partie war vor 5 Tagen ..." |
| e | Die Standortbestimmung ist nach 4 Wochen fällig (28 Tage nach dem letzten Ergebnis; wer noch keine gemacht hat, wird nicht erinnert) | "Standortbestimmung" | "Deine letzte Standortbestimmung ist vier Wochen her ..." |
| f | Sonst | "Sitzung starten" | "Heute ist nichts fällig ..." |

Fall 0 ist die einzige Ergänzung zur ursprünglichen Reihenfolge a bis f: Läuft schon etwas, wäre ein neuer Start falsch.

Was der Knopf tut:
- Fortsetzen: macht dort weiter, wo du aufgehört hast.
- Einstufung, Sitzung: startet sofort (Sitzung mit 10 Rätseln und allen Themen; Länge und Thema lassen sich auf der Seite Taktik unter
  "Mehr Optionen" ändern).
- Rückblick: öffnet den neuesten offenen Rückblick (die Analyse startet dort, wenn sie noch nicht lief).
- Partie spielen: öffnet die Seite Spielen, dort genügt ein Tipp auf "Partie starten".
- Standortbestimmung: startet das Prüfset aus den Einstellungen (automatisch: nach Taktikstärke).

## Die Nebenzeilen

Höchstens zwei, nie dasselbe wie der Hauptknopf, in dieser Reihenfolge, nur wenn sie zutreffen:

1. "Rückblick offen: N" (wenn ein Rückblick offen ist)
2. "Standortbestimmung ist fällig" (Fall e trifft zu)
3. "Partie spielen"
4. "Sitzung starten" (nicht, wenn der Hauptknopf schon eine Sitzung startet)

Vor der Einstufung gibt es keine Nebenzeilen.

## Hinweise

- Fall e wird von Fall d verdeckt, solange du länger als 2 Tage nicht gespielt hast (so ist die Reihenfolge gewünscht). Die Erinnerung bleibt dann
  als Nebenzeile sichtbar, und auf der Seite Fortschritt steht der Knopf immer bereit.
- Alle Zahlen kommen aus den vorhandenen Daten; die Seite speichert nichts.
