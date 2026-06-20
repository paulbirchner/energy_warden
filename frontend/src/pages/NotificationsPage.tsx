import { useEffect, useMemo, useState } from "react";
import { getCurrentPrice } from "../api/energyWardenApi";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import { useNotificationPreferences } from "../hooks/useNotificationPreferences";
import type { NotificationPreferences } from "../types/energyWarden";
import { buildMonthlySeries } from "../utils/analysisUtils";

type NoticeKind = "warning" | "reminder" | "tip" | "info";
type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  text: string;
  meta: string;
};

const decimal = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Zentrale Seite für Hinweise, Browser-Freigabe und Benachrichtigungseinstellungen. */
export default function NotificationsPage() {
  const consumption = useConsumptionData();
  const notificationStore = useNotificationPreferences();
  const { preferences } = notificationStore;
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [priceStatus, setPriceStatus] = useState<"loading" | "ready" | "error">("loading");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const series = useMemo(() => buildMonthlySeries(consumption.data), [consumption.data]);
  const latestReading = [...consumption.data.meterReadings]
    .sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];
  const latestReadingDate = latestReading?.readingDate;
  const notices = buildNotices(series, latestReadingDate, marketPrice, priceStatus, preferences)
    .filter((notice) => !preferences.dismissedIds.includes(notice.id));
  const nextReading = getNextReadingDate(latestReading?.readingDate, preferences.meterReminderDays);

  useEffect(() => {
    getCurrentPrice()
      .then((price) => { setMarketPrice(price); setPriceStatus("ready"); })
      .catch(() => setPriceStatus("error"));
  }, []);

  useEffect(() => {
    if (
      !preferences.browserNotifications ||
      permission !== "granted" ||
      isQuietTime(preferences.quietStart, preferences.quietEnd)
    ) return;

    const storageKey = "energy-warden-notified-this-session";
    const alreadySent = new Set<string>(JSON.parse(sessionStorage.getItem(storageKey) ?? "[]"));
    notices.forEach((notice) => {
      if (!alreadySent.has(notice.id)) {
        new Notification(notice.title, { body: notice.text });
        alreadySent.add(notice.id);
      }
    });
    sessionStorage.setItem(storageKey, JSON.stringify([...alreadySent]));
  }, [notices, permission, preferences.browserNotifications, preferences.quietEnd, preferences.quietStart]);

  /** Fordert die Browser-Berechtigung an oder deaktiviert lokale Browser-Hinweise. */
  async function toggleBrowserNotifications(enabled: boolean) {
    if (!enabled) {
      notificationStore.update({ browserNotifications: false });
      return;
    }
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    notificationStore.update({ browserNotifications: result === "granted" });
  }

  /** Sendet nach erteilter Berechtigung eine unmittelbar sichtbare Testmeldung. */
  function sendTestNotification() {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Energy Warden", {
        body: "Browser-Benachrichtigungen sind erfolgreich aktiviert.",
      });
    }
  }

  return (
    <main className="page-content notifications-page">
      <div className="page-heading heading-row">
        <div>
          <p className="eyebrow">Benachrichtigungen &amp; Erinnerungen</p>
          <h1>Rechtzeitig Bescheid wissen</h1>
          <p className="subtitle">Energy Warden macht dich auf Auffälligkeiten, fällige Ablesungen und günstige Zeitfenster aufmerksam.</p>
        </div>
        <span className="local-badge"><span /> Einstellungen lokal gespeichert</span>
      </div>

      <div className="stats-grid notification-stats">
        <NotificationStat icon="bell" label="Aktive Hinweise" value={String(notices.length)} note={notices.length === 1 ? "ungelesener Hinweis" : "ungelesene Hinweise"} />
        <NotificationStat icon="meter" label="Nächste Ablesung" value={preferences.meterReminders ? nextReading.label : "Deaktiviert"} note={preferences.meterReminders ? nextReading.note : "keine Erinnerung geplant"} />
        <NotificationStat icon="clock" label="Ruhezeit" value={`${preferences.quietStart}–${preferences.quietEnd}`} note="keine Browser-Hinweise" />
      </div>

      <section className="notification-browser-card">
        <div className="browser-notification-copy">
          <span className="icon-tile large"><Icon name="bell" /></span>
          <div><strong>Browser-Benachrichtigungen</strong><p>Erhalte Hinweise auch dann, wenn gerade eine andere Registerkarte geöffnet ist.</p></div>
        </div>
        <div className="browser-actions">
          <PermissionLabel permission={permission} />
          {permission === "granted" && preferences.browserNotifications
            ? <><button className="secondary-button" type="button" onClick={sendTestNotification}>Test senden</button><button className="text-action" type="button" onClick={() => toggleBrowserNotifications(false)}>Deaktivieren</button></>
            : <button className="primary-button compact-button" type="button" disabled={permission === "denied" || permission === "unsupported"} onClick={() => toggleBrowserNotifications(true)}><Icon name="bell" size={17} /> Aktivieren</button>}
        </div>
      </section>

      <div className="notifications-layout">
        <section className="notification-panel notice-center">
          <div className="notification-panel-heading">
            <div><p className="eyebrow">Mitteilungszentrale</p><h2>Aktuelle Hinweise</h2></div>
            {preferences.dismissedIds.length > 0 && <button className="text-action" type="button" onClick={notificationStore.restoreDismissed}>Ausgeblendete wiederherstellen</button>}
          </div>

          {notices.length === 0
            ? <div className="all-clear"><span className="icon-tile large"><Icon name="check" /></span><strong>Alles im grünen Bereich</strong><p>Momentan gibt es keine offenen Hinweise.</p></div>
            : <div className="notice-list">{notices.map((notice) => <NoticeRow key={notice.id} notice={notice} onDismiss={() => notificationStore.dismiss(notice.id)} />)}</div>}
        </section>

        <section className="notification-panel settings-panel">
          <div className="notification-panel-heading"><div><p className="eyebrow">FA-26</p><h2>Einstellungen</h2></div><Icon name="settings" /></div>
          <SettingToggle title="Verbrauchswarnungen" text="Bei ungewöhnlichen Abweichungen informieren." checked={preferences.consumptionAlerts} onChange={(value) => notificationStore.update({ consumptionAlerts: value })} />
          <SettingToggle title="Zählerstand-Erinnerungen" text="Regelmäßig an eine neue Ablesung erinnern." checked={preferences.meterReminders} onChange={(value) => notificationStore.update({ meterReminders: value })} />
          {preferences.meterReminders && <label className="setting-select">Erinnerungsintervall<select value={preferences.meterReminderDays} onChange={(event) => notificationStore.update({ meterReminderDays: Number(event.target.value) })}><option value="7">Wöchentlich</option><option value="14">Alle zwei Wochen</option><option value="30">Monatlich</option><option value="90">Vierteljährlich</option></select></label>}
          <SettingToggle title="Zeitnahe Preishinweise" text="Bei besonders hohen oder niedrigen Preisen informieren." checked={preferences.realtimeTips} onChange={(value) => notificationStore.update({ realtimeTips: value })} />

          <details className="advanced-settings">
            <summary>Schwellwerte &amp; Ruhezeit</summary>
            <div className="settings-grid">
              <label>Verbrauchsabweichung<div className="input-unit"><input min="10" max="100" step="5" type="number" value={preferences.anomalyThresholdPercent} onChange={(event) => notificationStore.update({ anomalyThresholdPercent: Number(event.target.value) })} /><span>%</span></div></label>
              <label>Hoher Strompreis<div className="input-unit"><input min="0" step="1" type="number" value={preferences.highPriceThresholdCent} onChange={(event) => notificationStore.update({ highPriceThresholdCent: Number(event.target.value) })} /><span>ct/kWh</span></div></label>
              <label>Günstiger Strompreis<div className="input-unit"><input min="0" step="1" type="number" value={preferences.lowPriceThresholdCent} onChange={(event) => notificationStore.update({ lowPriceThresholdCent: Number(event.target.value) })} /><span>ct/kWh</span></div></label>
              <div className="quiet-time-inputs"><label>Ruhezeit von<input type="time" value={preferences.quietStart} onChange={(event) => notificationStore.update({ quietStart: event.target.value })} /></label><label>bis<input type="time" value={preferences.quietEnd} onChange={(event) => notificationStore.update({ quietEnd: event.target.value })} /></label></div>
            </div>
          </details>
        </section>
      </div>

      <p className="frontend-notice"><Icon name="alert" size={15} /> Ohne Push-Backend werden Benachrichtigungen nur verarbeitet, solange Energy Warden im Browser geöffnet ist.</p>
    </main>
  );
}

/**
 * Leitet die aktuell relevanten Hinweise aus Anomalien, Ablesefälligkeit
 * und dynamischem Strompreis ab. Ausgeschaltete Kategorien werden übersprungen.
 */
function buildNotices(
  series: ReturnType<typeof buildMonthlySeries>,
  latestReadingDate: string | undefined,
  marketPrice: number | null,
  priceStatus: "loading" | "ready" | "error",
  preferences: NotificationPreferences,
): Notice[] {
  const notices: Notice[] = [];

  if (preferences.consumptionAlerts && series.length >= 4 && !series.every((point) => point.estimated)) {
    const current = series.at(-1);
    const baseline = series.slice(-4, -1);
    const average = baseline.reduce((sum, point) => sum + point.consumption, 0) / baseline.length;
    const deviation = current && average ? (current.consumption - average) / average * 100 : 0;
    if (current && Math.abs(deviation) >= preferences.anomalyThresholdPercent) {
      notices.push({
        id: `anomaly-${current.key}`,
        kind: "warning",
        title: deviation > 0 ? "Ungewöhnlich hoher Verbrauch" : "Deutlich niedrigerer Verbrauch",
        text: `Der Verbrauch im ${current.label} liegt ${decimal.format(Math.abs(deviation))} % ${deviation > 0 ? "über" : "unter"} dem Durchschnitt der drei Vormonate.`,
        meta: "Verbrauchsanalyse",
      });
    }
  }

  if (preferences.meterReminders) {
    const due = getNextReadingDate(latestReadingDate, preferences.meterReminderDays);
    if (!latestReadingDate || due.overdue) {
      notices.push({
        id: `meter-${latestReadingDate ?? "missing"}-${preferences.meterReminderDays}`,
        kind: "reminder",
        title: latestReadingDate ? "Zählerstand ist fällig" : "Ersten Zählerstand erfassen",
        text: latestReadingDate ? `Deine letzte Ablesung war am ${formatDate(latestReadingDate)}. Ein neuer Wert verbessert Analyse und Prognose.` : "Mit einer ersten Ablesung legst du die Grundlage für deine Verbrauchsentwicklung.",
        meta: latestReadingDate ? `${due.daysOverdue} Tage überfällig` : "Noch keine Ablesung",
      });
    }
  }

  if (preferences.realtimeTips && priceStatus === "ready" && marketPrice !== null) {
    const cent = marketPrice / 10;
    if (cent >= preferences.highPriceThresholdCent) {
      notices.push({ id: `price-high-${Math.round(cent)}`, kind: "tip", title: "Strompreis aktuell erhöht", text: `Mit ${cent.toFixed(2).replace(".", ",")} ct/kWh liegt der Börsenpreis über deinem Schwellwert. Verschiebbare Geräte besser später nutzen.`, meta: "Live-Preishinweis" });
    } else if (cent <= preferences.lowPriceThresholdCent) {
      notices.push({ id: `price-low-${Math.round(cent)}`, kind: "tip", title: "Günstiges Zeitfenster", text: `Der aktuelle Börsenpreis liegt bei ${cent.toFixed(2).replace(".", ",")} ct/kWh. Ein guter Zeitpunkt für verschiebbare Verbraucher.`, meta: "Live-Preishinweis" });
    }
  }

  return notices;
}

/** Berechnet das nächste Ablesedatum und einen menschenlesbaren Fälligkeitsstatus. */
function getNextReadingDate(latestReadingDate: string | undefined, interval: number) {
  if (!latestReadingDate) return { label: "Jetzt", note: "erste Ablesung ausstehend", overdue: true, daysOverdue: 0 };
  const due = new Date(`${latestReadingDate}T00:00:00`);
  due.setDate(due.getDate() + interval);
  const diff = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  return {
    label: diff <= 0 ? "Jetzt fällig" : formatDate(due.toISOString().slice(0, 10)),
    note: diff <= 0 ? `${Math.abs(diff)} Tage überfällig` : `noch ${diff} Tage`,
    overdue: diff <= 0,
    daysOverdue: Math.abs(diff),
  };
}

/** Formatiert ein Eingabedatum in deutscher Schreibweise ohne UTC-Verschiebung. */
function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("de-DE");
}

/** Prüft Ruhezeiten einschließlich Zeitfenstern, die über Mitternacht laufen. */
function isQuietTime(start: string, end: string) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  return startMinutes <= endMinutes
    ? currentMinutes >= startMinutes && currentMinutes < endMinutes
    : currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/** Kennzahlenkarte im Kopf der Mitteilungszentrale. */
function NotificationStat({ icon, label, value, note }: { icon: "bell" | "meter" | "clock"; label: string; value: string; note: string }) {
  return <article className="stat-card analysis-stat"><span className="icon-tile"><Icon name={icon} /></span><span><small>{label}</small><strong>{value}</strong><em>{note}</em></span></article>;
}

/** Übersetzt den technischen Browser-Berechtigungsstatus in ein verständliches Label. */
function PermissionLabel({ permission }: { permission: NotificationPermission | "unsupported" }) {
  const text = permission === "granted" ? "Freigegeben" : permission === "denied" ? "Im Browser blockiert" : permission === "unsupported" ? "Nicht unterstützt" : "Nicht aktiviert";
  return <span className={`permission-label ${permission}`}>{text}</span>;
}

/** Einzelner ausblendbarer Hinweis mit typabhängiger Gestaltung. */
function NoticeRow({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const icon = notice.kind === "warning" ? "alert" : notice.kind === "reminder" ? "clock" : "trend";
  return <article className={`notice-row ${notice.kind}`}><span className="notice-icon"><Icon name={icon} /></span><span className="notice-copy"><span><em>{notice.meta}</em><strong>{notice.title}</strong></span><p>{notice.text}</p></span><button className="icon-button" type="button" aria-label={`${notice.title} ausblenden`} onClick={onDismiss}><Icon name="close" size={17} /></button></article>;
}

/** Zugänglicher Schalter für eine Benachrichtigungskategorie. */
function SettingToggle({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="setting-toggle"><span><strong>{title}</strong><small>{text}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
