import { addRoute, startRouter } from "./router.js";
import "./pages/brett.js";
import { initInfo } from "./pages/mehr.js";
import { store, requestPersistence } from "./storage.js";

addRoute("brett", { page: "page-brett", tab: "brett", title: "Brett" });
addRoute("taktik", { page: "page-taktik", tab: "taktik", title: "Taktik" });
addRoute("mehr", { page: "page-mehr", title: "Mehr" });
addRoute("mehr/info", { page: "page-info", title: "Info und Lizenzen" });

store.get();
// Bei jedem Start anfragen, ob der Browser die Daten dauerhaft behalten soll.
requestPersistence().then((result) => {
  store.status.persistence = result;
  document.dispatchEvent(new CustomEvent("persistence-checked"));
});

initInfo();
startRouter();
