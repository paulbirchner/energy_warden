import { createDemoData } from "../data/demoData";
import { CONSUMPTION_STORAGE_KEY } from "../hooks/useConsumptionData";
import { NOTIFICATION_STORAGE_KEY } from "../hooks/useNotificationPreferences";
import { RECOMMENDATION_PROGRESS_STORAGE_KEY } from "../hooks/useRecommendationProgress";
import { TARIFF_STORAGE_KEY } from "../hooks/useTariffData";

const DEMO_ACTIVE_KEY = "energy-warden-demo-active-v1";
const DEMO_BACKUP_KEY = "energy-warden-demo-backup-v1";

const APP_STORAGE_KEYS = [
  CONSUMPTION_STORAGE_KEY,
  TARIFF_STORAGE_KEY,
  NOTIFICATION_STORAGE_KEY,
  RECOMMENDATION_PROGRESS_STORAGE_KEY,
] as const;

type DemoBackup = Record<(typeof APP_STORAGE_KEYS)[number], string | null>;

/** Prüft, ob der aktuell sichtbare Datenstand aus dem PoC-Demo-Modus stammt. */
export function isDemoModeActive() {
  return localStorage.getItem(DEMO_ACTIVE_KEY) !== null;
}

/** Erkennt schützenswerte Eingaben, bevor der Demo-Datensatz geladen wird. */
export function hasExistingAppData() {
  return APP_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
}

/** Sichert den momentanen Datenstand einmalig, damit er später wiederhergestellt werden kann. */
function createBackup() {
  const backup = Object.fromEntries(
    APP_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)]),
  ) as DemoBackup;
  localStorage.setItem(DEMO_BACKUP_KEY, JSON.stringify(backup));
}

/**
 * Installiert den datumsrelativen Demo-Haushalt in denselben Speicherbereichen
 * wie echte Eingaben. Bereits vorhandene Daten werden vorher gesichert.
 */
export function installDemoData() {
  if (!isDemoModeActive()) createBackup();
  const demo = createDemoData();

  localStorage.setItem(CONSUMPTION_STORAGE_KEY, JSON.stringify(demo.consumption));
  localStorage.setItem(TARIFF_STORAGE_KEY, JSON.stringify(demo.tariffs));
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(demo.notifications));
  localStorage.setItem(
    RECOMMENDATION_PROGRESS_STORAGE_KEY,
    JSON.stringify(demo.recommendationProgress),
  );
  localStorage.setItem(DEMO_ACTIVE_KEY, JSON.stringify({ loadedAt: new Date().toISOString() }));
}

/**
 * Beendet den Demo-Modus und stellt den zuvor gesicherten Datenstand wieder her.
 * Nicht vorhandene ursprüngliche Speicherbereiche werden vollständig entfernt.
 */
export function restoreOriginalData() {
  let backup: DemoBackup | null = null;
  try {
    const storedBackup = localStorage.getItem(DEMO_BACKUP_KEY);
    backup = storedBackup ? JSON.parse(storedBackup) as DemoBackup : null;
  } catch {
    // Bei einem beschädigten Backup wird sicher auf einen leeren Ursprungszustand zurückgesetzt.
    backup = null;
  }

  try {
    APP_STORAGE_KEYS.forEach((key) => {
      const previousValue = backup?.[key] ?? null;
      if (previousValue === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previousValue);
    });
  } finally {
    localStorage.removeItem(DEMO_ACTIVE_KEY);
    localStorage.removeItem(DEMO_BACKUP_KEY);
    sessionStorage.removeItem("energy-warden-notified-this-session");
  }
}
