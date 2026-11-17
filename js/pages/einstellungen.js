// Seite "Mehr > Einstellungen": bisher nur der Schalter für die Denkhilfe.
import { store } from "../storage.js";

const $ = (id) => document.getElementById(id);

function render() {
  const on = store.get().einstellungen.denkhilfe;
  const button = $("set-denkhilfe");
  button.setAttribute("aria-checked", String(on));
  button.textContent = on ? "Denkhilfe: an" : "Denkhilfe: aus";
}

export function onShowEinstellungen() {
  render();
}

export function initEinstellungen() {
  $("set-denkhilfe").addEventListener("click", () => {
    store.update((d) => {
      d.einstellungen.denkhilfe = !d.einstellungen.denkhilfe;
    });
    render();
  });
  document.addEventListener("daten-geaendert", render);
}
