// Zentrale Datenhaltung. Alle Daten der App liegen unter EINEM Schlüssel in localStorage
// (nur lokal im Browser, kein Server). Der Aufbau ist versioniert; ältere Stände werden
// über MIGRATIONS auf die aktuelle Version gebracht.

export const APP_ID = "schach-training";
export const STORAGE_KEY = "schach-training";
export const SCHEMA_VERSION = 2;
export const EXPORT_REMINDER_DAYS = 14;

// Begrenzungen, damit die Daten klein bleiben (localStorage hat etwa 5 MB).
export const CAPS = { versuche: 500, verlauf: 500, sitzungen: 200, standort: 100 };

const DAY_MS = 24 * 60 * 60 * 1000;

export function defaults(now = new Date()) {
  return {
    app: APP_ID,
    version: SCHEMA_VERSION,
    erstelltAm: now.toISOString(),
    letzterExport: null,
    einstellungen: {},
    taktik: {
      staerke: null, // geschätzte Taktikstärke, null bis zur Einstufung
      eingestuft: false,
      anzahl: 0, // Zahl der gewerteten Rätsel (bestimmt den K-Wert)
      versuche: [], // letzte Einzelversuche
      themen: {}, // Zähler je Thema
      karten: {}, // Wiederholungs-Karten (Leitner) je Rätsel-Id
      gesehen: {}, // bereits gespielte Rätsel-Ids
      sitzungen: [], // abgeschlossene Sitzungen
      verlauf: [], // Verlauf der geschätzten Stärke
      standort: [], // Ergebnisse der Standortbestimmung (mit Datum)
      aktiv: null, // laufende Sitzung
    },
  };
}

// Von Version n auf n+1. Version 0 = Objekt ohne Versionsfeld: fehlende Felder werden ergänzt.
export const MIGRATIONS = {
  0(data, now) {
    const base = defaults(now);
    return {
      ...base,
      ...data,
      app: APP_ID,
      version: 1,
      einstellungen: { ...base.einstellungen, ...(data.einstellungen || {}) },
      taktik: { ...base.taktik, ...(data.taktik || {}) },
    };
  },
  // Version 2: Zähler für den K-Wert und Ergebnisse der Standortbestimmung.
  1(data) {
    const t = data.taktik || {};
    return {
      ...data,
      version: 2,
      taktik: { ...t, anzahl: t.anzahl ?? (Array.isArray(t.versuche) ? t.versuche.length : 0), standort: t.standort ?? [] },
    };
  },
};

export class DataError extends Error {}

export function migrate(data, { now = new Date(), migrations = MIGRATIONS, target = SCHEMA_VERSION } = {}) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new DataError("Die Daten haben ein unerwartetes Format.");
  }
  let version = data.version === undefined ? 0 : data.version;
  if (!Number.isInteger(version) || version < 0) throw new DataError("Die Versionsnummer der Daten ist ungültig.");
  if (version > target) throw new DataError("Die Daten stammen aus einer neueren Version der App.");
  let current = data;
  while (version < target) {
    const step = migrations[version];
    if (!step) throw new DataError(`Für Version ${version} gibt es keine Umstellung.`);
    current = step(current, now);
    version += 1;
    current.version = version;
  }
  return current;
}

// Prüft den Aufbau eines (bereits umgestellten) Standes. Wirft DataError.
export function validate(data) {
  const fail = (msg) => {
    throw new DataError(msg);
  };
  if (data.app !== APP_ID) fail("Das ist keine Sicherungsdatei von Schach-Training.");
  if (typeof data.erstelltAm !== "string") fail("In der Datei fehlt das Erstellungsdatum.");
  if (data.letzterExport !== null && typeof data.letzterExport !== "string") fail("Das Exportdatum ist ungültig.");
  const t = data.taktik;
  if (!t || typeof t !== "object") fail("In der Datei fehlen die Taktik-Daten.");
  if (t.staerke !== null && typeof t.staerke !== "number") fail("Die Taktikstärke ist ungültig.");
  if (typeof t.anzahl !== "number") fail('Taktik-Daten: "anzahl" ist ungültig.');
  for (const key of ["versuche", "sitzungen", "verlauf", "standort"]) {
    if (!Array.isArray(t[key])) fail(`Taktik-Daten: "${key}" ist ungültig.`);
  }
  for (const key of ["themen", "karten", "gesehen"]) {
    if (t[key] === null || typeof t[key] !== "object" || Array.isArray(t[key])) fail(`Taktik-Daten: "${key}" ist ungültig.`);
  }
  if (data.einstellungen === null || typeof data.einstellungen !== "object") fail("Die Einstellungen sind ungültig.");
  return data;
}

// Liest den Text einer Sicherungsdatei, ohne etwas zu verändern. Wirft DataError.
export function parseImport(text, { now = new Date(), migrations = MIGRATIONS } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new DataError("Die Datei ist keine gültige JSON-Datei.");
  }
  return validate(migrate(parsed, { now, migrations }));
}

export function trim(state) {
  const t = state.taktik;
  for (const key of Object.keys(CAPS)) {
    if (t[key].length > CAPS[key]) t[key] = t[key].slice(-CAPS[key]);
  }
  return state;
}

export function exportReminderDue(state, now = new Date()) {
  const t = state.taktik;
  const hatDaten = t.versuche.length > 0 || t.sitzungen.length > 0 || t.staerke !== null;
  if (!hatDaten) return false;
  const reference = Date.parse(state.letzterExport || state.erstelltAm);
  return now.getTime() - reference >= EXPORT_REMINDER_DAYS * DAY_MS;
}

export const STANDORT_REMINDER_DAYS = 28;

// Ruhige Erinnerung an die Standortbestimmung: vier Wochen nach dem letzten Ergebnis.
// Wer noch keine gemacht hat, wird nicht erinnert.
export function standortReminderDue(state, now = new Date()) {
  const list = state.taktik.standort;
  if (!list.length) return false;
  const last = Date.parse(list[list.length - 1].datum);
  return now.getTime() - last >= STANDORT_REMINDER_DAYS * DAY_MS;
}

function memoryBackend() {
  const map = new Map();
  return {
    persistent: false,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

export function browserBackend() {
  try {
    const ls = globalThis.localStorage;
    const probe = `${STORAGE_KEY}.probe`;
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return {
      persistent: true,
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => ls.removeItem(k),
    };
  } catch (err) {
    return memoryBackend();
  }
}

export function createStore({ backend = browserBackend(), now = () => new Date(), migrations = MIGRATIONS } = {}) {
  let state = null;
  const status = { persistent: backend.persistent !== false, error: null, recovered: false };

  function write() {
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(trim(state)));
      status.error = null;
    } catch (err) {
      status.error = "Die Daten konnten nicht gespeichert werden (Speicher voll oder gesperrt).";
    }
  }

  function load() {
    const raw = backend.getItem(STORAGE_KEY);
    if (raw === null) {
      state = defaults(now());
      return state;
    }
    try {
      state = validate(migrate(JSON.parse(raw), { now: now(), migrations }));
    } catch (err) {
      // Nichts still überschreiben: den unlesbaren Stand als Kopie aufheben.
      try {
        backend.setItem(`${STORAGE_KEY}.defekt`, raw);
      } catch (e) {
        /* Kopie nicht möglich */
      }
      status.recovered = true;
      state = defaults(now());
    }
    return state;
  }

  return {
    status,
    now,
    get() {
      return state || load();
    },
    save() {
      this.get();
      write();
    },
    update(fn) {
      fn(this.get());
      write();
      return state;
    },
    exportJson() {
      this.get();
      state.letzterExport = now().toISOString();
      write();
      return JSON.stringify(state, null, 1);
    },
    previewImport(text) {
      return parseImport(text, { now: now(), migrations });
    },
    importJson(text) {
      state = parseImport(text, { now: now(), migrations });
      write();
      return state;
    },
    reset() {
      backend.removeItem(STORAGE_KEY);
      state = defaults(now());
      return state;
    },
    reminderDue() {
      return exportReminderDue(this.get(), now());
    },
    standortReminderDue() {
      return standortReminderDue(this.get(), now());
    },
  };
}

// Fragt beim Browser an, den Speicher dieser Seite nicht ohne Rückfrage zu löschen.
export async function requestPersistence() {
  const storage = globalThis.navigator && globalThis.navigator.storage;
  if (!storage || !storage.persist) return { supported: false, persisted: false };
  try {
    const persisted = (await storage.persisted()) || (await storage.persist());
    return { supported: true, persisted: !!persisted };
  } catch (err) {
    return { supported: true, persisted: false };
  }
}

export const store = createStore();
