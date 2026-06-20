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

const decimal = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const currentMonthKey = new Date().toISOString().slice(0, 7);

/** Erstellt die auswählbare Monatsberichtseite aus allen lokalen Fachdaten. */
export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const consumption = useConsumptionData();
  const tariffs = useTariffData();
  const progress = useRecommendationProgress();
  const series = buildMonthlySeries(consumption.data);
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
    anchor.download = `energy-warden-verbrauch-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-content reports-page">
      <div className="page-heading heading-row no-print">
        <div>
          <p className="eyebrow">Export &amp; Berichte</p>
          <h1>Dein Energiebericht</h1>
          <p className="subtitle">Monatlich automatisch aus deinen vorhandenen Verbrauchs-, Kosten- und Maßnahmendaten erstellt.</p>
        </div>
        <span className="local-badge"><span /> Lokal generiert</span>
      </div>

      <section className="report-controls no-print">
        <label>Berichtsmonat<select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>{months.map((month) => <option key={month} value={month}>{formatReportMonth(month)}</option>)}</select></label>
        <div className="report-actions">
          <button className="secondary-report-button" type="button" onClick={downloadCsv}><Icon name="download" size={18} /> CSV exportieren</button>
          <button className="primary-report-button" type="button" onClick={() => window.print()}><Icon name="print" size={18} /> Als PDF speichern</button>
        </div>
      </section>

      <article className="print-report">
        <header className="report-header">
          <div className="report-brand"><span className="brand-mark">EW</span><span><strong>Energy Warden</strong><small>Persönlicher Energiebericht</small></span></div>
          <div className="report-period"><small>Berichtszeitraum</small><strong>{report.monthLabel}</strong><span>Erstellt am {new Date().toLocaleDateString("de-DE")}</span></div>
        </header>

        <div className="report-title">
          <p className="eyebrow">Monatsbericht · FA-41</p>
          <h2>Dein Monat auf einen Blick</h2>
          <p>Verbrauch, Kosten und die wichtigsten nächsten Schritte kompakt zusammengefasst.</p>
        </div>

        <div className="report-kpis">
          <ReportKpi label="Verbrauch" value={`${decimal.format(report.consumptionKwh)} kWh`} note={report.previousChange === null ? "Noch kein Vormonatsvergleich" : `${report.previousChange >= 0 ? "+" : ""}${decimal.format(report.previousChange)} % zum Vormonat`} tone={report.previousChange !== null && report.previousChange > 0 ? "warning" : "green"} />
          <ReportKpi label="Gesamtkosten" value={report.totalCostEur === null ? "Tarif fehlt" : euro.format(report.totalCostEur)} note="Grund- und Verbrauchspreis" tone="blue" />
          <ReportKpi label="Erreichte Einsparung" value={euro.format(report.achievedSavingsEur)} note={`${decimal.format(report.achievedSavingsKwh)} kWh geschätzt`} tone="green" />
          <ReportKpi label="Offenes Potenzial" value={euro.format(report.openSavingsEur)} note="pro Jahr aus Maßnahmen" tone="gold" />
        </div>

        <div className="report-section report-development">
          <div className="report-section-heading"><div><p className="eyebrow">Entwicklung</p><h3>Verbrauch der letzten Monate</h3></div><span>{report.dataSource}</span></div>
          <ReportChart points={chartPoints} selectedMonth={selectedMonth} />
        </div>

        <div className="report-two-columns">
          <section className="report-section">
            <div className="report-section-heading"><div><p className="eyebrow">Kosten</p><h3>Monatliche Aufteilung</h3></div><Icon name="calculator" /></div>
            <CostBreakdown report={report} />
          </section>
          <section className="report-section">
            <div className="report-section-heading"><div><p className="eyebrow">Hotspots</p><h3>Größte Verbrauchstreiber</h3></div><Icon name="hotspot" /></div>
            <ReportHotspots report={report} />
          </section>
        </div>

        <section className="report-section report-recommendations">
          <div className="report-section-heading"><div><p className="eyebrow">FA-43</p><h3>Die wichtigsten nächsten Maßnahmen</h3></div><Icon name="recommendation" /></div>
          <RecommendationSummary recommendations={report.recommendations} />
        </section>

        <footer className="report-footer"><span>Energy Warden · {report.monthLabel}</span><span>Schätzwerte basieren auf deinen lokal erfassten Daten.</span></footer>
      </article>

      <section className="export-info-card no-print">
        <span className="icon-tile large"><Icon name="download" /></span>
        <div><strong>Verbrauchs- und Kostendaten exportieren</strong><p>Die CSV-Datei enthält {series.length} Monatswerte und lässt sich in Excel, LibreOffice oder anderen Tabellenprogrammen öffnen.</p></div>
        <button className="secondary-report-button" type="button" onClick={downloadCsv}>CSV herunterladen</button>
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
  if (points.length === 0) return <ReportEmpty text="Noch keine Verbrauchsdaten für eine Entwicklung vorhanden." />;
  return <div className="report-chart" role="img" aria-label="Verbrauchsentwicklung der letzten Monate">{points.map((point) => <div className={point.key === selectedMonth ? "selected" : ""} key={point.key}><strong>{decimal.format(point.consumption)}</strong><span><i style={{ height: `${Math.max(5, point.consumption / max * 100)}%` } as CSSProperties} /></span><small>{point.label}</small></div>)}</div>;
}

/** Teilt die Monatskosten visuell in Grund- und Verbrauchskosten auf. */
function CostBreakdown({ report }: { report: MonthlyReport }) {
  if (report.totalCostEur === null) return <ReportEmpty text="Lege einen aktuellen Stromtarif fest, um Kosten aufzuschlüsseln." />;
  const baseShare = report.totalCostEur ? report.baseCostEur / report.totalCostEur * 100 : 0;
  return <div className="report-costs"><div className="cost-ring" style={{ "--base-share": `${baseShare * 3.6}deg` } as CSSProperties}><span><strong>{euro.format(report.totalCostEur)}</strong><small>gesamt</small></span></div><div><span><i className="base" />Grundpreis <strong>{euro.format(report.baseCostEur)}</strong></span><span><i className="usage" />Verbrauch <strong>{euro.format(report.consumptionCostEur)}</strong></span></div></div>;
}

/** Listet die größten gerätebezogenen Verbrauchsanteile des Berichts. */
function ReportHotspots({ report }: { report: MonthlyReport }) {
  if (report.hotspots.length === 0) return <ReportEmpty text="Geräteschätzungen ergänzen, um Hotspots anzuzeigen." />;
  return <div className="report-hotspot-list">{report.hotspots.map((hotspot, index) => <div key={hotspot.name}><span><em>{index + 1}</em><strong>{hotspot.name}</strong></span><span><strong>{decimal.format(hotspot.share)} %</strong><small>{decimal.format(hotspot.consumptionKwh)} kWh/Jahr</small></span></div>)}</div>;
}

/** Fasst maximal drei priorisierte offene Maßnahmen druckfreundlich zusammen. */
function RecommendationSummary({ recommendations }: { recommendations: LocalRecommendation[] }) {
  if (recommendations.length === 0) return <ReportEmpty text="Aktuell sind keine offenen Empfehlungen vorhanden." />;
  return <div className="report-recommendation-list">{recommendations.map((recommendation, index) => <article key={recommendation.id}><span>{index + 1}</span><div><strong>{recommendation.title}</strong><p>{recommendation.description}</p><small>{recommendation.effort} · {recommendation.noHardware ? "ohne Zusatzhardware" : "mit Hilfsmittel"}</small></div><em>{recommendation.annualSavingsEur > 0 ? `${euro.format(recommendation.annualSavingsEur)}/Jahr` : "Datengrundlage ergänzen"}</em></article>)}</div>;
}

/** Kompakter Bericht-Leerzustand bei fehlender Datenbasis. */
function ReportEmpty({ text }: { text: string }) {
  return <div className="report-empty"><Icon name="report" /><span>{text}</span></div>;
}
