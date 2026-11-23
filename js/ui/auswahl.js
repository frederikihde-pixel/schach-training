// Gruppe großer Schalter (statt eines Auswahlfelds): genau einer ist gewählt, jeder ist mindestens 44 px hoch.
// optionen: [{ wert, text, label?, zusatz? }]; Rückgabe: { get(), set(wert) }.

export function baueAuswahl(container, optionen, { wert = null, onChange = () => {} } = {}) {
  let aktuell = wert;
  const knoepfe = new Map();
  container.innerHTML = "";
  const markiere = () => {
    for (const [w, b] of knoepfe) b.setAttribute("aria-pressed", String(w === aktuell));
  };
  for (const o of optionen) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice mittig";
    b.dataset.wert = String(o.wert);
    if (o.label) b.setAttribute("aria-label", o.label);
    const t = document.createElement("strong");
    t.textContent = o.text;
    b.append(t);
    if (o.zusatz) {
      const z = document.createElement("span");
      z.className = "muted";
      z.textContent = o.zusatz;
      b.append(z);
    }
    b.addEventListener("click", () => {
      aktuell = o.wert;
      markiere();
      onChange(aktuell);
    });
    knoepfe.set(o.wert, b);
    container.append(b);
  }
  markiere();
  return {
    get: () => aktuell,
    set(w) {
      aktuell = w;
      markiere();
    },
  };
}
