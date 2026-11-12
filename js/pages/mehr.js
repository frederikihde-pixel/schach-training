// Info-Seite: Lizenztexte werden erst beim Aufklappen aus den Dateien im Repository geladen.

export function initInfo() {
  for (const details of document.querySelectorAll("#page-info details.license")) {
    details.addEventListener("toggle", async () => {
      if (!details.open || details.dataset.loaded) return;
      const pre = details.querySelector("pre");
      try {
        const res = await fetch(details.dataset.src);
        if (!res.ok) throw new Error(String(res.status));
        pre.textContent = await res.text();
        details.dataset.loaded = "1";
      } catch (err) {
        pre.textContent = "Der Lizenztext konnte nicht geladen werden. Er liegt im Repository unter " + details.dataset.src + ".";
      }
    });
  }
}
