// Seite "Daten": Export, Import, Löschen, Hinweise zu Speicher und Adresse.
// Außerdem die Hinweisleisten oben (Export-Erinnerung, Speicherprobleme).

import { store, DataError, EXPORT_REMINDER_DAYS } from "../storage.js";

const $ = (id) => document.getElementById(id);
let pendingImportText = null;
let reminderSnoozed = false;

function message(text, isError = false) {
  const el = $("daten-meldung");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function changed() {
  document.dispatchEvent(new CustomEvent("daten-geaendert"));
  renderHinweise();
  renderDaten();
}

export function renderHinweise() {
  const due = store.reminderDue() && !reminderSnoozed;
  $("hinweis-export").hidden = !due;
  if (due) {
    $("hinweis-export-text").textContent =
      `Die letzte Datensicherung ist mindestens ${EXPORT_REMINDER_DAYS} Tage her. ` +
      "Sichere deine Daten und benutze immer denselben Link zur App, denn die Daten gelten pro Adresse.";
  }

  const st = store.status;
  let warn = "";
  if (!st.persistent) {
    warn = "In diesem Browser ist dauerhaftes Speichern nicht möglich. Die Daten gehen verloren, sobald die Seite geschlossen wird.";
  } else if (st.error) {
    warn = st.error;
  } else if (st.recovered) {
    warn = "Die gespeicherten Daten waren unlesbar. Eine Kopie wurde aufgehoben, die App startet mit leeren Daten.";
  }
  $("hinweis-speicher").hidden = !warn;
  $("hinweis-speicher-text").textContent = warn;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

export function renderDaten() {
  $("daten-adresse").textContent = location.href.split("#")[0];

  const p = store.status.persistence;
  let text = "Dauerhafter Speicher: wird geprüft ...";
  if (p) {
    if (!p.supported) text = "Dauerhafter Speicher: Dieser Browser unterstützt die Anfrage nicht.";
    else if (p.persisted) text = "Dauerhafter Speicher: gewährt. Der Browser löscht die Daten nicht von selbst.";
    else text = "Dauerhafter Speicher: nicht gewährt. Der Browser könnte die Daten bei Platzmangel löschen. Sichere sie regelmäßig.";
  }
  $("daten-persist").textContent = text;

  const last = store.get().letzterExport;
  $("daten-letzter-export").textContent = last ? `Letzter Export: ${formatDate(last)}.` : "Noch nie exportiert.";
}

function exportFile() {
  const json = store.exportJson();
  const stamp = store.now().toLocaleDateString("sv-SE");
  return new File([json], `schach-training-${stamp}.json`, { type: "application/json" });
}

function hideConfirmations() {
  pendingImportText = null;
  $("import-bestaetigung").hidden = true;
  $("loeschen-bestaetigung").hidden = true;
}

export function onShowDaten() {
  hideConfirmations();
  message("");
  renderDaten();
}

export function initDaten() {
  $("hinweis-export-spaeter").addEventListener("click", () => {
    reminderSnoozed = true;
    renderHinweise();
  });
  document.addEventListener("persistence-checked", () => {
    renderHinweise();
    renderDaten();
  });

  $("btn-export").addEventListener("click", () => {
    const file = exportFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    message(`Die Datei ${file.name} wurde erstellt. Bewahre sie an einem sicheren Ort auf.`);
    changed();
  });

  const probe = new File(["{}"], "probe.json", { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [probe] })) {
    $("btn-teilen").hidden = false;
    $("btn-teilen").addEventListener("click", async () => {
      try {
        await navigator.share({ files: [exportFile()], title: "Schach-Training Daten" });
        message("Die Datei wurde weitergegeben.");
        changed();
      } catch (err) {
        if (err && err.name !== "AbortError") message("Teilen ist fehlgeschlagen.", true);
      }
    });
  }

  const input = $("datei-import");
  $("btn-import").addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    hideConfirmations();
    message("");
    try {
      const text = await file.text();
      const preview = store.previewImport(text);
      const t = preview.taktik;
      pendingImportText = text;
      $("import-bestaetigung-text").textContent =
        `Die Datei enthält ${t.versuche.length} gespeicherte Versuche und ${t.sitzungen.length} Sitzungen. ` +
        "Die bisherigen Daten in diesem Browser werden ersetzt.";
      $("import-bestaetigung").hidden = false;
    } catch (err) {
      message(err instanceof DataError ? err.message : "Die Datei konnte nicht gelesen werden.", true);
    }
  });
  $("btn-import-ja").addEventListener("click", () => {
    try {
      store.importJson(pendingImportText);
      hideConfirmations();
      message("Die Daten wurden wiederhergestellt.");
      changed();
    } catch (err) {
      message(err instanceof DataError ? err.message : "Der Import ist fehlgeschlagen.", true);
    }
  });
  $("btn-import-nein").addEventListener("click", hideConfirmations);

  $("btn-loeschen").addEventListener("click", () => {
    hideConfirmations();
    $("loeschen-bestaetigung").hidden = false;
  });
  $("btn-loeschen-ja").addEventListener("click", () => {
    store.reset();
    hideConfirmations();
    message("Alle Daten wurden gelöscht.");
    changed();
  });
  $("btn-loeschen-nein").addEventListener("click", hideConfirmations);

  renderHinweise();
}
