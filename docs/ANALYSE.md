# Analyse und Rückblick (Analyseversion 1)

Die Analyse steht in `js/analyse.js` (Rechenlogik und Ablauf, ohne Oberfläche) und `js/rueckblick.js`
(Steuerung: starten, speichern, fortsetzen). Sie ist von der Quelle unabhängig: Eingabe sind ein PGN oder Züge und die
Farbe des Spielers. So lässt sie sich später für Partien von Chess.com wiederverwenden.

## Ablauf

1. Jede Stellung der Partie (vor dem ersten Zug bis nach dem letzten) wird nacheinander von der Engine gesucht:
   **0,3 Sekunden je Stellung**. Stellungen, in denen der Spieler am Zug ist, mit **MultiPV 3** (die drei besten
   Züge), alle anderen mit MultiPV 1. Endstellungen (Matt, Remis) brauchen keine Suche.
2. Nach jeder Stellung wird gespeichert (`spielen.analyseLauf`). Nach App-Wechsel oder Neuladen geht es bei der
   nächsten fehlenden Stellung weiter. Angezeigt wird "Stellung 23 von 80".
3. Am Ende wird für jeden Zug des Spielers der Bewertungsverlust berechnet und das Ergebnis gespeichert
   (`spielen.analysen`, höchstens 50): Verlust in Centipawn, Art, Zugnummer, Spielphase, bei angezeigten Zügen auch der
   bessere Zug und die Erklärung.

## Bewertung und Schwellen

- Bewertungen werden auf **plus/minus 1000 Centipawn begrenzt** (100 Centipawn = eine Bauerneinheit). Ein Matt zählt
  als 1000. So entstehen in schon gewonnenen oder verlorenen Stellungen keine Scheinfehler (zum Beispiel
  "+30 statt +20 Bauern").
- **Verlust** eines Zugs = beste Bewertung der Stellung minus Bewertung nach dem gespielten Zug, aus Sicht des Spielers.
  Ist der gespielte Zug unter den drei besten Zügen, zählt seine Bewertung aus derselben Suche, sonst die (umgedrehte)
  Bewertung der Folgestellung.
- **Patzer:** Verlust ab 300, und die Stellung ist danach schlechter als minus 150.
- **Verpasste Chance:** Verlust ab 300 (der beste Zug hätte mindestens 300 mehr gebracht, zum Beispiel ein Matt oder eine
  freie Figur), aber die Stellung ist danach nicht schlechter als minus 150. Der Zug selbst war also kein Patzer, es wurde
  etwas Großes übersehen.
- **Fehler:** Verlust 150 bis 299.
- **Ungenauigkeiten** (unter 150) werden nicht angezeigt.

Spielphase (für die Statistik): **Eröffnung** bis Zug 10, danach **Endspiel**, wenn auf dem Brett höchstens 6 Figuren
(ohne Könige und Bauern, beide Seiten zusammen) stehen, sonst **Mittelspiel**.

Art der Ursache (für die Statistik): Matt erlaubt; Figur eingestellt (der Spieler hat nach dem Zug eine ungedeckte
angegriffene Figur ab Springer, die vorher nicht in Gefahr war); Drohung übersehen (eine schon ungedeckt angegriffene
Figur bleibt stehen); verpasste Chance; sonstig. In der Fortschrittsanzeige zählen "Matt erlaubt" und "Drohung übersehen"
zusammen als "Drohung übersehen".

## Erklärungen (einfaches Deutsch, ohne Engine-Wörter)

Reihenfolge, die erste passende gilt:

1. Gegner hat danach Matt: "Das erlaubte Matt in N."
2. Eine Figur des Spielers ist danach ungedeckt angegriffen: "Die Dame auf d5 war danach ungedeckt und konnte geschlagen werden."
3. Der Spieler hatte ein Matt: "Hier gab es Matt in N."
4. Sonst: "Dieser Zug verlor etwa 2,5 Bauerneinheiten, besser war Zug Sf3." (deutsche Figurbuchstaben)

## Wie genau ist das? (ehrlich)

Die Analyse läuft mit einer **kleinen Engine auf dem Handy** und nur 0,3 Sekunden je Stellung.

- **Grobe Fehler werden zuverlässig erkannt:** eingestellte Figuren, übersehene Mattdrohungen, übersehene freie Figuren
  und Matts. Das sind die Fehler, die bei Spielern um 440 Punkte fast alle verlorenen Partien entscheiden.
- **Kleine Unterschiede werden nur ungefähr erkannt.** Ob ein Zug 120 oder 180 Centipawn verliert, hängt von der kurzen
  Suche ab. Gemessen am selben Beispiel (80 Halbzüge): Bei 0,15 Sekunden zeigte die Analyse 2 Fehler, bei 0,3 Sekunden 4
  und bei 0,6 Sekunden 6; die Zahl der Patzer blieb mit 1 gleich. Darum sind die Fehler (150 bis 299) mit Vorsicht zu lesen
  und die Patzer und verpassten Chancen verlässlicher.
- Der "bessere Zug" ist der beste Zug der Engine in dieser kurzen Suche, nicht unbedingt der einzige gute.
- Sie bewertet ohne Eröffnungsbuch und ohne Endspieltabellen.

## Messung der Dauer (Chromium, 18.11.2026)

`tests/e2e/analyse-dauer.cjs`, Rohdaten `tests/analyse-messung.json`. Beispielpartie mit 40 Zügen (80 Halbzüge, 81
Stellungen), Stufe 5 gegen Stufe 5 mit festem Zufallsstartwert.

| Suchzeit | Gesamt | je Stellung |
| --- | --- | --- |
| 0,15 s | 11,9 s | 147 ms |
| **0,3 s (Standard)** | **23,2 s** | **287 ms** |
| 0,6 s | 46,0 s | 568 ms |

Engine-Start: 0,3 Sekunden. Zum Vergleich feste Tiefe: Tiefe 10 etwa 10 ms, Tiefe 12 etwa 22 ms je Stellung (PC), im
Mittel erreicht die Engine bei 0,3 Sekunden Tiefe 37 (in einfachen Endspielen sehr viel mehr).

**Schätzung für ein durchschnittliches Handy:** Die Suchzeit ist fest (0,3 s je Stellung); ein langsameres Handy
sucht in der Zeit nur weniger tief, braucht aber nicht länger. Dazu kommen Engine-Start (etwa 1 bis 3 Sekunden) und
etwas Verwaltung je Stellung. Erwartet werden etwa **30 bis 40 Sekunden** für 80 Stellungen, selbst bei doppelt so hohem
Aufwand je Stellung unter 60 Sekunden. Das liegt deutlich unter den vorgegebenen 90 Sekunden. **Darum ist die Suchzeit
nicht einstellbar** (Standard 0,3 Sekunden). Ob die Schätzung stimmt, zeigt der Test auf dem echten Handy
(`docs/STATUS.md`); stimmt sie nicht, wird die Suchzeit einstellbar (schnell 0,15 s, normal 0,3 s, genau 0,6 s; Standard
normal).
