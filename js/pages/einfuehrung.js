// Einführung: sechs kurze Seiten zum Wischen oder mit "Weiter". Erscheint beim ersten Start
// (nur für neue Nutzer) und ist unter "Mehr" jederzeit wieder aufrufbar. Überspringen und Fertig
// zählen als gesehen.
import { store } from "../storage.js";

const $ = (id) => document.getElementById(id);
let opener = null;

function slides() {
  return $("intro-slides");
}

function count() {
  return slides().children.length;
}

function index() {
  const el = slides();
  return Math.max(0, Math.min(count() - 1, Math.round(el.scrollLeft / el.clientWidth)));
}

function render() {
  const i = index();
  $("intro-seite").textContent = `Seite ${i + 1} von ${count()}`;
  $("intro-zurueck").disabled = i === 0;
  $("intro-weiter").textContent = i === count() - 1 ? "Fertig" : "Weiter";
}

function goTo(i) {
  const el = slides();
  el.scrollTo({ left: i * el.clientWidth, behavior: "auto" });
  render();
}

function markSeen() {
  if (!store.get().einstellungen.einfuehrungGesehen) {
    store.update((d) => {
      d.einstellungen.einfuehrungGesehen = true;
    });
  }
}

export function closeIntro() {
  markSeen();
  $("intro").hidden = true;
  document.body.classList.remove("intro-open");
  if (opener && opener.focus) opener.focus();
  opener = null;
}

export function openIntro() {
  opener = document.activeElement;
  $("intro").hidden = false;
  document.body.classList.add("intro-open");
  slides().scrollLeft = 0;
  render();
  $("intro-weiter").focus();
}

export function initEinfuehrung() {
  slides().addEventListener("scroll", render, { passive: true });
  $("intro-weiter").addEventListener("click", () => {
    const i = index();
    if (i >= count() - 1) closeIntro();
    else goTo(i + 1);
  });
  $("intro-zurueck").addEventListener("click", () => goTo(Math.max(0, index() - 1)));
  $("intro-ueberspringen").addEventListener("click", closeIntro);
  document.addEventListener("keydown", (e) => {
    if ($("intro").hidden) return;
    if (e.key === "Escape") closeIntro();
    else if (e.key === "ArrowRight") $("intro-weiter").click();
    else if (e.key === "ArrowLeft") $("intro-zurueck").click();
  });
  $("btn-einfuehrung").addEventListener("click", openIntro);

  // Beim ersten Start automatisch zeigen (bisherige Nutzer haben die Einführung per Migration als gesehen).
  if (!store.get().einstellungen.einfuehrungGesehen) openIntro();
}
