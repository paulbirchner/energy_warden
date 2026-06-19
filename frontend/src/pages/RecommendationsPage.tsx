import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import { useRecommendationProgress } from "../hooks/useRecommendationProgress";
import { useTariffData } from "../hooks/useTariffData";
import type { LocalRecommendation, RecommendationCategory } from "../types/energyWarden";
import { generateLocalRecommendations } from "../utils/recommendationUtils";

type Filter = "all" | "high" | "easy" | "completed";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const decimal = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

const priorityLabels = { high: "Hohe Priorität", medium: "Mittlere Priorität", low: "Niedrige Priorität" };
const categoryLabels: Record<RecommendationCategory, string> = {
  device: "Gerät",
  behavior: "Gewohnheit",
  tariff: "Tarif",
  anomaly: "Auffälligkeit",
};

/** Erzeugt, filtert und verwaltet die personalisierte Maßnahmenübersicht. */
export default function RecommendationsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const consumption = useConsumptionData();
  const tariffs = useTariffData();
  const progressStore = useRecommendationProgress();
  const recommendations = useMemo(
    () => generateLocalRecommendations(consumption.data, tariffs.data.tariffs),
    [consumption.data, tariffs.data.tariffs],
  );
  const active = recommendations.filter((item) => !progressStore.progress.dismissedIds.includes(item.id));
  const completed = active.filter((item) => progressStore.progress.completedIds.includes(item.id));
  const visible = active.filter((item) => {
    const isCompleted = progressStore.progress.completedIds.includes(item.id);
    if (filter === "high") return item.priority === "high" && !isCompleted;
    if (filter === "easy") return item.feasibility === "easy" && !isCompleted;
    if (filter === "completed") return isCompleted;
    return !isCompleted;
  });
  const potentialEur = active
    .filter((item) => !progressStore.progress.completedIds.includes(item.id))
    .reduce((sum, item) => sum + item.annualSavingsEur, 0);
  const potentialKwh = active
    .filter((item) => !progressStore.progress.completedIds.includes(item.id))
    .reduce((sum, item) => sum + item.annualSavingsKwh, 0);

  return (
    <main className="page-content recommendations-page">
      <div className="page-heading heading-row">
        <div>
          <p className="eyebrow">Empfehlungen &amp; Einsparvorschläge</p>
          <h1>Kleine Schritte, messbare Wirkung</h1>
          <p className="subtitle">Persönlich priorisiert aus deinen Geräten, Verbräuchen und Tarifen.</p>
        </div>
        <span className="hardware-badge"><Icon name="leaf" size={17} /> Ohne teure Smart-Home-Hardware</span>
      </div>

      <div className="recommendation-summary">
        <article className="recommendation-potential">
          <span className="icon-tile large"><Icon name="savings" /></span>
          <div><small>Berechnetes Einsparpotenzial</small><strong>{euro.format(potentialEur)} <em>pro Jahr</em></strong><p>{decimal.format(potentialKwh)} kWh weniger Verbrauch möglich</p></div>
        </article>
        <div className="recommendation-mini-stats">
          <span><strong>{active.filter((item) => !progressStore.progress.completedIds.includes(item.id)).length}</strong><small>offene Maßnahmen</small></span>
          <span><strong>{completed.length}</strong><small>bereits umgesetzt</small></span>
          <span><strong>{active.filter((item) => item.priority === "high" && !progressStore.progress.completedIds.includes(item.id)).length}</strong><small>hohe Priorität</small></span>
        </div>
      </div>

      <section className="recommendation-section">
        <div className="recommendation-toolbar">
          <div>
            <p className="eyebrow">FA-18 bis FA-22</p>
            <h2>Deine Maßnahmen</h2>
          </div>
          <div className="recommendation-filters" aria-label="Empfehlungen filtern">
            <FilterButton active={filter === "all"} label="Offen" onClick={() => setFilter("all")} />
            <FilterButton active={filter === "high"} label="Hohe Priorität" onClick={() => setFilter("high")} />
            <FilterButton active={filter === "easy"} label="Schnell umsetzbar" onClick={() => setFilter("easy")} />
            <FilterButton active={filter === "completed"} label={`Umgesetzt (${completed.length})`} onClick={() => setFilter("completed")} />
          </div>
        </div>

        {visible.length === 0
          ? <div className="recommendation-empty"><span className="icon-tile large"><Icon name="check" /></span><strong>{filter === "completed" ? "Noch keine Maßnahme umgesetzt" : "Hier ist gerade alles erledigt"}</strong><p>Wähle einen anderen Filter oder erfasse weitere Verbrauchsdaten.</p></div>
          : <div className="recommendation-grid">{visible.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} completed={progressStore.progress.completedIds.includes(recommendation.id)} onComplete={() => progressStore.toggleCompleted(recommendation.id)} onDismiss={() => progressStore.dismiss(recommendation.id)} />)}</div>}

        {progressStore.progress.dismissedIds.length > 0 && <button className="restore-button" type="button" onClick={progressStore.restoreDismissed}>Ausgeblendete Empfehlungen wiederherstellen</button>}
      </section>

      <p className="calculation-note"><Icon name="calculator" size={15} /> Einsparungen sind Schätzwerte je Einzelmaßnahme und nicht zwingend vollständig addierbar.</p>
    </main>
  );
}

/** Kleiner Filterbutton mit aktivem Darstellungszustand. */
function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} type="button" onClick={onClick}>{label}</button>;
}

/**
 * Stellt eine Maßnahme mit Wirkung, Aufwand, Berechnungsbasis und Statusaktionen dar.
 */
function RecommendationCard({ recommendation, completed, onComplete, onDismiss }: { recommendation: LocalRecommendation; completed: boolean; onComplete: () => void; onDismiss: () => void }) {
  return (
    <article className={`recommendation-card priority-${recommendation.priority} ${completed ? "completed" : ""}`}>
      <div className="recommendation-card-top">
        <span className={`recommendation-category ${recommendation.category}`}><RecommendationIcon category={recommendation.category} /> {categoryLabels[recommendation.category]}</span>
        <span className={`priority-label ${recommendation.priority}`}>{priorityLabels[recommendation.priority]}</span>
      </div>
      <h3>{recommendation.title}</h3>
      <p className="recommendation-description">{recommendation.description}</p>

      <div className="recommendation-impact">
        <span><small>Finanziell</small><strong>{recommendation.annualSavingsEur > 0 ? euro.format(recommendation.annualSavingsEur) : "Nach Erfassung"}<em>{recommendation.annualSavingsEur > 0 ? "/ Jahr" : "berechenbar"}</em></strong></span>
        <span><small>Verbrauch</small><strong>{recommendation.annualSavingsKwh > 0 ? `${decimal.format(recommendation.annualSavingsKwh)} kWh` : "–"}<em>{recommendation.annualSavingsKwh > 0 ? "/ Jahr" : ""}</em></strong></span>
      </div>

      <div className="recommendation-meta">
        <span><Icon name="check" size={15} /> {recommendation.feasibility === "easy" ? "Einfach umsetzbar" : recommendation.feasibility === "medium" ? "Gut planbar" : "Etwas Vorbereitung"}</span>
        <span><Icon name="clock" size={15} /> {recommendation.effort}</span>
        {recommendation.noHardware && <span><Icon name="leaf" size={15} /> Ohne Zusatzhardware</span>}
      </div>

      <details className="recommendation-details">
        <summary>Konkrete Schritte anzeigen</summary>
        <ol>{recommendation.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <p><strong>Berechnungsgrundlage:</strong> {recommendation.basedOn}</p>
      </details>

      <div className="recommendation-actions">
        <button className={completed ? "complete-button completed" : "complete-button"} type="button" onClick={onComplete}><Icon name="check" size={17} />{completed ? "Als offen markieren" : "Als umgesetzt markieren"}</button>
        {!completed && <button className="dismiss-button" type="button" onClick={onDismiss}>Ausblenden</button>}
      </div>
    </article>
  );
}

/** Ordnet jeder fachlichen Empfehlungskategorie ein passendes Icon zu. */
function RecommendationIcon({ category }: { category: RecommendationCategory }) {
  if (category === "device") return <Icon name="device" size={15} />;
  if (category === "tariff") return <Icon name="tariff" size={15} />;
  if (category === "anomaly") return <Icon name="alert" size={15} />;
  return <Icon name="leaf" size={15} />;
}
