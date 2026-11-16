// Seite "Mehr > Darstellung": drei Brett-Designs mit Vorschau. Die Vorschau ist ein echtes
// (nur angezeigtes) Chessground-Brett mit denselben Farben wie die Spielbretter.
import { Chessground } from "../../vendor/chessground/chessground.min.js";
import { DESIGNS, DESIGN_IDS, applyDesign } from "../board-designs.js";
import { currentDesign, setDesign } from "../design.js";

const $ = (id) => document.getElementById(id);

// Schwarz und Weiß auf hellen und dunklen Feldern, letzter Zug auf einem hellen und einem
// dunklen Feld, gewähltes Feld mit Zielpunkten und einem Schlagring, König im Schach.
const PREVIEW = {
  fen: "r3k3/5p2/3q4/8/2B1Q3/8/5R2/4K3",
  lastMove: ["f1", "f2"],
  selected: "c4",
  dests: new Map([["c4", ["d5", "e6", "f7", "b5", "a6", "b3", "a2", "d3", "e2"]]]),
};

let built = false;

function previewBoard(el, id) {
  applyDesign(el, id);
  Chessground(el.firstElementChild, {
    fen: PREVIEW.fen,
    viewOnly: true,
    coordinates: false,
    animation: { enabled: false },
    lastMove: PREVIEW.lastMove,
    check: "black",
    turnColor: "white",
    selected: PREVIEW.selected,
    highlight: { lastMove: true, check: true },
    movable: { free: false, color: "white", dests: PREVIEW.dests, showDests: true },
  });
}

function build() {
  const list = $("design-liste");
  list.innerHTML = "";
  for (const id of DESIGN_IDS) {
    const design = DESIGNS[id];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "design-card";
    card.dataset.design = id;

    const preview = document.createElement("div");
    preview.className = "design-preview";
    preview.append(document.createElement("div"));

    const text = document.createElement("span");
    text.className = "design-text";
    const name = document.createElement("strong");
    name.textContent = design.name;
    const info = document.createElement("span");
    info.className = "muted";
    info.textContent = design.beschreibung;
    const status = document.createElement("span");
    status.className = "design-status";
    text.append(name, info, status);

    card.append(preview, text);
    card.addEventListener("click", () => {
      setDesign(id);
      mark();
    });
    list.append(card);
    previewBoard(preview, id);
  }
  built = true;
}

function mark() {
  const active = currentDesign();
  for (const card of $("design-liste").children) {
    const on = card.dataset.design === active;
    card.setAttribute("aria-pressed", String(on));
    card.querySelector(".design-status").textContent = on ? "Gewählt" : "";
  }
}

export function onShowDarstellung() {
  if (!built) build();
  mark();
}
