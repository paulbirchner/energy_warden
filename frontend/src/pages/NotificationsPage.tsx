import { useEffect, useMemo, useState } from "react";
import { getCurrentPrice } from "../api/energyWardenApi";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import { useNotificationPreferences } from "../hooks/useNotificationPreferences";
import type { NotificationPreferences } from "../types/energyWarden";
import { buildMonthlySeries } from "../utils/analysisUtils";
import { estimatedHouseholdPriceCentKwh } from "../utils/priceUtils";

type NoticeKind = "warning" | "reminder" | "tip" | "info";
type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  text: string;
  meta: string;
};

const decimal = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

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
        body: "Browser notifications have been enabled successfully.",
      });
    }
  }

  return (
    <main className="page-content notifications-page">
      <div className="page-heading heading-row">
        <div>
          <p className="eyebrow">Notifications &amp; reminders</p>
          <h1>Stay informed in time</h1>
          <p className="subtitle">Energy Warden alerts you to anomalies, due meter readings and favourable time windows.</p>
        </div>
        <span className="local-badge"><span /> Settings stored locally</span>
      </div>

      <div className="stats-grid notification-stats">
        <NotificationStat icon="bell" label="Active alerts" value={String(notices.length)} note={notices.length === 1 ? "unread alert" : "unread alerts"} />
        <NotificationStat icon="meter" label="Next reading" value={preferences.meterReminders ? nextReading.label : "Disabled"} note={preferences.meterReminders ? nextReading.note : "no reminder scheduled"} />
        <NotificationStat icon="clock" label="Quiet hours" value={`${preferences.quietStart}–${preferences.quietEnd}`} note="no browser notifications" />
      </div>

      <section className="notification-browser-card">
        <div className="browser-notification-copy">
          <span className="icon-tile large"><Icon name="bell" /></span>
          <div><strong>Browser notifications</strong><p>Receive alerts even when another tab is currently open.</p></div>
        </div>
        <div className="browser-actions">
          <PermissionLabel permission={permission} />
          {permission === "granted" && preferences.browserNotifications
            ? <><button className="secondary-button" type="button" onClick={sendTestNotification}>Send test</button><button className="text-action" type="button" onClick={() => toggleBrowserNotifications(false)}>Disable</button></>
            : <button className="primary-button compact-button" type="button" disabled={permission === "denied" || permission === "unsupported"} onClick={() => toggleBrowserNotifications(true)}><Icon name="bell" size={17} /> Enable</button>}
        </div>
      </section>

      <div className="notifications-layout">
        <section className="notification-panel notice-center">
          <div className="notification-panel-heading">
            <div><p className="eyebrow">Notification centre</p><h2>Current alerts</h2></div>
            {preferences.dismissedIds.length > 0 && <button className="text-action" type="button" onClick={notificationStore.restoreDismissed}>Restore hidden alerts</button>}
          </div>

          {notices.length === 0
            ? <div className="all-clear"><span className="icon-tile large"><Icon name="check" /></span><strong>Everything looks good</strong><p>There are currently no open alerts.</p></div>
            : <div className="notice-list">{notices.map((notice) => <NoticeRow key={notice.id} notice={notice} onDismiss={() => notificationStore.dismiss(notice.id)} />)}</div>}
        </section>

        <section className="notification-panel settings-panel">
          <div className="notification-panel-heading"><div><p className="eyebrow"></p><h2>Settings</h2></div><Icon name="settings" /></div>
          <SettingToggle title="Consumption alerts" text="Notify me about unusual deviations." checked={preferences.consumptionAlerts} onChange={(value) => notificationStore.update({ consumptionAlerts: value })} />
          <SettingToggle title="Meter reading reminders" text="Remind me regularly to take a new reading." checked={preferences.meterReminders} onChange={(value) => notificationStore.update({ meterReminders: value })} />
          {preferences.meterReminders && <label className="setting-select">Reminder interval<select value={preferences.meterReminderDays} onChange={(event) => notificationStore.update({ meterReminderDays: Number(event.target.value) })}><option value="7">Weekly</option><option value="14">Every two weeks</option><option value="30">Monthly</option><option value="90">Quarterly</option></select></label>}
          <SettingToggle title="Real-time price alerts" text="Notify me about particularly high or low prices." checked={preferences.realtimeTips} onChange={(value) => notificationStore.update({ realtimeTips: value })} />

          <details className="advanced-settings">
            <summary>Thresholds &amp; quiet hours</summary>
            <div className="settings-grid">
              <label>Consumption deviation<div className="input-unit"><input min="10" max="100" step="5" type="number" value={preferences.anomalyThresholdPercent} onChange={(event) => notificationStore.update({ anomalyThresholdPercent: Number(event.target.value) })} /><span>%</span></div></label>
              <label>High electricity price<div className="input-unit"><input min="0" step="1" type="number" value={preferences.highPriceThresholdCent} onChange={(event) => notificationStore.update({ highPriceThresholdCent: Number(event.target.value) })} /><span>ct/kWh</span></div></label>
              <label>Low electricity price<div className="input-unit"><input min="0" step="1" type="number" value={preferences.lowPriceThresholdCent} onChange={(event) => notificationStore.update({ lowPriceThresholdCent: Number(event.target.value) })} /><span>ct/kWh</span></div></label>
              <div className="quiet-time-inputs"><label>Quiet hours from<input type="time" value={preferences.quietStart} onChange={(event) => notificationStore.update({ quietStart: event.target.value })} /></label><label>to<input type="time" value={preferences.quietEnd} onChange={(event) => notificationStore.update({ quietEnd: event.target.value })} /></label></div>
            </div>
          </details>
        </section>
      </div>

      <p className="frontend-notice"><Icon name="alert" size={15} /> Without a push backend, notifications are only processed while Energy Warden is open in the browser.</p>
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
        title: deviation > 0 ? "Unusually high consumption" : "Significantly lower consumption",
        text: `Consumption in ${current.label} is ${decimal.format(Math.abs(deviation))}% ${deviation > 0 ? "above" : "below"} the average of the previous three months.`,
        meta: "Consumption analysis",
      });
    }
  }

  if (preferences.meterReminders) {
    const due = getNextReadingDate(latestReadingDate, preferences.meterReminderDays);
    if (!latestReadingDate || due.overdue) {
      notices.push({
        id: `meter-${latestReadingDate ?? "missing"}-${preferences.meterReminderDays}`,
        kind: "reminder",
        title: latestReadingDate ? "Meter reading is due" : "Record your first meter reading",
        text: latestReadingDate ? `Your last reading was on ${formatDate(latestReadingDate)}. A new value improves the analysis and forecast.` : "Your first reading creates the foundation for tracking your consumption trend.",
        meta: latestReadingDate ? `${due.daysOverdue} days overdue` : "No reading yet",
      });
    }
  }

  if (preferences.realtimeTips && priceStatus === "ready" && marketPrice !== null) {
    const cent = estimatedHouseholdPriceCentKwh(marketPrice);
    if (cent >= preferences.highPriceThresholdCent) {
      notices.push({ id: `price-high-${Math.round(cent)}`, kind: "tip", title: "Electricity price currently elevated", text: `At an estimated ${cent.toFixed(2)} ct/kWh, the variable total price is above your threshold. It is better to use shiftable appliances later.`, meta: "Live price alert" });
    } else if (cent <= preferences.lowPriceThresholdCent) {
      notices.push({ id: `price-low-${Math.round(cent)}`, kind: "tip", title: "Favourable time window", text: `The variable total price is estimated at ${cent.toFixed(2)} ct/kWh. This is a good time for shiftable loads.`, meta: "Live price alert" });
    }
  }

  return notices;
}

/** Berechnet das nächste Ablesedatum und einen menschenlesbaren Fälligkeitsstatus. */
function getNextReadingDate(latestReadingDate: string | undefined, interval: number) {
  if (!latestReadingDate) return { label: "Now", note: "first reading pending", overdue: true, daysOverdue: 0 };
  const due = new Date(`${latestReadingDate}T00:00:00`);
  due.setDate(due.getDate() + interval);
  const diff = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  return {
    label: diff <= 0 ? "Due now" : formatDate(due.toISOString().slice(0, 10)),
    note: diff <= 0 ? `${Math.abs(diff)} days overdue` : `${diff} days remaining`,
    overdue: diff <= 0,
    daysOverdue: Math.abs(diff),
  };
}

/** Formatiert ein Eingabedatum in deutscher Schreibweise ohne UTC-Verschiebung. */
function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB");
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
  const text = permission === "granted" ? "Allowed" : permission === "denied" ? "Blocked in browser" : permission === "unsupported" ? "Not supported" : "Not enabled";
  return <span className={`permission-label ${permission}`}>{text}</span>;
}

/** Einzelner ausblendbarer Hinweis mit typabhängiger Gestaltung. */
function NoticeRow({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const icon = notice.kind === "warning" ? "alert" : notice.kind === "reminder" ? "clock" : "trend";
  return <article className={`notice-row ${notice.kind}`}><span className="notice-icon"><Icon name={icon} /></span><span className="notice-copy"><span><em>{notice.meta}</em><strong>{notice.title}</strong></span><p>{notice.text}</p></span><button className="icon-button" type="button" aria-label={`Hide ${notice.title}`} onClick={onDismiss}><Icon name="close" size={17} /></button></article>;
}

/** Zugänglicher Schalter für eine Benachrichtigungskategorie. */
function SettingToggle({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="setting-toggle"><span><strong>{title}</strong><small>{text}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
