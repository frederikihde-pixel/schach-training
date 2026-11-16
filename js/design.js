// Brett-Design der App: aus dem Speicher lesen, anwenden, ändern. Gilt für alle Bretter.
import { store } from "./storage.js";
import { applyDesign, resolveDesign } from "./board-designs.js";

export function currentDesign() {
  return resolveDesign(store.get().einstellungen.brettDesign);
}

export function initDesign() {
  applyDesign(document.documentElement, currentDesign());
}

export function setDesign(id) {
  const design = resolveDesign(id);
  store.update((d) => {
    d.einstellungen.brettDesign = design;
  });
  applyDesign(document.documentElement, design);
  document.dispatchEvent(new CustomEvent("design-geaendert", { detail: design }));
}
