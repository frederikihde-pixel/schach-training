// Deutsche Namen und kurze Erklärungen der Rätsel-Themen (Lichess-Schlagworte).

const NAMES = {
  fork: "Gabel",
  pin: "Fesselung",
  skewer: "Spieß",
  discoveredAttack: "Abzugsangriff",
  doubleCheck: "Doppelschach",
  deflection: "Ablenkung",
  attraction: "Anziehung",
  interference: "Unterbrechung",
  intermezzo: "Zwischenzug",
  quietMove: "Stiller Zug",
  clearance: "Räumung",
  capturingDefender: "Verteidiger schlagen",
  xRayAttack: "Röntgenangriff",
  zugzwang: "Zugzwang",
  sacrifice: "Opfer",
  hangingPiece: "Ungedeckte Figur",
  trappedPiece: "Gefangene Figur",
  exposedKing: "Ungeschützter König",
  defensiveMove: "Verteidigungszug",
  kingsideAttack: "Angriff am Königsflügel",
  queensideAttack: "Angriff am Damenflügel",
  attackingF2F7: "Angriff auf f2 und f7",
  advancedPawn: "Vorgerückter Bauer",
  promotion: "Umwandlung",
  underPromotion: "Unterverwandlung",
  enPassant: "En passant",
  castling: "Rochade",
  mateIn1: "Matt in 1",
  mateIn2: "Matt in 2",
  mateIn3: "Matt in 3",
  mateIn4: "Matt in 4",
  mateIn5: "Matt in 5",
  backRankMate: "Grundreihenmatt",
  smotheredMate: "Erstickungsmatt",
  anastasiaMate: "Anastasia-Matt",
  arabianMate: "Arabisches Matt",
  bodenMate: "Boden-Matt",
  doubleBishopMate: "Matt mit zwei Läufern",
  dovetailMate: "Schwalbenschwanz-Matt",
  hookMate: "Haken-Matt",
  opening: "Eröffnung",
  middlegame: "Mittelspiel",
  endgame: "Endspiel",
  pawnEndgame: "Bauernendspiel",
  rookEndgame: "Turmendspiel",
  bishopEndgame: "Läuferendspiel",
  knightEndgame: "Springerendspiel",
  queenEndgame: "Damenendspiel",
  queenRookEndgame: "Dame-und-Turm-Endspiel",
};

export function themeLabel(tag) {
  return NAMES[tag] || tag;
}

export function allThemes() {
  return Object.keys(NAMES);
}

// Ein Satz je Thema, in einfachem Deutsch.
const INFO = {
  fork: "Eine Figur greift gleichzeitig zwei gegnerische Figuren an. Der Gegner kann nur eine davon retten.",
  pin: "Eine Figur kann nicht wegziehen, weil dahinter eine wertvollere Figur steht, zum Beispiel der König.",
  skewer: "Eine wertvolle Figur wird angegriffen und muss ausweichen, danach wird die Figur dahinter geschlagen.",
  discoveredAttack: "Eine Figur zieht weg und gibt dadurch den Angriff einer anderen Figur dahinter frei.",
  doubleCheck: "Zwei Figuren geben gleichzeitig Schach. Der König muss ziehen.",
  deflection: "Eine verteidigende Figur wird von ihrer Aufgabe weggelockt, damit etwas anderes ungeschützt ist.",
  attraction: "Eine gegnerische Figur, oft der König, wird auf ein bestimmtes Feld gelockt.",
  interference: "Du stellst eine Figur zwischen zwei gegnerische Figuren und unterbrichst ihre Verbindung.",
  intermezzo: "Statt des erwarteten Zugs kommt erst ein anderer Zug mit einer Drohung dazwischen.",
  quietMove: "Ein ruhiger Zug ohne Schlagen und ohne Schach, der trotzdem eine starke Drohung vorbereitet.",
  clearance: "Eine eigene Figur zieht weg, damit ein Feld oder eine Linie für eine andere Figur frei wird.",
  capturingDefender: "Die Figur, die etwas verteidigt, wird geschlagen, damit das Ziel ungedeckt bleibt.",
  xRayAttack: "Eine Figur wirkt durch eine andere Figur hindurch auf ein Feld dahinter.",
  zugzwang: "Der Gegner muss ziehen, aber jeder mögliche Zug verschlechtert seine Stellung.",
  sacrifice: "Du gibst absichtlich Material her, um danach mehr zu gewinnen oder Matt zu setzen.",
  hangingPiece: "Eine Figur steht ungedeckt und kann einfach geschlagen werden, ohne dass der Gegner etwas zurückschlagen kann.",
  trappedPiece: "Eine Figur hat keinen sicheren Zug mehr und geht verloren.",
  exposedKing: "Der König hat kaum Schutz und kann direkt angegriffen werden.",
  defensiveMove: "Du musst eine Drohung des Gegners abwehren, oft gibt es dafür nur einen genauen Zug.",
  kingsideAttack: "Ein Angriff auf den König, der auf der Königsseite steht (rechts vom Weißen aus gesehen).",
  queensideAttack: "Ein Angriff auf den König, der auf der Damenseite steht (links vom Weißen aus gesehen).",
  attackingF2F7: "Ein Angriff auf f2 oder f7. Diese Felder neben dem Anfangsfeld des Königs sind nur vom König selbst gedeckt.",
  advancedPawn: "Ein Bauer ist weit vorgerückt und droht, sich umzuwandeln.",
  promotion: "Ein Bauer erreicht die letzte Reihe und wird zu einer anderen Figur, meistens zur Dame.",
  underPromotion: "Ein Bauer wird nicht zur Dame, sondern zu Turm, Läufer oder Springer.",
  enPassant: "Ein Bauer schlägt einen gegnerischen Bauern, der gerade zwei Felder vorgerückt ist, im Vorbeigehen.",
  castling: "Die Rochade ist hier wichtig: König und Turm ziehen gemeinsam.",
  mateIn1: "Mit einem einzigen Zug setzt du den Gegner schachmatt.",
  mateIn2: "Du setzt in zwei Zügen Matt, egal wie der Gegner antwortet.",
  mateIn3: "Du setzt in drei Zügen Matt, egal wie der Gegner antwortet.",
  mateIn4: "Du setzt in vier Zügen Matt, egal wie der Gegner antwortet.",
  mateIn5: "Du setzt in fünf Zügen Matt, egal wie der Gegner antwortet.",
  backRankMate: "Der König steht auf der Grundreihe und wird von den eigenen Bauern eingesperrt. Ein Turm oder eine Dame setzt dort Matt.",
  smotheredMate: "Ein Springer setzt Matt, weil der König von seinen eigenen Figuren eingeschlossen ist.",
  anastasiaMate: "Ein Springer und ein Turm setzen am Brettrand Matt, der König wird von eigenen Figuren und dem Rand eingesperrt.",
  arabianMate: "Ein Turm und ein Springer setzen in der Brettecke Matt.",
  bodenMate: "Zwei Läufer setzen auf sich kreuzenden Diagonalen Matt, der König wird von eigenen Figuren eingesperrt.",
  doubleBishopMate: "Zwei Läufer setzen zusammen Matt.",
  dovetailMate: "Die Dame setzt direkt vor dem König Matt, seine Fluchtfelder sind durch eigene Figuren blockiert.",
  hookMate: "Ein Turm, ein Springer und ein Bauer setzen zusammen Matt.",
  opening: "Die Aufgabe kommt aus den ersten Zügen einer Partie.",
  middlegame: "Die Aufgabe kommt aus dem Mittelspiel, wenn noch viele Figuren auf dem Brett stehen.",
  endgame: "Die Aufgabe kommt aus dem Endspiel, wenn nur noch wenige Figuren auf dem Brett stehen.",
  pawnEndgame: "Ein Endspiel mit nur Königen und Bauern.",
  rookEndgame: "Ein Endspiel mit Türmen (und Bauern).",
  bishopEndgame: "Ein Endspiel mit Läufern (und Bauern).",
  knightEndgame: "Ein Endspiel mit Springern (und Bauern).",
  queenEndgame: "Ein Endspiel mit Damen (und Bauern).",
  queenRookEndgame: "Ein Endspiel mit Damen und Türmen.",
};

export function themeInfo(tag) {
  return INFO[tag] || "";
}

// Diese Themen stehen für Einsteiger oben (in dieser Reihenfolge, leicht nach schwer).
export const BEGINNER_THEMES = [
  "mateIn1", "hangingPiece", "fork", "pin", "mateIn2", "skewer",
  "backRankMate", "discoveredAttack", "trappedPiece", "deflection",
];

// Alle Themen: zuerst die Einsteiger-Themen, danach der Rest alphabetisch.
export function orderedThemes() {
  const rest = allThemes()
    .filter((t) => !BEGINNER_THEMES.includes(t))
    .sort((a, b) => themeLabel(a).localeCompare(themeLabel(b), "de"));
  return [...BEGINNER_THEMES, ...rest];
}
