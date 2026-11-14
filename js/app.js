import { addRoute, startRouter } from "./router.js";
import "./pages/brett.js";
import { initInfo } from "./pages/mehr.js";
import { initDaten, onShowDaten } from "./pages/daten.js";
import { initTaktik, onShowTaktik } from "./pages/taktik.js";
import { initStatistik, onShowStatistik } from "./pages/statistik.js";
import { onShowDarstellung } from "./pages/darstellung.js";
import { initDesign } from "./design.js";
import { store, requestPersistence } from "./storage.js";

addRoute("brett", { page: "page-brett", tab: "brett", title: "Brett" });
addRoute("taktik", { page: "page-taktik", tab: "taktik", title: "Taktik", onShow: onShowTaktik });
addRoute("taktik/statistik", { page: "page-statistik", tab: "taktik", title: "Statistik", onShow: onShowStatistik });
addRoute("mehr", { page: "page-mehr", title: "Mehr" });
addRoute("mehr/darstellung", { page: "page-darstellung", title: "Darstellung", onShow: onShowDarstellung });
addRoute("mehr/daten", { page: "page-daten", title: "Daten", onShow: onShowDaten });
addRoute("mehr/info", { page: "page-info", title: "Info und Lizenzen" });

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
initStatistik();
startRouter();

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
