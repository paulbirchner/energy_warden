import { useState, type CSSProperties } from "react";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import { useRecommendationProgress } from "../hooks/useRecommendationProgress";
import { useTariffData } from "../hooks/useTariffData";
import type { LocalRecommendation } from "../types/energyWarden";
import { buildMonthlySeries } from "../utils/analysisUtils";
import { generateLocalRecommendations } from "../utils/recommendationUtils";
import {
  buildMonthlyReport,
  createConsumptionCsv,
  formatReportMonth,
  getReportMonths,
  type MonthlyReport,
} from "../utils/reportUtils";

const decimal = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const euro = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });
const currentMonthKey = new Date().toISOString().slice(0, 7);

/** Erstellt die auswählbare Monatsberichtseite aus allen lokalen Fachdaten. */
export default function ReportsPage() {
  const consumption = useConsumptionData();
  const tariffs = useTariffData();
  const progress = useRecommendationProgress();
  const series = buildMonthlySeries(consumption.data);
  const [selectedMonth, setSelectedMonth] = useState(
    () => series.at(-1)?.key ?? currentMonthKey,
  );
  const recommendations = generateLocalRecommendations(consumption.data, tariffs.data.tariffs);
  const months = getReportMonths(series);
  const report = buildMonthlyReport(
    selectedMonth,
    consumption.data,
    tariffs.data.tariffs,
    recommendations,
    progress.progress.completedIds,
    progress.progress.dismissedIds,
  );
  const chartPoints = series.filter((point) => point.key <= selectedMonth).slice(-6);

  /** Erzeugt im Browser eine UTF-8-CSV-Datei und startet deren Download. */
  function downloadCsv() {
    const csv = createConsumptionCsv(consumption.data, tariffs.data.tariffs);
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `energy-warden-consumption-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-content reports-page">
      <div className="page-heading heading-row no-print">
        <div>
          <p className="eyebrow">Export &amp; reports</p>
          <h1>Your energy report</h1>
          <p className="subtitle">Automatically created each month from your existing consumption, cost and action data.</p>
        </div>
        <span className="local-badge"><span /> Generated locally</span>
      </div>

      <section className="report-controls no-print">
        <label>Report month<select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>{months.map((month) => <option key={month} value={month}>{formatReportMonth(month)}</option>)}</select></label>
        <div className="report-actions">
          <button className="secondary-report-button" type="button" onClick={downloadCsv}><Icon name="download" size={18} /> Export CSV</button>
          <button className="primary-report-button" type="button" onClick={() => window.print()}><Icon name="print" size={18} /> Save as PDF</button>
        </div>
      </section>

      <article className="print-report">
        <header className="report-header">
          <div className="report-brand"><span className="brand-mark">EW</span><span><strong>Energy Warden</strong><small>Personal energy report</small></span></div>
          <div className="report-period"><small>Reporting period</small><strong>{report.monthLabel}</strong><span>Created on {new Date().toLocaleDateString("en-GB")}</span></div>
        </header>

        <div className="report-title">
          <p className="eyebrow">Monthly report</p>
          <h2>Your month at a glance</h2>
          <p>A concise summary of consumption, costs and the most important next steps.</p>
        </div>

        <div className="report-kpis">
          <ReportKpi label="Consumption" value={`${decimal.format(report.consumptionKwh)} kWh`} note={report.previousChange === null ? "No previous-month comparison yet" : `${report.previousChange >= 0 ? "+" : ""}${decimal.format(report.previousChange)}% vs previous month`} tone={report.previousChange !== null && report.previousChange > 0 ? "warning" : "green"} />
          <ReportKpi label="Total cost" value={report.totalCostEur === null ? "Tariff missing" : euro.format(report.totalCostEur)} note="Base charge and consumption cost" tone="blue" />
          <ReportKpi label="Savings achieved" value={euro.format(report.achievedSavingsEur)} note={`${decimal.format(report.achievedSavingsKwh)} kWh estimated`} tone="green" />
          <ReportKpi label="Open potential" value={euro.format(report.openSavingsEur)} note="per year from actions" tone="gold" />
        </div>

        <div className="report-section report-development">
          <div className="report-section-heading"><div><p className="eyebrow">Trend</p><h3>Consumption in recent months</h3></div><span>{report.dataSource}</span></div>
          <ReportChart points={chartPoints} selectedMonth={selectedMonth} />
        </div>

        <div className="report-two-columns">
          <section className="report-section">
            <div className="report-section-heading"><div><p className="eyebrow">Costs</p><h3>Monthly breakdown</h3></div><Icon name="calculator" /></div>
            <CostBreakdown report={report} />
          </section>
          <section className="report-section">
            <div className="report-section-heading"><div><p className="eyebrow">Hotspots</p><h3>Biggest consumption drivers</h3></div><Icon name="hotspot" /></div>
            <ReportHotspots report={report} />
          </section>
        </div>

        <section className="report-section report-recommendations">
          <div className="report-section-heading"><div><p className="eyebrow"></p><h3>The most important next actions</h3></div><Icon name="recommendation" /></div>
          <RecommendationSummary recommendations={report.recommendations} />
        </section>

        <footer className="report-footer"><span>Energy Warden · {report.monthLabel}</span><span>Estimates are based on your locally recorded data.</span></footer>
      </article>

      <section className="export-info-card no-print">
        <span className="icon-tile large"><Icon name="download" /></span>
        <div><strong>Export consumption and cost data</strong><p>The CSV file contains {series.length} monthly values and can be opened in Excel, LibreOffice or other spreadsheet applications.</p></div>
        <button className="secondary-report-button" type="button" onClick={downloadCsv}>Download CSV</button>
      </section>
    </main>
  );
}

/** Kennzahl im Kopf des druckbaren Berichts. */
function ReportKpi({ label, value, note, tone }: { label: string; value: string; note: string; tone: "green" | "blue" | "gold" | "warning" }) {
  return <div className={`report-kpi ${tone}`}><small>{label}</small><strong>{value}</strong><span>{note}</span></div>;
}

/** Rendert bis zu sechs Monatswerte und hebt den Berichtsmonat hervor. */
function ReportChart({ points, selectedMonth }: { points: ReturnType<typeof buildMonthlySeries>; selectedMonth: string }) {
  const max = Math.max(...points.map((point) => point.consumption), 1);
  if (points.length === 0) return <ReportEmpty text="No consumption data is available for a trend yet." />;
  return <div className="report-chart" role="img" aria-label="Consumption trend over recent months">{points.map((point) => <div className={point.key === selectedMonth ? "selected" : ""} key={point.key}><strong>{decimal.format(point.consumption)}</strong><span><i style={{ height: `${Math.max(5, point.consumption / max * 100)}%` } as CSSProperties} /></span><small>{point.label}</small></div>)}</div>;
}

/** Teilt die Monatskosten visuell in Grund- und Verbrauchskosten auf. */
function CostBreakdown({ report }: { report: MonthlyReport }) {
  if (report.totalCostEur === null) return <ReportEmpty text="Set a current electricity tariff to break down costs." />;
  const baseShare = report.totalCostEur ? report.baseCostEur / report.totalCostEur * 100 : 0;
  return <div className="report-costs"><div className="cost-ring" style={{ "--base-share": `${baseShare * 3.6}deg` } as CSSProperties}><span><strong>{euro.format(report.totalCostEur)}</strong><small>total</small></span></div><div><span><i className="base" />Base charge <strong>{euro.format(report.baseCostEur)}</strong></span><span><i className="usage" />Consumption <strong>{euro.format(report.consumptionCostEur)}</strong></span></div></div>;
}

/** Listet die größten gerätebezogenen Verbrauchsanteile des Berichts. */
function ReportHotspots({ report }: { report: MonthlyReport }) {
  if (report.hotspots.length === 0) return <ReportEmpty text="Add appliance estimates to display hotspots." />;
  return <div className="report-hotspot-list">{report.hotspots.map((hotspot, index) => <div key={hotspot.name}><span><em>{index + 1}</em><strong>{hotspot.name}</strong></span><span><strong>{decimal.format(hotspot.share)}%</strong><small>{decimal.format(hotspot.consumptionKwh)} kWh/year</small></span></div>)}</div>;
}

/** Fasst maximal drei priorisierte offene Maßnahmen druckfreundlich zusammen. */
function RecommendationSummary({ recommendations }: { recommendations: LocalRecommendation[] }) {
  if (recommendations.length === 0) return <ReportEmpty text="There are currently no open recommendations." />;
  return <div className="report-recommendation-list">{recommendations.map((recommendation, index) => <article key={recommendation.id}><span>{index + 1}</span><div><strong>{recommendation.title}</strong><p>{recommendation.description}</p><small>{recommendation.effort} · {recommendation.noHardware ? "no additional hardware" : "with equipment"}</small></div><em>{recommendation.annualSavingsEur > 0 ? `${euro.format(recommendation.annualSavingsEur)}/year` : "Add more data"}</em></article>)}</div>;
}

/** Kompakter Bericht-Leerzustand bei fehlender Datenbasis. */
function ReportEmpty({ text }: { text: string }) {
  return <div className="report-empty"><Icon name="report" /><span>{text}</span></div>;
}
