// Seite "Themen": jedes Thema mit einem erklärenden Satz und dem Knopf "Dieses Thema üben".
// Die Einsteiger-Themen stehen oben.

import { store } from "../storage.js";
import { BEGINNER_THEMES, orderedThemes, themeLabel, themeInfo } from "../themes.js";
import { practiceTheme } from "./taktik.js";

const $ = (id) => document.getElementById(id);

function row(tag) {
  const li = document.createElement("li");
  li.className = "theme-row";
  const name = document.createElement("strong");
  name.textContent = themeLabel(tag);
  const info = document.createElement("p");
  info.textContent = themeInfo(tag);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Üben";
  button.setAttribute("aria-label", `Thema ${themeLabel(tag)} üben`);
  button.dataset.thema = tag;
  button.addEventListener("click", () => {
    const t = store.get().taktik;
    if (t.aktiv) {
      $("themen-meldung").textContent = "Es läuft gerade eine Sitzung. Beende oder verwirf sie zuerst auf der Seite Taktik.";
      return;
    }
    if (!t.eingestuft) {
      $("themen-meldung").textContent = "Zum Üben schätzt die App zuerst deine Stärke ein. Starte dazu auf der Seite Taktik die Einstufung.";
      return;
    }
    $("themen-meldung").textContent = "";
    practiceTheme(tag);
  });
  li.append(name, button, info);
  return li;
}

export function onShowThemen() {
  $("themen-meldung").textContent = "";
  if ($("themen-einstieg").children.length) return;
  for (const tag of orderedThemes()) {
    $(BEGINNER_THEMES.includes(tag) ? "themen-einstieg" : "themen-weitere").append(row(tag));
  }
}
