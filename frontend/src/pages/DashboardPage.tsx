import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getCurrentPrice } from "../api/energyWardenApi";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import { useRecommendationProgress } from "../hooks/useRecommendationProgress";
import { useTariffData } from "../hooks/useTariffData";
import type { ApplianceEstimate, LocalRecommendation, Tariff } from "../types/energyWarden";
import { buildMonthlySeries, consumptionChange } from "../utils/analysisUtils";
import { generateLocalRecommendations } from "../utils/recommendationUtils";

type DashboardDestination = "consumption" | "tariffs" | "analysis" | "recommendations";
type DashboardProps = { onNavigate: (page: DashboardDestination) => void };
type ChartMode = "consumption" | "cost";

const decimal = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/**
 * Zentrale Übersicht über Verbrauch, Kosten, Preise, Hotspots und Maßnahmenfortschritt.
 * Alle Kennzahlen verwenden dieselben lokalen Datenquellen wie die Detailseiten.
 */
export default function DashboardPage({ onNavigate }: DashboardProps) {
  const consumptionStore = useConsumptionData();
  const tariffStore = useTariffData();
  const recommendationStore = useRecommendationProgress();
  const series = useMemo(() => buildMonthlySeries(consumptionStore.data), [consumptionStore.data]);
  const recommendations = useMemo(
    () => generateLocalRecommendations(consumptionStore.data, tariffStore.data.tariffs),
    [consumptionStore.data, tariffStore.data.tariffs],
  );
  const currentTariff = tariffStore.data.tariffs.find(
    (tariff) => tariff.utilityType === "electricity" && tariff.isCurrent,
  );
  const currentMonth = series.at(-1)?.consumption ?? 0;
  const previousChange = consumptionChange(series);
  const monthlyCost = currentTariff
    ? currentTariff.basePriceMonthly + currentTariff.unitPrice * currentMonth
    : null;
  const openRecommendations = recommendations.filter(
    (item) => !recommendationStore.progress.completedIds.includes(item.id) &&
      !recommendationStore.progress.dismissedIds.includes(item.id),
  );
  const completedRecommendations = recommendations.filter((item) =>
    recommendationStore.progress.completedIds.includes(item.id),
  );
  const openSavings = openRecommendations.reduce((sum, item) => sum + item.annualSavingsEur, 0);
  const completedSavings = completedRecommendations.reduce((sum, item) => sum + item.annualSavingsEur, 0);

  return (
    <main className="page-content dashboard-page-new">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>{getGreeting()}, willkommen beim Energy Warden</h1>
          <p className="subtitle">Dein Energiehaushalt im Überblick · {new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date())}</p>
        </div>
        <div className="dashboard-quick-actions">
          <button type="button" onClick={() => onNavigate("consumption")}><Icon name="meter" size={17} /> Zählerstand</button>
          <button type="button" onClick={() => onNavigate("recommendations")}><Icon name="recommendation" size={17} /> Maßnahmen</button>
        </div>
      </div>

      <div className="dashboard-kpis">
        <DashboardKpi icon="chart" label="Verbrauch letzter Monat" value={currentMonth ? `${decimal.format(currentMonth)} kWh` : "Noch keine Daten"} detail={previousChange === null ? "Vergleich folgt mit weiteren Werten" : `${previousChange >= 0 ? "+" : ""}${decimal.format(previousChange)} % zum Vormonat`} tone={previousChange !== null && previousChange > 0 ? "warning" : "green"} />
        <DashboardKpi icon="calculator" label="Kosten letzter Monat" value={monthlyCost === null ? "Tarif fehlt" : euro.format(monthlyCost)} detail={currentTariff ? `mit ${currentTariff.name}` : "Tarif für Berechnung erfassen"} tone="blue" />
        <DashboardKpi icon="savings" label="Offenes Einsparpotenzial" value={euro.format(openSavings)} detail="Summe pro Jahr" tone="gold" />
        <DashboardKpi icon="check" label="Erreichte Einsparung" value={euro.format(completedSavings / 12)} detail="geschätzt pro Monat" tone="green" />
      </div>

      <div className="dashboard-main-grid">
        <section className="dashboard-card dashboard-trend-card">
          <div className="dashboard-card-heading">
            <div><p className="eyebrow">FA-28</p><h2>Entwicklung</h2></div>
          </div>
          <DashboardChart points={series.slice(-12)} tariff={currentTariff} />
        </section>

        <div className="dashboard-side-column">
          <LivePriceWidget />
          <section className="dashboard-card dashboard-recommendation-preview">
            <div className="dashboard-card-heading"><div><p className="eyebrow">Nächste Schritte</p><h2>Top-Empfehlungen</h2></div><button className="card-link" type="button" onClick={() => onNavigate("recommendations")}>Alle</button></div>
            {openRecommendations.length === 0
              ? <DashboardEmpty title="Alles erledigt" text="Aktuell sind keine Maßnahmen offen." />
              : <div className="dashboard-tip-list">{openRecommendations.slice(0, 3).map((item) => <DashboardTip key={item.id} recommendation={item} />)}</div>}
          </section>
        </div>

        <section className="dashboard-card dashboard-hotspots">
          <div className="dashboard-card-heading"><div><p className="eyebrow">FA-29</p><h2>Energie-Hotspots</h2></div><button className="card-link" type="button" onClick={() => onNavigate("analysis")}>Analyse öffnen</button></div>
          <DashboardHotspots appliances={consumptionStore.data.applianceEstimates} />
        </section>

        <section className="dashboard-card dashboard-savings-card">
          <div className="dashboard-card-heading"><div><p className="eyebrow">FA-30</p><h2>Erreichte Einsparungen</h2></div><Icon name="leaf" /></div>
          <AchievedSavings completed={completedRecommendations} total={recommendations.length} onNavigate={() => onNavigate("recommendations")} />
        </section>
      </div>

      <p className="dashboard-data-note"><Icon name="check" size={14} /> Alle Kennzahlen werden aus deinen lokal gespeicherten Eingaben berechnet.</p>
    </main>
  );
}

/** Wählt abhängig von der lokalen Uhrzeit eine passende Begrüßung. */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

/** Kompakte Dashboard-Kennzahl mit thematischem Farbton. */
function DashboardKpi({ icon, label, value, detail, tone }: { icon: "chart" | "calculator" | "savings" | "check"; label: string; value: string; detail: string; tone: "green" | "blue" | "gold" | "warning" }) {
  return <article className={`dashboard-kpi ${tone}`}><span className="dashboard-kpi-icon"><Icon name={icon} /></span><span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></article>;
}

/** Schaltet dieselbe Monatsreihe zwischen Verbrauchs- und Kostendarstellung um. */
function DashboardChart({ points, tariff }: { points: ReturnType<typeof buildMonthlySeries>; tariff: Tariff | undefined }) {
  const [mode, setMode] = useState<ChartMode>("consumption");
  const values = points.map((point) => mode === "consumption"
    ? point.consumption
    : tariff ? tariff.basePriceMonthly + tariff.unitPrice * point.consumption : 0,
  );
  const max = Math.max(...values, 1);

  return <div>
    <div className="dashboard-chart-controls">
      <div className="dashboard-chart-toggle"><button className={mode === "consumption" ? "active" : ""} type="button" onClick={() => setMode("consumption")}>Verbrauch</button><button className={mode === "cost" ? "active" : ""} type="button" disabled={!tariff} onClick={() => setMode("cost")}>Kosten</button></div>
      <span>{points.length ? `${points.length} Monatswerte` : "Noch keine Monatswerte"}</span>
    </div>
    {points.length === 0 ? <DashboardEmpty title="Noch keine Entwicklung sichtbar" text="Erfasse zwei Zählerstände, eine Rechnung oder eine Geräteschätzung." /> :
      <div className="dashboard-chart" role="img" aria-label={mode === "consumption" ? "Monatlicher Stromverbrauch" : "Monatliche Stromkosten"}>
        {points.map((point, index) => {
          const value = values[index];
          return <div className="dashboard-chart-column" key={point.key}><strong>{mode === "consumption" ? `${decimal.format(value)}` : euro.format(value)}</strong><span><i style={{ height: `${Math.max(5, value / max * 100)}%` } as CSSProperties} /></span><small>{point.label}</small></div>;
        })}
      </div>}
    <div className="dashboard-chart-legend"><span><i /> {mode === "consumption" ? "Verbrauch in kWh" : "Kosten in Euro"}</span>{points.every((point) => point.estimated) && points.length > 0 && <em>Aus Geräteschätzungen</em>}</div>
  </div>;
}

/** Lädt den Live-Preis unabhängig von den übrigen lokalen Dashboard-Daten. */
function LivePriceWidget() {
  const [price, setPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    getCurrentPrice().then((value) => { setPrice(value); setStatus("ready"); }).catch(() => setStatus("error"));
  }, []);
  const cent = price === null ? null : price / 10;
  return <section className="dashboard-live-price"><div><span className="live-dot" /><p>Strompreis jetzt</p></div>{status === "loading" && <strong>Wird geladen …</strong>}{status === "error" && <><strong>Nicht erreichbar</strong><small>Backend-Preisschnittstelle offline</small></>}{status === "ready" && cent !== null && <><strong>{cent.toFixed(2).replace(".", ",")} ct/kWh</strong><small>{cent <= 12 ? "Günstiges Zeitfenster" : cent >= 25 ? "Verbrauch besser verschieben" : "Preis im normalen Bereich"}</small></>}</section>;
}

/** Kurze Vorschau einer noch offenen persönlichen Maßnahme. */
function DashboardTip({ recommendation }: { recommendation: LocalRecommendation }) {
  return <div className="dashboard-tip"><span className={`tip-priority ${recommendation.priority}`} /><span><strong>{recommendation.title}</strong><small>{recommendation.annualSavingsEur > 0 ? `bis ${euro.format(recommendation.annualSavingsEur)} pro Jahr` : recommendation.effort}</small></span><Icon name="trend" size={16} /></div>;
}

/** Zeigt die größten Geräteanteile als Donut und Rangliste. */
function DashboardHotspots({ appliances }: { appliances: ApplianceEstimate[] }) {
  const sorted = [...appliances].sort((a, b) => b.annualConsumptionKwh - a.annualConsumptionKwh);
  const total = sorted.reduce((sum, item) => sum + item.annualConsumptionKwh, 0);
  if (sorted.length === 0) return <DashboardEmpty title="Noch keine Geräte erfasst" text="Geräteschätzungen machen deine größten Verbrauchstreiber sichtbar." />;
  const leadingShare = total ? sorted[0].annualConsumptionKwh / total * 100 : 0;
  return <div className="dashboard-hotspot-layout"><div className="hotspot-donut" style={{ "--donut-share": `${leadingShare * 3.6}deg` } as CSSProperties}><span><strong>{decimal.format(total)}</strong><small>kWh/Jahr</small></span></div><div className="dashboard-hotspot-list">{sorted.slice(0, 4).map((item, index) => { const share = total ? item.annualConsumptionKwh / total * 100 : 0; return <div key={item.id}><span><i style={{ background: `var(--hotspot-${Math.min(index + 1, 4)})` }} />{item.applianceName}</span><strong>{decimal.format(share)} %<small>{decimal.format(item.annualConsumptionKwh)} kWh</small></strong></div>; })}</div></div>;
}

/** Fasst die Wirkung bereits als umgesetzt markierter Maßnahmen zusammen. */
function AchievedSavings({ completed, total, onNavigate }: { completed: LocalRecommendation[]; total: number; onNavigate: () => void }) {
  const annualEur = completed.reduce((sum, item) => sum + item.annualSavingsEur, 0);
  const annualKwh = completed.reduce((sum, item) => sum + item.annualSavingsKwh, 0);
  const progress = total ? Math.min(100, completed.length / total * 100) : 0;
  return <div className="achieved-savings"><div className="savings-progress"><div style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}><span><strong>{completed.length}</strong><small>umgesetzt</small></span></div></div><div className="savings-copy">{completed.length === 0 ? <><strong>Dein Fortschritt startet hier</strong><p>Markiere eine Empfehlung als umgesetzt, um die erwartete Wirkung zu verfolgen.</p><button className="secondary-button" type="button" onClick={onNavigate}>Maßnahmen ansehen</button></> : <><strong>{euro.format(annualEur / 12)} und {decimal.format(annualKwh / 12)} kWh</strong><p>geschätzte Einsparung pro Monat durch deine umgesetzten Maßnahmen.</p><span>{decimal.format(progress)} % der vorgeschlagenen Maßnahmen umgesetzt</span></>}</div></div>;
}

/** Platzhalter für Dashboard-Bereiche ohne ausreichende Eingaben. */
function DashboardEmpty({ title, text }: { title: string; text: string }) {
  return <div className="dashboard-empty"><span className="icon-tile"><Icon name="chart" /></span><strong>{title}</strong><p>{text}</p></div>;
}
