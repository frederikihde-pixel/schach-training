import { addRoute, addRedirect, startRouter } from "./router.js";
import { onShowBrett } from "./pages/brett.js";
import { initInfo } from "./pages/mehr.js";
import { initDaten, onShowDaten } from "./pages/daten.js";
import { initTaktik, onShowTaktik } from "./pages/taktik.js";
import { initStatistik } from "./pages/statistik.js";
import { initFortschrittSeite, onShowFortschrittSeite } from "./pages/fortschritt-seite.js";
import { onShowThemen } from "./pages/themen.js";
import { onShowEinstellungen, initEinstellungen } from "./pages/einstellungen.js";
import { initSpielen, onShowSpielen } from "./pages/spielen.js";
import { initHeute, onShowHeute } from "./pages/heute.js";
import { initRueckblick } from "./pages/rueckblick.js";
import { initFortschritt } from "./pages/fortschritt.js";
import { rueckblick } from "./rueckblick.js";
import { initDesign } from "./design.js";
import { initEinfuehrung } from "./pages/einfuehrung.js";
import { store, requestPersistence } from "./storage.js";

// Hauptorte (untere Leiste): Heute, Taktik, Spielen, Fortschritt. Einstellungen über das Zahnrad.
addRoute("heute", { page: "page-heute", tab: "heute", title: "Heute", onShow: onShowHeute });
addRoute("taktik", { page: "page-taktik", tab: "taktik", title: "Taktik", onShow: onShowTaktik });
addRoute("taktik/themen", { page: "page-themen", tab: "taktik", title: "Themen", onShow: onShowThemen, parent: "taktik" });
addRoute("spielen", { page: "page-spielen", tab: "spielen", title: "Spielen", onShow: onShowSpielen });
addRoute("spielen/grundmatt", { page: "page-spielen", tab: "spielen", title: "Grundmatts üben", onShow: onShowSpielen, parent: "spielen" });
addRoute("spielen/vorteil", { page: "page-spielen", tab: "spielen", title: "Vorteil verwerten", onShow: onShowSpielen, parent: "spielen" });
addRoute("spielen/lauf", { page: "page-spielen", tab: "spielen", title: "Partie", onShow: onShowSpielen, parent: "spielen" });
addRoute("spielen/ende", { page: "page-spielen", tab: "spielen", title: "Ergebnis", onShow: onShowSpielen, parent: "spielen" });
addRoute("spielen/rueckblick", { page: "page-spielen", tab: "fortschritt", title: "Rückblick", onShow: onShowSpielen, prefix: true, parent: "fortschritt" });
addRoute("fortschritt", { page: "page-fortschritt", tab: "fortschritt", title: "Fortschritt", onShow: onShowFortschrittSeite });
// Einstellungen (Zahnrad) mit Unterseiten
addRoute("einstellungen", { page: "page-einstellungen", title: "Einstellungen", onShow: onShowEinstellungen });
addRoute("einstellungen/daten", { page: "page-daten", title: "Daten", onShow: onShowDaten, parent: "einstellungen" });
addRoute("einstellungen/brett", { page: "page-brett", title: "Freies Brett", onShow: onShowBrett, parent: "einstellungen" });
addRoute("einstellungen/info", { page: "page-info", title: "Info und Lizenzen", parent: "einstellungen" });

// Alte Adressen führen auf die neuen Orte
addRedirect("brett", "einstellungen/brett");
addRedirect("spielen/partie", "spielen");
addRedirect("taktik/statistik", "fortschritt");
addRedirect("spielen/fortschritt", "fortschritt");
addRedirect("spielen/liste", "fortschritt");
addRedirect("mehr", "einstellungen");
addRedirect("mehr/einstellungen", "einstellungen");
addRedirect("mehr/darstellung", "einstellungen");
addRedirect("mehr/daten", "einstellungen/daten");
addRedirect("mehr/info", "einstellungen/info");

store.get();
initDesign();
// Bei jedem Start anfragen, ob der Browser die Daten dauerhaft behalten soll.
requestPersistence().then((result) => {
  store.status.persistence = result;
  document.dispatchEvent(new CustomEvent("persistence-checked"));
});

initInfo();
initDaten();
initTaktik();
initSpielen();
initHeute();
initRueckblick();
initFortschritt();
initFortschrittSeite();
initStatistik();
initEinstellungen();
startRouter();
rueckblick.fortsetzen(); // eine unterbrochene Analyse (Neuladen, App-Wechsel) geht weiter
initEinfuehrung();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => document.dispatchEvent(new CustomEvent("sw-ready")))
      .catch(() => {
        /* ohne Service Worker läuft die App weiter, nur nicht offline */
      });
  });
}
