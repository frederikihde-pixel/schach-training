// Deutsche Namen der Rätsel-Themen (Lichess-Schlagworte).

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
