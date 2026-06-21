import { useMemo, useState, type CSSProperties } from "react";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import { useTariffData } from "../hooks/useTariffData";
import type { ApplianceEstimate } from "../types/energyWarden";
import {
  annualProjection,
  buildForecast,
  buildMonthlySeries,
  consumptionChange,
  findAnomaly,
  tariffAnnualCost,
  type MonthlyPoint,
} from "../utils/analysisUtils";

type Period = "6" | "12" | "all";

const decimal = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const euro = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });
const benchmarks: Record<string, number> = {
  "1": 1800,
  "2": 2700,
  "3": 3500,
  "4": 4200,
  "5": 5000,
};

/** Bündelt Zeitraum-, Hotspot-, Vergleichs-, Anomalie- und Prognoseanalyse. */
export default function AnalysisPage() {
  const [period, setPeriod] = useState<Period>("12");
  const [householdSize, setHouseholdSize] = useState("2");
  const consumption = useConsumptionData();
  const tariffStore = useTariffData();
  const series = useMemo(() => buildMonthlySeries(consumption.data), [consumption.data]);
  const visibleSeries = period === "all" ? series : series.slice(-Number(period));
  const annual = annualProjection(series);
  const monthlyAverage = annual / 12;
  const change = consumptionChange(series);
  const anomaly = findAnomaly(series);
  const currentTariff = tariffStore.data.tariffs.find((tariff) => tariff.isCurrent);
  const forecast = buildForecast(series, currentTariff);
  const forecastCost = currentTariff ? tariffAnnualCost(currentTariff, annual) : 0;

  return (
    <main className="page-content analysis-page">
      <div className="page-heading heading-row">
        <div>
          <p className="eyebrow">Consumption analysis</p>
          <h1>What your data reveals</h1>
          <p className="subtitle">Identify trends, understand consumption drivers and plan future costs.</p>
        </div>
        <div className="period-control" aria-label="Analysis period">
          <button className={period === "6" ? "active" : ""} type="button" onClick={() => setPeriod("6")}>6 mo.</button>
          <button className={period === "12" ? "active" : ""} type="button" onClick={() => setPeriod("12")}>12 mo.</button>
          <button className={period === "all" ? "active" : ""} type="button" onClick={() => setPeriod("all")}>All</button>
        </div>
      </div>

      <div className="stats-grid analysis-stats">
        <AnalysisStat icon="chart" label="Annual projection" value={annual ? `${decimal.format(annual)} kWh` : "No data"} note="based on your entries" />
        <AnalysisStat icon="trend" label="Monthly average" value={monthlyAverage ? `${decimal.format(monthlyAverage)} kWh` : "–"} note={change === null ? "no monthly comparison yet" : `${change >= 0 ? "+" : ""}${decimal.format(change)}% vs previous month`} trend={change} />
        <AnalysisStat icon="calculator" label="Cost forecast" value={currentTariff && annual ? euro.format(forecastCost) : "Tariff missing"} note="for the next 12 months" />
      </div>

      <section className="analysis-card consumption-development">
        <div className="analysis-card-heading">
          <div><p className="eyebrow"></p><h2>Consumption trend</h2></div>
          {series.length > 0 && <span className="source-chip">{series.every((point) => point.estimated) ? "Appliance estimate" : "Recorded consumption"}</span>}
        </div>
        {visibleSeries.length === 0
          ? <AnalysisEmpty title="No analysable consumption data yet" text="Two meter readings, an invoice or an appliance estimate are required to show a trend." />
          : <ConsumptionChart points={visibleSeries} />}
      </section>

      <div className="analysis-two-column">
        <section className="analysis-card">
          <div className="analysis-card-heading"><div><p className="eyebrow"></p><h2>Consumption hotspots</h2></div><Icon name="hotspot" /></div>
          <Hotspots appliances={consumption.data.applianceEstimates} />
        </section>

        <section className="analysis-card">
          <div className="analysis-card-heading"><div><p className="eyebrow"></p><h2>Household comparison</h2></div><Icon name="compare" /></div>
          <Benchmark annual={annual} householdSize={householdSize} onHouseholdSize={setHouseholdSize} />
        </section>
      </div>

      <section className="analysis-card anomaly-card">
        <div className="analysis-card-heading"><div><p className="eyebrow"></p><h2>Unusual consumption patterns</h2></div><Icon name="alert" /></div>
        <AnomalyState anomaly={anomaly} hasEnoughData={series.length >= 4} />
      </section>

      <section className="analysis-card forecast-card">
        <div className="analysis-card-heading">
          <div><p className="eyebrow"></p><h2>Cost forecast</h2></div>
          {currentTariff && <span className="source-chip">Tariff: {currentTariff.name}</span>}
        </div>
        {!currentTariff
          ? <AnalysisEmpty title="No active electricity tariff" text="Set a current tariff under “Tariffs & Costs” to forecast your costs." />
          : forecast.length === 0
            ? <AnalysisEmpty title="No consumption baseline" text="Your 12-month forecast will appear here once consumption data is available." />
            : <ForecastChart points={forecast} total={forecastCost} />}
      </section>
    </main>
  );
}

/** Kennzahlenkarte mit optionaler positiver oder negativer Trendanzeige. */
function AnalysisStat({ icon, label, value, note, trend }: { icon: "chart" | "trend" | "calculator"; label: string; value: string; note: string; trend?: number | null }) {
  return (
    <article className="stat-card analysis-stat">
      <span className="icon-tile"><Icon name={icon} /></span>
      <span><small>{label}</small><strong>{value}</strong><em className={trend !== undefined && trend !== null && trend > 0 ? "negative" : ""}>{note}</em></span>
    </article>
  );
}

/** Skaliert Monatswerte relativ zum Maximum als zugängliches Balkendiagramm. */
function ConsumptionChart({ points }: { points: MonthlyPoint[] }) {
  const max = Math.max(...points.map((point) => point.consumption), 1);
  return (
    <div className="chart-wrap">
      <div className="bar-chart" role="img" aria-label="Monthly consumption trend">
        {points.map((point) => {
          const height = Math.max(4, point.consumption / max * 100);
          return (
            <div className="bar-column" key={point.key}>
              <div className="bar-value">{decimal.format(point.consumption)}</div>
              <div className="bar-track"><span style={{ "--bar-height": `${height}%` } as CSSProperties} /></div>
              <small>{point.label}</small>
            </div>
          );
        })}
      </div>
      <div className="chart-unit">kWh per month</div>
    </div>
  );
}

/** Sortiert Geräte nach Jahresverbrauch und zeigt ihren Anteil am Gesamtwert. */
function Hotspots({ appliances }: { appliances: ApplianceEstimate[] }) {
  const sorted = [...appliances].sort((a, b) => b.annualConsumptionKwh - a.annualConsumptionKwh);
  const total = sorted.reduce((sum, item) => sum + item.annualConsumptionKwh, 0);
  if (sorted.length === 0) return <AnalysisEmpty title="No appliances recorded yet" text="Appliance estimates show your biggest consumption drivers here." compact />;

  return (
    <div className="hotspot-list">
      {sorted.slice(0, 5).map((appliance, index) => {
        const share = total ? appliance.annualConsumptionKwh / total * 100 : 0;
        return <div className="hotspot-row" key={appliance.id}>
          <span className="hotspot-rank">{index + 1}</span>
          <span className="hotspot-main"><strong>{appliance.applianceName}</strong><span><i style={{ width: `${share}%` }} /></span></span>
          <span className="hotspot-value"><strong>{decimal.format(appliance.annualConsumptionKwh)} kWh</strong><small>{decimal.format(share)}%</small></span>
        </div>;
      })}
    </div>
  );
}

/** Vergleicht die Jahreshochrechnung mit einem auswählbaren Haushaltsrichtwert. */
function Benchmark({ annual, householdSize, onHouseholdSize }: { annual: number; householdSize: string; onHouseholdSize: (value: string) => void }) {
  const reference = benchmarks[householdSize];
  const difference = annual && reference ? (annual - reference) / reference * 100 : 0;
  const marker = Math.min(100, Math.max(2, annual / (reference * 1.6) * 100));
  return (
    <div className="benchmark">
      <label>Comparison household<select value={householdSize} onChange={(event) => onHouseholdSize(event.target.value)}>{Object.keys(benchmarks).map((size) => <option key={size} value={size}>{size === "5" ? "5+" : size} {size === "1" ? "person" : "people"}</option>)}</select></label>
      {annual === 0 ? <p className="inline-empty">Consumption data is still missing for this comparison.</p> : <>
        <div className="benchmark-summary"><span>Your projection<strong>{decimal.format(annual)} kWh/year</strong></span><span>Reference value<strong>{decimal.format(reference)} kWh/year</strong></span></div>
        <div className="benchmark-scale"><span style={{ left: `${marker}%` }} /><i /></div>
        <p className={difference > 0 ? "benchmark-result above" : "benchmark-result"}>{difference > 0 ? `${decimal.format(Math.abs(difference))}% above` : `${decimal.format(Math.abs(difference))}% below`} the reference value.</p>
      </>}
      <small className="benchmark-note">Non-binding reference; electric heating systems and building type can significantly affect the comparison.</small>
    </div>
  );
}

/** Rendert je nach Datenlage einen neutralen, positiven oder warnenden Anomaliestatus. */
function AnomalyState({ anomaly, hasEnoughData }: { anomaly: ReturnType<typeof findAnomaly>; hasEnoughData: boolean }) {
  if (!hasEnoughData) return <div className="anomaly-state neutral"><span className="icon-tile"><Icon name="alert" /></span><span><strong>Not enough comparison data yet</strong><p>At least four monthly values are required for reliable detection.</p></span></div>;
  if (!anomaly) return <div className="anomaly-state good"><span className="icon-tile"><Icon name="check" /></span><span><strong>No unusual changes detected</strong><p>The latest monthly value is within the usual range of fluctuation.</p></span></div>;
  const rising = anomaly.deviation > 0;
  return <div className="anomaly-state warning"><span className="icon-tile"><Icon name="alert" /></span><span><strong>{rising ? "Unusually high" : "Unusually low"} consumption in {anomaly.point.label}</strong><p>{decimal.format(Math.abs(anomaly.deviation))}% {rising ? "above" : "below"} the average of the previous three months. Check for unusual events or incorrect entries.</p></span></div>;
}

type ForecastPoint = ReturnType<typeof buildForecast>[number];

/** Visualisiert die erwarteten monatlichen Kosten der nächsten zwölf Monate. */
function ForecastChart({ points, total }: { points: ForecastPoint[]; total: number }) {
  const max = Math.max(...points.map((point) => point.cost), 1);
  return (
    <div className="forecast-layout">
      <div className="forecast-summary"><small>Expected cost</small><strong>{euro.format(total)}</strong><span>next 12 months</span><p>Based on your previous consumption and current tariff.</p></div>
      <div className="forecast-chart" role="img" aria-label="Forecast monthly costs">
        {points.map((point) => <div className="forecast-column" key={point.key}><strong>{euro.format(point.cost)}</strong><span><i style={{ height: `${Math.max(6, point.cost / max * 100)}%` }} /></span><small>{point.label}</small></div>)}
      </div>
    </div>
  );
}

/** Einheitlicher Leerzustand für Analysen ohne ausreichende Datengrundlage. */
function AnalysisEmpty({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return <div className={compact ? "analysis-empty compact" : "analysis-empty"}><span className="icon-tile"><Icon name="chart" /></span><strong>{title}</strong><p>{text}</p></div>;
}
