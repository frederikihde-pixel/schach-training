// Umwandlungsauswahl (Dame, Turm, Läufer, Springer) als Fenster über der Seite.
// Wird vom Brett und vom Taktik-Trainer gemeinsam benutzt.

const PROMOTION_PIECES = [
  { code: "q", role: "queen", label: "Dame" },
  { code: "r", role: "rook", label: "Turm" },
  { code: "b", role: "bishop", label: "Läufer" },
  { code: "n", role: "knight", label: "Springer" },
];

export function askPromotion(color, onChoose) {
  const overlay = document.getElementById("promotion-overlay");
  const choices = document.getElementById("promotion-choices");
  choices.innerHTML = "";
  for (const piece of PROMOTION_PIECES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "promo-btn";
    btn.innerHTML =
      `<span class="cg-wrap promo-piece"><piece class="${piece.role} ${color}"></piece></span>` +
      `<span class="promo-label">${piece.label}</span>`;
    btn.addEventListener("click", () => {
      overlay.hidden = true;
      onChoose(piece.code);
    });
    choices.appendChild(btn);
  }
  overlay.hidden = false;
}
