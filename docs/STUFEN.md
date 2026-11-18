# Stärkestufen des Computergegners (Stufenversion 1)

Die Stufen stehen in `js/stufen.js`. Ihre Werte sind **fest**. Jede gespeicherte Partie merkt sich
die Stufenversion, damit Ergebnisse vergleichbar bleiben. Wer etwas ändert, erhöht
`STUFENVERSION` und trägt hier die neue Version ein; alte Partien behalten ihre Version.

## Warum es zwei Arten von Stufen gibt

Die Engine (Stockfish 19, "lite") kann ihre Stärke selbst begrenzen (`UCI_LimitStrength` und
`UCI_Elo`). Aber ihr `UCI_Elo` beginnt bei **1320** und ist auf Menschen mit Wertung um 1300 und
mehr ausgelegt. Für einen Anfänger mit etwa 440 Chess.com-Punkten ist das zu stark. Deshalb gilt:

- **Stufe 4 bis 7:** `UCI_LimitStrength` an und `UCI_Elo` 1320, 1500, 1800, 2200 (innerhalb des von der
  Engine gemeldeten Bereichs 1320 bis 3190), kurze feste Bedenkzeit.
- **Stufe 8:** volle Stärke der kleinen Engine, 0,6 Sekunden Suchzeit.
- **Stufe 1 bis 3 (ausdrücklich für Anfänger):** unterhalb des Minimums. Die Engine spielt mit
  `Skill Level` (0, 2, 5), sehr kleiner Suche und bekommt eine **eigene Fehlerquote**: Wir fragen
  mehrere Kandidatenzüge ab (MultiPV) und wählen mit gewichtetem Zufall, auch schlechtere. Ein Teil der Züge ist
  ganz zufällig (aus allen legalen Zügen). Ein gefundenes Matt in 1 wird nur mit einer festen Chance gespielt.

Die Suche der Stufen 1 bis 3 ist über die **Knotenzahl** begrenzt, nicht über die Zeit. So spielt eine
Stufe auf einem schnellen und einem langsamen Handy gleich stark. Die angezeigte Bedenkzeit
("Computer denkt", 0,5 bis 2 Sekunden) ist nur die kürzeste Wartezeit, damit Züge nicht blitzartig kommen.

## Die Werte

| Stufe | Art | Einstellung | Fehlerlogik | Anzeige min. | Richtwert* |
| --- | --- | --- | --- | --- | --- |
| 1 | Fehler | Skill 0, 150 Knoten, 8 Kandidaten | Gewichte 2/2/2/2/2/2/2/2, 30 % ganz zufälliger Zug, Matt in 1 nur zu 35 % | 0,5 s | ungefähr 200 |
| 2 | Fehler | Skill 2, 800 Knoten, 5 Kandidaten | Gewichte 8/4/3/2/1, 8 % zufällig, Matt in 1 zu 75 % | 0,7 s | ungefähr 400 |
| 3 | Fehler | Skill 5, 1000 Knoten, 4 Kandidaten | Gewichte 11/5/3/1, 6 % zufällig, Matt in 1 zu 90 % | 0,9 s | ungefähr 650 |
| 4 | Elo | UCI_Elo 1320, 150 ms | Engine-Begrenzung | 1,1 s | ungefähr 900 |
| 5 | Elo | UCI_Elo 1500, 200 ms | Engine-Begrenzung | 1,3 s | ungefähr 1150 |
| 6 | Elo | UCI_Elo 1800, 300 ms | Engine-Begrenzung | 1,5 s | ungefähr 1450 |
| 7 | Elo | UCI_Elo 2200, 400 ms | Engine-Begrenzung | 1,7 s | ungefähr 1800 |
| 8 | Voll | keine Begrenzung, 600 ms | keine | 2,0 s | über 2200 |

\* **Richtwert = meine Schätzung, nicht gemessen gegen Menschen.** Siehe unten "Was die Zahlen nicht sagen".

Startvorschlag zur eigenen Chess.com-Wertung (Feld "Meine Chess.com-Wertung", nur lokal gespeichert):
die höchste Stufe, deren Richtwert nicht über der Wertung liegt. Bei 440 ist das Stufe 2.
Nach zwei bis drei Partien soll die Stufe angepasst werden ("Zu leicht oder zu schwer?").

## Messung (Stufenversion 1)

`tests/e2e/stufen-staerke.cjs`: alle Stufen spielen mit der echten Engine im Chromium gegeneinander und
gegen einen Zufallsspieler (jeder Zug gleichverteilt aus allen legalen Zügen). Je Paarung 12 Partien, je 6 mit
jeder Farbe, höchstens 120 Halbzüge, danach Wertung nach Material (Unterschied mindestens 3 Bauerneinheiten,
sonst Remis). Die Rohdaten stehen in `tests/stufen-messung.json`. Messung vom 18.11.2026, 168 Partien in 7,6 Minuten.

Ergebnis (Punkte aus 12 Partien, Sieg 1, Remis 0,5):

| Paarung | Punkte |
| --- | --- |
| Stufe 8 gegen Zufall, Stufe 3 gegen Zufall, Stufe 2 gegen Zufall, Stufe 1 gegen Zufall | je 12 zu 0 |
| Stufe 1 gegen Stufe 2 | 0 zu 12 |
| Stufe 2 gegen Stufe 3 | 2,5 zu 9,5 |
| Stufe 3 gegen Stufe 4 | 4 zu 8 |
| Stufe 4 gegen Stufe 5 | 3 zu 9 |
| Stufe 5 gegen Stufe 6 | 3 zu 9 |
| Stufe 6 gegen Stufe 7 | 4,5 zu 7,5 |
| Stufe 7 gegen Stufe 8 | 0 zu 12 |
| Stufe 1 gegen Stufe 3, Stufe 1 gegen Stufe 8, Stufe 3 gegen Stufe 8 | 0 zu 12 (die höhere Stufe gewinnt immer) |

Material und Fehler (alle Partien zusammen):

| Spieler | Figur ungedeckt angegriffen nach eigenem Zug | Matt in 1 verpasst | Verlorenes Material je Partie |
| --- | --- | --- | --- |
| Stufe 1 | 17,6 % | 8 von 18 | 22,9 |
| Stufe 2 | 10,7 % | 3 von 29 | 14,3 |
| Stufe 3 | 11,6 % | 3 von 36 | 17,3 |
| Stufe 8 | 8,7 % | 0 von 48 | 8,5 |
| Zufall | 28,7 % | 0 von 0 | 22,8 |

**Stufe 1 verliert Material, das Stufe 8 nicht verliert:** 22,9 gegen 8,5 Bauerneinheiten je Partie; sie stellt doppelt
so oft eine Figur ungedeckt ein (17,6 gegen 8,7 Prozent der Züge) und übersieht Matt in 1 in fast jedem zweiten Fall
(Stufe 8 nie). ("Ungedeckt angegriffen" heißt: Eine Figur ab Springer steht nach dem eigenen Zug ungedeckt im Angriff und
kann legal geschlagen werden.)

### Was die Messung ehrlich zeigt und was nicht

- Die Reihenfolge der Stufen stimmt (jede Stufe schlägt ihren Vorgänger), die Abstände sind aber nicht gleich groß.
  **Stufe 3 und 4 liegen eng beieinander** (4 zu 8): Stufe 4 ist die schwächste Einstellung der Engine-Begrenzung und
  spielt etwas stärker als meine Stufe 3. Stufe 5 und 6 sowie 6 und 7 liegen ebenfalls nah beieinander; mit 12 Partien
  ist der Zufall groß.
- Bei kurzer Bedenkzeit spielt `UCI_Elo` deutlich schwächer, als der Nennwert sagt. Der Nennwert ist
  kein Chess.com-Wert und gilt für lange Bedenkzeiten.
- Die Stufen 4 bis 7 übersehen manchmal ein Matt in 1 (Stufe 6: 18 von 30). Das ist eine Eigenart der
  Engine-Begrenzung, die absichtlich zufällige Züge einbaut. Stufe 8 tut das nie.
- Die Messung zeigt nur: stärker oder schwächer **gegeneinander**. Wie stark eine Stufe für einen Menschen
  ist, wurde nicht gemessen. Die Richtwerte sind eine Schätzung, damit du einen Startpunkt hast.
- Das Ergebnis hängt vom Gerät: Die Stufen 1 bis 3 sind wegen der Knotenzahl geräteunabhängig, die Stufen 4 bis 8
  haben feste Zeiten und spielen auf einem langsamen Handy schwächer als im Test (Chromium am PC).

## Was die Zahlen nicht sagen

Der Computer spielt anders als Menschen: Er gibt auf Stufe 1 bis 3 gelegentlich ganz zufällige Züge ab, auf den
höheren Stufen spielt er aber sehr genau und sieht Drohungen, die ein Mensch erst nach Jahren übersieht. Die
Anzeige "ungefähr 650" bedeutet nicht, dass du gegen einen Menschen mit Wertung 650 spielst.
