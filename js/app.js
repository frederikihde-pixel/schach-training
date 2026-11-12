import { addRoute, startRouter } from "./router.js";
import "./pages/brett.js";
import { initInfo } from "./pages/mehr.js";
import { initDaten, onShowDaten } from "./pages/daten.js";
import { initTaktik, onShowTaktik } from "./pages/taktik.js";
import { store, requestPersistence } from "./storage.js";

addRoute("brett", { page: "page-brett", tab: "brett", title: "Brett" });
addRoute("taktik", { page: "page-taktik", tab: "taktik", title: "Taktik", onShow: onShowTaktik });
addRoute("taktik/statistik", { page: "page-statistik", tab: "taktik", title: "Statistik" });
addRoute("mehr", { page: "page-mehr", title: "Mehr" });
addRoute("mehr/daten", { page: "page-daten", title: "Daten", onShow: onShowDaten });
addRoute("mehr/info", { page: "page-info", title: "Info und Lizenzen" });

store.get();
// Bei jedem Start anfragen, ob der Browser die Daten dauerhaft behalten soll.
requestPersistence().then((result) => {
  store.status.persistence = result;
  document.dispatchEvent(new CustomEvent("persistence-checked"));
});

initInfo();
initDaten();
initTaktik();
startRouter();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {
      /* ohne Service Worker läuft die App weiter, nur nicht offline */
    });
  });
}
