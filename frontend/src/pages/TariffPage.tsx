import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getCurrentPrice, getPriceData } from "../api/energyWardenApi";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import { useTariffData } from "../hooks/useTariffData";
import type { ConsumptionData, PriceData, Tariff } from "../types/energyWarden";
import { buildDynamicDayComparison } from "../utils/dynamicTariffUtils";
import { dynamicBasePriceMonthly, formatCentKwh, formatEstimatedHouseholdPrice, priceSurchargeCentKwh } from "../utils/priceUtils";

type Tab = "tariff" | "calculator" | "compare";

const today = new Date().toISOString().slice(0, 10);
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const decimal = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Berechnet die jährlichen Gesamtkosten eines Tarifs für eine Verbrauchsmenge. */
function annualCost(tariff: Tariff, usage: number) {
  return tariff.basePriceMonthly * 12 + tariff.unitPrice * usage;
}

/** Leitet den Jahresverbrauch bevorzugt aus Zählerständen, Rechnung oder Geräten ab. */
function deriveAnnualElectricity(data: ConsumptionData) {
  const readings = [...data.meterReadings].sort((a, b) => a.readingDate.localeCompare(b.readingDate));
  const latest = readings.at(-1);
  if (latest) {
    const first = readings.find((item) => item.meterNumber === latest.meterNumber && item.readingDate < latest.readingDate);
    if (first && latest.readingKwh >= first.readingKwh) {
      const days = (Date.parse(latest.readingDate) - Date.parse(first.readingDate)) / 86_400_000;
      if (days > 0) return (latest.readingKwh - first.readingKwh) / days * 365;
    }
  }

  const invoice = [...data.invoices].sort((a, b) => b.billingEnd.localeCompare(a.billingEnd))[0];
  if (invoice) {
    const days = (Date.parse(invoice.billingEnd) - Date.parse(invoice.billingStart)) / 86_400_000;
    if (days > 0) return invoice.consumptionKwh / days * 365;
  }

  return data.applianceEstimates.reduce((sum, item) => sum + item.annualConsumptionKwh, 0);
}

/** Hauptseite für individuelle Tarife, Kostenrechner und Tarifvergleich. */
export default function TariffPage() {
  const [tab, setTab] = useState<Tab>("tariff");
  const tariffs = useTariffData();
  const consumption = useConsumptionData();
  const annualElectricity = deriveAnnualElectricity(consumption.data);
  const currentElectricity = tariffs.data.tariffs.find((tariff) => tariff.isCurrent);
  const potentialSavings = currentElectricity
    ? Math.max(0, annualCost(currentElectricity, annualElectricity) - Math.min(
        ...tariffs.data.tariffs.map((tariff) => annualCost(tariff, annualElectricity)),
      ))
    : 0;

  return (
    <main className="page-content tariff-page">
      <div className="page-heading heading-row">
        <div>
          <p className="eyebrow">Tarif- und Kostenermittlung</p>
          <h1>Tarife &amp; Kosten</h1>
          <p className="subtitle">Verstehe deine laufenden Kosten und finde den Tarif, der zu deinem Verbrauch passt.</p>
        </div>
        <span className="local-badge"><span /> Tarifdaten lokal gespeichert</span>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="icon-tile"><Icon name="tariff" /></span>
          <span><small>Aktueller Stromtarif</small><strong>{currentElectricity ? currentElectricity.name : "Noch nicht erfasst"}</strong></span>
        </article>
        <article className="stat-card">
          <span className="icon-tile"><Icon name="calculator" /></span>
          <span><small>Hochgerechneter Verbrauch</small><strong>{annualElectricity ? `${decimal.format(annualElectricity)} kWh/Jahr` : "Keine Datengrundlage"}</strong></span>
        </article>
        <article className="stat-card">
          <span className="icon-tile"><Icon name="compare" /></span>
          <span><small>Mögliches Einsparpotenzial</small><strong>{euro.format(potentialSavings)} / Jahr</strong></span>
        </article>
      </div>

      <DynamicPrice />

      <div className="workspace-card tariff-workspace">
        <div className="tabs" role="tablist" aria-label="Tarif- und Kostenfunktionen">
          <TabButton active={tab === "tariff"} icon="tariff" label="Tarif erfassen" onClick={() => setTab("tariff")} />
          <TabButton active={tab === "calculator"} icon="calculator" label="Kosten berechnen" onClick={() => setTab("calculator")} />
          <TabButton active={tab === "compare"} icon="compare" label="Tarife vergleichen" onClick={() => setTab("compare")} />
        </div>
        <div className="tab-content">
          {tab === "tariff" && <TariffForm tariffs={tariffs.data.tariffs} onSave={tariffs.addTariff} onCurrent={tariffs.setCurrent} onRemove={tariffs.removeTariff} />}
          {tab === "calculator" && <CostCalculator tariffs={tariffs.data.tariffs} annualElectricity={annualElectricity} />}
          {tab === "compare" && <TariffComparison tariffs={tariffs.data.tariffs} annualElectricity={annualElectricity} consumption={consumption.data} onCurrent={tariffs.setCurrent} />}
        </div>
      </div>
    </main>
  );
}

/** Lädt den dynamischen Börsenpreis und bildet Lade- sowie Fehlerzustände ab. */
function DynamicPrice() {
  const [price, setPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    getCurrentPrice()
      .then((value) => { setPrice(value); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [reload]);

  /** Setzt den Ladezustand zurück und stößt den API-Aufruf erneut an. */
  function retry() {
    setStatus("loading");
    setReload((value) => value + 1);
  }

  return (
    <section className="live-price-card">
      <div className="live-price-heading">
        <span className="live-dot" />
        <div><strong>Geschätzter Haushaltsstrompreis</strong><small>Deutscher Börsenpreis plus variable Preisbestandteile</small></div>
      </div>
      <div className="live-price-value">
        {status === "loading" && <span className="muted-value">Wird geladen …</span>}
        {status === "ready" && price !== null && <><strong>{formatEstimatedHouseholdPrice(price)}</strong><small>Börse {formatCentKwh(price)} + pauschal {priceSurchargeCentKwh.toFixed(2).replace(".", ",")} ct/kWh · ohne Grundpreis</small></>}
        {status === "error" && <><span className="muted-value">Preisschnittstelle nicht erreichbar</span><button className="text-button" type="button" onClick={retry}><Icon name="refresh" size={17} /> Erneut abrufen</button></>}
      </div>
    </section>
  );
}

/** Navigationsbutton für die drei Tarifwerkzeuge. */
function TabButton({ active, icon, label, onClick }: { active: boolean; icon: "tariff" | "calculator" | "compare"; label: string; onClick: () => void }) {
  return <button className={active ? "tab active" : "tab"} type="button" role="tab" aria-selected={active} onClick={onClick}><Icon name={icon} size={20} /> {label}</button>;
}

/** Formular zur manuellen Erfassung eines Stromtarifs. */
function TariffForm({ tariffs, onSave, onCurrent, onRemove }: { tariffs: Tariff[]; onSave: (tariff: Tariff) => void; onCurrent: (id: string) => void; onRemove: (id: string) => void }) {
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [validFrom, setValidFrom] = useState(today);
  const [isCurrent, setIsCurrent] = useState(true);
  const [saved, setSaved] = useState(false);

  /** Normalisiert Cent/kWh zu Euro/kWh und speichert den neuen Tarif. */
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: crypto.randomUUID(), provider, name,
      unitPrice: Number(unitPrice) / 100,
      basePriceMonthly: Number(basePrice), validFrom, isCurrent,
      createdAt: new Date().toISOString(),
    });
    setProvider(""); setName(""); setUnitPrice(""); setBasePrice("");
    setSaved(true); window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div>
      <div className="form-intro"><span className="icon-tile large"><Icon name="tariff" size={26} /></span><div><h2>Individuellen Tarif erfassen</h2><p>Hinterlege Arbeits- und Grundpreis für eine realistische Kostenberechnung.</p></div></div>
      <form onSubmit={submit}>
        <div className="form-grid tariff-form-grid">
          <label>Anbieter<input required value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="z. B. Stadtwerke" /></label>
          <label>Tarifname<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="z. B. ÖkoFix 24" /></label>
          <label>Arbeitspreis<div className="input-unit"><input required min="0" step="0.01" type="number" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /><span>ct/kWh</span></div></label>
          <label>Grundpreis pro Monat<div className="input-unit"><input required min="0" step="0.01" type="number" value={basePrice} onChange={(event) => setBasePrice(event.target.value)} /><span>€</span></div></label>
          <label>Gültig seit<input required max={today} type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={isCurrent} onChange={(event) => setIsCurrent(event.target.checked)} /><span>Als aktuellen Tarif verwenden<small>Ersetzt den bisher aktiven Stromtarif.</small></span></label>
        </div>
        <button className={saved ? "primary-button saved" : "primary-button"} type="submit"><Icon name={saved ? "check" : "tariff"} size={19} />{saved ? "Gespeichert" : "Tarif speichern"}</button>
      </form>

      <SavedTariffs tariffs={tariffs} onCurrent={onCurrent} onRemove={onRemove} />
    </div>
  );
}

/** Listet gespeicherte Tarife mit Aktivieren- und Löschen-Aktionen auf. */
function SavedTariffs({ tariffs, onCurrent, onRemove }: { tariffs: Tariff[]; onCurrent: (id: string) => void; onRemove: (id: string) => void }) {
  return (
    <div className="saved-tariffs">
      <div className="subheading"><h3>Gespeicherte Tarife</h3><span>{tariffs.length}</span></div>
      {tariffs.length === 0 ? <p className="inline-empty">Noch keine Tarife erfasst.</p> : tariffs.map((tariff) => (
        <div className="saved-tariff-row" key={tariff.id}>
          <span className="utility-symbol electricity">⚡</span>
          <span className="tariff-row-main"><strong>{tariff.name}{tariff.isCurrent && <em>Aktuell</em>}</strong><small>{tariff.provider} · {(tariff.unitPrice * 100).toFixed(2).replace(".", ",")} ct/kWh · {euro.format(tariff.basePriceMonthly)}/Monat</small></span>
          {!tariff.isCurrent && <button className="secondary-button" type="button" onClick={() => onCurrent(tariff.id)}>Als aktuell</button>}
          <button className="icon-button" type="button" aria-label={`${tariff.name} löschen`} onClick={() => onRemove(tariff.id)}><Icon name="trash" size={18} /></button>
        </div>
      ))}
    </div>
  );
}

/** Berechnet Kosten für einen frei wählbaren Tarif und Jahresverbrauch. */
function CostCalculator({ tariffs, annualElectricity }: { tariffs: Tariff[]; annualElectricity: number }) {
  const initial = tariffs.find((tariff) => tariff.isCurrent) ?? tariffs[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const selected = tariffs.find((tariff) => tariff.id === selectedId) ?? initial;
  const [usage, setUsage] = useState(annualElectricity ? annualElectricity.toFixed(1) : "");
  const usageNumber = Number(usage) || 0;
  const variableCost = selected ? selected.unitPrice * usageNumber : 0;
  const baseCost = selected ? selected.basePriceMonthly * 12 : 0;

  /** Wechselt den Tarif und übernimmt die vorhandene Verbrauchshochrechnung. */
  function selectTariff(id: string) {
    setSelectedId(id);
    const tariff = tariffs.find((item) => item.id === id);
    setUsage(tariff && annualElectricity ? annualElectricity.toFixed(1) : "");
  }

  if (!selected) return <FeatureEmpty icon="calculator" title="Noch kein Tarif für die Berechnung" text="Erfasse zuerst einen Stromtarif." />;

  return (
    <div>
      <div className="form-intro"><span className="icon-tile large"><Icon name="calculator" size={26} /></span><div><h2>Verbrauchskosten berechnen</h2><p>Grundpreis und Verbrauchspreis werden transparent aufgeschlüsselt.</p></div></div>
      <div className="form-grid">
        <label>Tarif<select value={selected.id} onChange={(event) => selectTariff(event.target.value)}>{tariffs.map((tariff) => <option key={tariff.id} value={tariff.id}>{tariff.name} · {tariff.provider}</option>)}</select></label>
        <label>Jahresverbrauch<div className="input-unit"><input min="0" step="0.1" type="number" value={usage} onChange={(event) => setUsage(event.target.value)} /><span>kWh</span></div></label>
      </div>
      {annualElectricity > 0 && <p className="data-hint"><Icon name="check" size={16} /> Verbrauch aus deinen vorhandenen Eingaben hochgerechnet.</p>}
      <div className="cost-result">
        <div className="cost-total"><span>Geschätzte Gesamtkosten<small>{euro.format((baseCost + variableCost) / 12)} pro Monat</small></span><strong>{euro.format(baseCost + variableCost)}<small>pro Jahr</small></strong></div>
        <div className="cost-breakdown"><span>Verbrauchskosten <strong>{euro.format(variableCost)}</strong></span><span>Grundpreis <strong>{euro.format(baseCost)}</strong></span></div>
      </div>
    </div>
  );
}

/** Vergleicht Stromtarife bei identischem Verbrauch. */
function TariffComparison({ tariffs, annualElectricity, consumption, onCurrent }: { tariffs: Tariff[]; annualElectricity: number; consumption: ConsumptionData; onCurrent: (id: string) => void }) {
  const [usage, setUsage] = useState(annualElectricity ? annualElectricity.toFixed(1) : "");
  const matching = useMemo(() => [...tariffs].sort((a, b) => annualCost(a, Number(usage)) - annualCost(b, Number(usage))), [tariffs, usage]);
  const current = matching.find((tariff) => tariff.isCurrent);
  const currentCost = current ? annualCost(current, Number(usage)) : null;

  return (
    <div>
      <div className="form-intro"><span className="icon-tile large"><Icon name="compare" size={26} /></span><div><h2>Tarife vergleichen</h2><p>Vergleiche die erwarteten Gesamtkosten bei identischem Verbrauch.</p></div></div>
      <div className="comparison-controls"><label>Jahresverbrauch<div className="input-unit"><input min="0" step="0.1" type="number" value={usage} onChange={(event) => setUsage(event.target.value)} /><span>kWh</span></div></label></div>
      {matching.length < 2 ? <FeatureEmpty icon="compare" title="Mindestens zwei Tarife benötigt" text="Erfasse einen weiteren Stromtarif, um Kosten gegenüberzustellen." /> : (
        <div className="comparison-list">{matching.map((tariff, index) => {
          const cost = annualCost(tariff, Number(usage));
          const difference = currentCost === null ? null : currentCost - cost;
          return <article className={`comparison-card ${index === 0 ? "best" : ""}`} key={tariff.id}>
            <div><span className="utility-symbol electricity">⚡</span>{index === 0 && <em className="best-label">Günstigster Tarif</em>}</div>
            <h3>{tariff.name}</h3><p>{tariff.provider}</p>
            <strong className="comparison-price">{euro.format(cost)}<small>pro Jahr</small></strong>
            {difference !== null && difference > 0 && <span className="saving-label">Du sparst {euro.format(difference)}</span>}
            {tariff.isCurrent ? <span className="current-label">Dein aktueller Tarif</span> : <button className="secondary-button full" type="button" onClick={() => onCurrent(tariff.id)}>Als aktuell festlegen</button>}
          </article>;
        })}</div>
      )}
      <DynamicDayComparison tariffs={tariffs} annualElectricity={Number(usage)} consumption={consumption} />
    </div>
  );
}

/** Verbindet heutige Börsenpreise mit einem synthetischen Lastprofil und flexiblen Geräten. */
function DynamicDayComparison({ tariffs, annualElectricity, consumption }: { tariffs: Tariff[]; annualElectricity: number; consumption: ConsumptionData }) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    getPriceData()
      .then((values) => { setPrices(values); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, []);

  const comparison = useMemo(
    () => buildDynamicDayComparison(prices, annualElectricity, consumption.applianceEstimates, tariffs),
    [annualElectricity, consumption.applianceEstimates, prices, tariffs],
  );

  if (status === "loading") {
    return <section className="dynamic-comparison"><p className="dynamic-status">Tagespreise und Lastprofil werden berechnet …</p></section>;
  }
  if (status === "error") {
    return <section className="dynamic-comparison"><FeatureEmpty icon="compare" title="Dynamischer Vergleich nicht verfügbar" text="Die Tagespreise konnten nicht vom Backend geladen werden." /></section>;
  }
  if (annualElectricity <= 0) {
    return <section className="dynamic-comparison"><FeatureEmpty icon="compare" title="Verbrauchsdaten fehlen" text="Erfasse Verbrauchsdaten, damit ein repräsentativer Tag simuliert werden kann." /></section>;
  }
  if (!comparison) {
    return <section className="dynamic-comparison"><FeatureEmpty icon="compare" title="Tagespreise unvollständig" text="Synchronisiere das Backend erneut, damit alle Stunden des Tages verfügbar sind." /></section>;
  }

  const reference = comparison.fixedCosts.find((entry) => entry.tariff.isCurrent)
    ?? comparison.fixedCosts[0];
  const shiftSaving = comparison.dynamicBeforeEur - comparison.dynamicOptimizedEur;
  const referenceSaving = reference ? reference.costEur - comparison.dynamicOptimizedEur : null;
  const pricesCent = comparison.hourly.map((hour) => hour.totalPriceCentKwh);
  const minPrice = Math.min(...pricesCent);
  const maxPrice = Math.max(...pricesCent);
  const priceRange = Math.max(1, maxPrice - minPrice);

  return (
    <section className="dynamic-comparison">
      <div className="dynamic-comparison-heading">
        <div><p className="eyebrow">Live-PoC</p><h3>Dynamischer Tagesvergleich</h3><p>Gleicher Verbrauch, heutige deutsche Börsenpreise und automatisch verschobene flexible Geräte.</p></div>
        <span>{decimal.format(comparison.dailyConsumptionKwh)} kWh/Tag</span>
      </div>

      <div className="dynamic-cost-grid">
        {reference && <DynamicCostCard label="Gespeicherter Fix-Tarif" name={reference.tariff.name} cost={reference.costEur} note={`${(reference.tariff.unitPrice * 100).toFixed(2).replace(".", ",")} ct/kWh inkl. Grundpreis`} />}
        <DynamicCostCard label="Dynamischer Tarif" name="Ohne Verschieben" cost={comparison.dynamicBeforeEur} note="Typische Nutzungszeiten" />
        <DynamicCostCard label="Dynamischer Tarif" name="Optimierter Betrieb" cost={comparison.dynamicOptimizedEur} note={shiftSaving > 0.001 ? `${euro.format(shiftSaving)} pro Tag durch Verschieben` : "Heute kein zusätzliches Verschiebepotenzial"} best />
      </div>

      <div className="hourly-simulation">
        <div className="hourly-simulation-heading"><strong>Preisverlauf &amp; optimierte Laufzeiten</strong><span>{minPrice.toFixed(1).replace(".", ",")}–{maxPrice.toFixed(1).replace(".", ",")} ct/kWh</span></div>
        <div className="hourly-price-bars" role="img" aria-label="Stündliche Gesamtpreise; grüne Balken markieren optimierte Gerätelaufzeiten">
          {comparison.hourly.map((hour, index) => {
            const height = 22 + (hour.totalPriceCentKwh - minPrice) / priceRange * 78;
            const flexible = hour.optimizedFlexibleLoadKwh > 0;
            return <span className={flexible ? "flexible" : ""} key={hour.timestamp} title={`${new Date(hour.timestamp * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}: ${hour.totalPriceCentKwh.toFixed(2)} ct/kWh · ${hour.optimizedLoadKwh.toFixed(2)} kWh`}><i style={{ height: `${height}%` }} /><small>{index % 3 === 0 ? `${new Date(hour.timestamp * 1000).getHours()} Uhr` : ""}</small></span>;
          })}
        </div>
      </div>

      <div className="shifted-device-list">
        <strong>Automatisch verschobene Geräte</strong>
        {comparison.shiftedDevices.length === 0
          ? <p>In den erfassten Daten wurden noch keine flexibel verschiebbaren Geräte erkannt.</p>
          : comparison.shiftedDevices.map((device) => <div key={device.id}><span><Icon name="clock" size={16} /><strong>{device.name}</strong></span><span>{String(device.previousStartHour).padStart(2, "0")}:00 → {String(device.optimizedStartHour).padStart(2, "0")}:00<small>{decimal.format(device.energyKwh)} kWh · {device.durationHours} Std.</small></span></div>)}
      </div>

      <p className="dynamic-assumptions"><Icon name="alert" size={14} /> Modellrechnung: synthetisches Haushaltsprofil, Ø Tagesverbrauch aus der Jahreshochrechnung, {priceSurchargeCentKwh.toFixed(2).replace(".", ",")} ct/kWh variable Aufschläge und {euro.format(dynamicBasePriceMonthly)} dynamischer Grundpreis pro Monat. {comparison.estimatedPriceHours > 0 && `${comparison.estimatedPriceHours} fehlende Preisstunden wurden mit dem Mittel der verfügbaren API-Werte ergänzt. `}{referenceSaving !== null && `Gegenüber dem Referenztarif ergibt das heute ${referenceSaving >= 0 ? "eine Ersparnis von" : "Mehrkosten von"} ${euro.format(Math.abs(referenceSaving))}.`}</p>
    </section>
  );
}

/** Kostenkarte für einen simulierten Tarif am repräsentativen Tag. */
function DynamicCostCard({ label, name, cost, note, best = false }: { label: string; name: string; cost: number; note: string; best?: boolean }) {
  return <article className={best ? "dynamic-cost-card best" : "dynamic-cost-card"}><small>{label}</small><strong>{name}</strong><em>{euro.format(cost)}<small>für diesen Tag</small></em><p>{note}</p></article>;
}

/** Wiederverwendbarer Leerzustand für noch nicht nutzbare Tariffunktionen. */
function FeatureEmpty({ icon, title, text }: { icon: "calculator" | "compare"; title: string; text: string }) {
  return <div className="feature-empty"><span className="icon-tile large"><Icon name={icon} /></span><strong>{title}</strong><p>{text}</p></div>;
}
