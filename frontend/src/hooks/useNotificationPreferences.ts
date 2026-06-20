import { useState } from "react";
import type { NotificationPreferences } from "../types/energyWarden";

/** Gemeinsamer Persistenzschlüssel für Mitteilungs- und Demo-Einstellungen. */
export const NOTIFICATION_STORAGE_KEY = "energy-warden-notifications-v1";

const DEFAULTS: NotificationPreferences = {
  consumptionAlerts: true,
  meterReminders: true,
  realtimeTips: true,
  browserNotifications: false,
  anomalyThresholdPercent: 25,
  meterReminderDays: 30,
  highPriceThresholdCent: 25,
  lowPriceThresholdCent: 12,
  quietStart: "22:00",
  quietEnd: "07:00",
  dismissedIds: [],
};

/** Lädt Einstellungen und ergänzt ältere Speicherstände um neue Standardfelder. */
function loadPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Verwaltet Benachrichtigungsschalter, Schwellenwerte und ausgeblendete Hinweise. */
export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(loadPreferences);

  /** Aktualisiert nur die übergebenen Einstellungsfelder und persistiert das Ergebnis. */
  function update(patch: Partial<NotificationPreferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(next));
  }

  return {
    preferences,
    update,
    /** Blendet einen Hinweis über seine stabile ID aus. */
    dismiss(id: string) {
      if (!preferences.dismissedIds.includes(id)) {
        update({ dismissedIds: [...preferences.dismissedIds, id] });
      }
    },
    /** Macht alle zuvor ausgeblendeten Hinweise wieder sichtbar. */
    restoreDismissed() {
      update({ dismissedIds: [] });
    },
  };
}
