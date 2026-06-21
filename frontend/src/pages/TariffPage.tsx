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
const euro = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });
const decimal = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

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
          <p className="eyebrow">Tariffs and cost calculation</p>
          <h1>Tariffs &amp; Costs</h1>
          <p className="subtitle">Understand your ongoing costs and find the tariff that fits your consumption.</p>
        </div>
        <span className="local-badge"><span /> Tariff data stored locally</span>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="icon-tile"><Icon name="tariff" /></span>
          <span><small>Current electricity tariff</small><strong>{currentElectricity ? currentElectricity.name : "Not recorded yet"}</strong></span>
        </article>
        <article className="stat-card">
          <span className="icon-tile"><Icon name="calculator" /></span>
          <span><small>Projected consumption</small><strong>{annualElectricity ? `${decimal.format(annualElectricity)} kWh/year` : "No data available"}</strong></span>
        </article>
        <article className="stat-card">
          <span className="icon-tile"><Icon name="compare" /></span>
          <span><small>Potential savings</small><strong>{euro.format(potentialSavings)} / year</strong></span>
        </article>
      </div>

      <DynamicPrice />

      <div className="workspace-card tariff-workspace">
        <div className="tabs" role="tablist" aria-label="Tariff and cost features">
          <TabButton active={tab === "tariff"} icon="tariff" label="Add tariff" onClick={() => setTab("tariff")} />
          <TabButton active={tab === "calculator"} icon="calculator" label="Calculate costs" onClick={() => setTab("calculator")} />
          <TabButton active={tab === "compare"} icon="compare" label="Compare tariffs" onClick={() => setTab("compare")} />
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
        <div><strong>Estimated household electricity price</strong><small>German wholesale price plus variable price components</small></div>
      </div>
      <div className="live-price-value">
        {status === "loading" && <span className="muted-value">Loading…</span>}
        {status === "ready" && price !== null && <><strong>{formatEstimatedHouseholdPrice(price)}</strong><small>Wholesale {formatCentKwh(price)} + flat {priceSurchargeCentKwh.toFixed(2)} ct/kWh · excluding base charge</small></>}
        {status === "error" && <><span className="muted-value">Price interface unavailable</span><button className="text-button" type="button" onClick={retry}><Icon name="refresh" size={17} /> Try again</button></>}
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
      <div className="form-intro"><span className="icon-tile large"><Icon name="tariff" size={26} /></span><div><h2>Add an individual tariff</h2><p>Enter the unit price and base charge for a realistic cost calculation.</p></div></div>
      <form onSubmit={submit}>
        <div className="form-grid tariff-form-grid">
          <label>Provider<input required value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="e.g. municipal utilities" /></label>
          <label>Tariff name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. EcoFix 24" /></label>
          <label>Unit price<div className="input-unit"><input required min="0" step="0.01" type="number" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /><span>ct/kWh</span></div></label>
          <label>Base charge per month<div className="input-unit"><input required min="0" step="0.01" type="number" value={basePrice} onChange={(event) => setBasePrice(event.target.value)} /><span>€</span></div></label>
          <label>Valid from<input required max={today} type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={isCurrent} onChange={(event) => setIsCurrent(event.target.checked)} /><span>Use as current tariff<small>Replaces the currently active electricity tariff.</small></span></label>
        </div>
        <button className={saved ? "primary-button saved" : "primary-button"} type="submit"><Icon name={saved ? "check" : "tariff"} size={19} />{saved ? "Saved" : "Save tariff"}</button>
      </form>

      <SavedTariffs tariffs={tariffs} onCurrent={onCurrent} onRemove={onRemove} />
    </div>
  );
}

/** Listet gespeicherte Tarife mit Aktivieren- und Löschen-Aktionen auf. */
function SavedTariffs({ tariffs, onCurrent, onRemove }: { tariffs: Tariff[]; onCurrent: (id: string) => void; onRemove: (id: string) => void }) {
  return (
    <div className="saved-tariffs">
      <div className="subheading"><h3>Saved tariffs</h3><span>{tariffs.length}</span></div>
      {tariffs.length === 0 ? <p className="inline-empty">No tariffs recorded yet.</p> : tariffs.map((tariff) => (
        <div className="saved-tariff-row" key={tariff.id}>
          <span className="utility-symbol electricity">⚡</span>
          <span className="tariff-row-main"><strong>{tariff.name}{tariff.isCurrent && <em>Current</em>}</strong><small>{tariff.provider} · {(tariff.unitPrice * 100).toFixed(2)} ct/kWh · {euro.format(tariff.basePriceMonthly)}/month</small></span>
          {!tariff.isCurrent && <button className="secondary-button" type="button" onClick={() => onCurrent(tariff.id)}>Set as current</button>}
          <button className="icon-button" type="button" aria-label={`Delete ${tariff.name}`} onClick={() => onRemove(tariff.id)}><Icon name="trash" size={18} /></button>
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

  if (!selected) return <FeatureEmpty icon="calculator" title="No tariff available for calculation" text="Add an electricity tariff first." />;

  return (
    <div>
      <div className="form-intro"><span className="icon-tile large"><Icon name="calculator" size={26} /></span><div><h2>Calculate consumption costs</h2><p>The base charge and consumption cost are shown separately.</p></div></div>
      <div className="form-grid">
        <label>Tariff<select value={selected.id} onChange={(event) => selectTariff(event.target.value)}>{tariffs.map((tariff) => <option key={tariff.id} value={tariff.id}>{tariff.name} · {tariff.provider}</option>)}</select></label>
        <label>Annual consumption<div className="input-unit"><input min="0" step="0.1" type="number" value={usage} onChange={(event) => setUsage(event.target.value)} /><span>kWh</span></div></label>
      </div>
      {annualElectricity > 0 && <p className="data-hint"><Icon name="check" size={16} /> Consumption projected from your existing entries.</p>}
      <div className="cost-result">
        <div className="cost-total"><span>Estimated total cost<small>{euro.format((baseCost + variableCost) / 12)} per month</small></span><strong>{euro.format(baseCost + variableCost)}<small>per year</small></strong></div>
        <div className="cost-breakdown"><span>Consumption cost <strong>{euro.format(variableCost)}</strong></span><span>Base charge <strong>{euro.format(baseCost)}</strong></span></div>
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
      <div className="form-intro"><span className="icon-tile large"><Icon name="compare" size={26} /></span><div><h2>Compare tariffs</h2><p>Compare expected total costs at the same consumption level.</p></div></div>
      <div className="comparison-controls"><label>Annual consumption<div className="input-unit"><input min="0" step="0.1" type="number" value={usage} onChange={(event) => setUsage(event.target.value)} /><span>kWh</span></div></label></div>
      {matching.length < 2 ? <FeatureEmpty icon="compare" title="At least two tariffs required" text="Add another electricity tariff to compare costs." /> : (
        <div className="comparison-list">{matching.map((tariff, index) => {
          const cost = annualCost(tariff, Number(usage));
          const difference = currentCost === null ? null : currentCost - cost;
          return <article className={`comparison-card ${index === 0 ? "best" : ""}`} key={tariff.id}>
            <div><span className="utility-symbol electricity">⚡</span>{index === 0 && <em className="best-label">Cheapest tariff</em>}</div>
            <h3>{tariff.name}</h3><p>{tariff.provider}</p>
            <strong className="comparison-price">{euro.format(cost)}<small>per year</small></strong>
            {difference !== null && difference > 0 && <span className="saving-label">You save {euro.format(difference)}</span>}
            {tariff.isCurrent ? <span className="current-label">Your current tariff</span> : <button className="secondary-button full" type="button" onClick={() => onCurrent(tariff.id)}>Set as current</button>}
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
    return <section className="dynamic-comparison"><p className="dynamic-status">Calculating daily prices and load profile…</p></section>;
  }
  if (status === "error") {
    return <section className="dynamic-comparison"><FeatureEmpty icon="compare" title="Dynamic comparison unavailable" text="Daily prices could not be loaded from the backend." /></section>;
  }
  if (annualElectricity <= 0) {
    return <section className="dynamic-comparison"><FeatureEmpty icon="compare" title="Consumption data missing" text="Record consumption data to simulate a representative day." /></section>;
  }
  if (!comparison) {
    return <section className="dynamic-comparison"><FeatureEmpty icon="compare" title="Daily prices incomplete" text="Synchronise the backend again so that all hours of the day are available." /></section>;
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
        <div><p className="eyebrow">Live PoC</p><h3>Dynamic daily comparison</h3><p>Same consumption, today's German wholesale prices and automatically shifted flexible appliances.</p></div>
        <span>{decimal.format(comparison.dailyConsumptionKwh)} kWh/day</span>
      </div>

      <div className="dynamic-cost-grid">
        {reference && <DynamicCostCard label="Saved fixed tariff" name={reference.tariff.name} cost={reference.costEur} note={`${(reference.tariff.unitPrice * 100).toFixed(2)} ct/kWh incl. base charge`} />}
        <DynamicCostCard label="Dynamic tariff" name="Without shifting" cost={comparison.dynamicBeforeEur} note="Typical usage times" />
        <DynamicCostCard label="Dynamic tariff" name="Optimised operation" cost={comparison.dynamicOptimizedEur} note={shiftSaving > 0.001 ? `${euro.format(shiftSaving)} per day from shifting` : "No additional shifting potential today"} best />
      </div>

      <div className="hourly-simulation">
        <div className="hourly-simulation-heading"><strong>Price trend &amp; optimised runtimes</strong><span>{minPrice.toFixed(1)}–{maxPrice.toFixed(1)} ct/kWh</span></div>
        <div className="hourly-price-bars" role="img" aria-label="Hourly total prices; green bars mark optimised appliance runtimes">
          {comparison.hourly.map((hour, index) => {
            const height = 22 + (hour.totalPriceCentKwh - minPrice) / priceRange * 78;
            const flexible = hour.optimizedFlexibleLoadKwh > 0;
            return <span className={flexible ? "flexible" : ""} key={hour.timestamp} title={`${new Date(hour.timestamp * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}: ${hour.totalPriceCentKwh.toFixed(2)} ct/kWh · ${hour.optimizedLoadKwh.toFixed(2)} kWh`}><i style={{ height: `${height}%` }} /><small>{index % 3 === 0 ? `${new Date(hour.timestamp * 1000).getHours()}:00` : ""}</small></span>;
          })}
        </div>
      </div>

      <div className="shifted-device-list">
        <strong>Automatically shifted appliances</strong>
        {comparison.shiftedDevices.length === 0
          ? <p>No flexibly shiftable appliances have been identified in the recorded data yet.</p>
          : comparison.shiftedDevices.map((device) => <div key={device.id}><span><Icon name="clock" size={16} /><strong>{device.name}</strong></span><span>{String(device.previousStartHour).padStart(2, "0")}:00 → {String(device.optimizedStartHour).padStart(2, "0")}:00<small>{decimal.format(device.energyKwh)} kWh · {device.durationHours} hrs</small></span></div>)}
      </div>

      <p className="dynamic-assumptions"><Icon name="alert" size={14} /> Model calculation: synthetic household profile, average daily consumption from the annual projection, {priceSurchargeCentKwh.toFixed(2)} ct/kWh variable surcharges and a {euro.format(dynamicBasePriceMonthly)} dynamic base charge per month. {comparison.estimatedPriceHours > 0 && `${comparison.estimatedPriceHours} missing price hours were filled with the average of the available API values. `}{referenceSaving !== null && `Compared with the reference tariff, this results in ${referenceSaving >= 0 ? "savings of" : "additional costs of"} ${euro.format(Math.abs(referenceSaving))} today.`}</p>
    </section>
  );
}

/** Kostenkarte für einen simulierten Tarif am repräsentativen Tag. */
function DynamicCostCard({ label, name, cost, note, best = false }: { label: string; name: string; cost: number; note: string; best?: boolean }) {
  return <article className={best ? "dynamic-cost-card best" : "dynamic-cost-card"}><small>{label}</small><strong>{name}</strong><em>{euro.format(cost)}<small>for this day</small></em><p>{note}</p></article>;
}

/** Wiederverwendbarer Leerzustand für noch nicht nutzbare Tariffunktionen. */
function FeatureEmpty({ icon, title, text }: { icon: "calculator" | "compare"; title: string; text: string }) {
  return <div className="feature-empty"><span className="icon-tile large"><Icon name={icon} /></span><strong>{title}</strong><p>{text}</p></div>;
}
