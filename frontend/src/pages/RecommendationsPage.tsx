import { useMemo, useState } from "react";
import { generatePersonalizedRecommendations } from "../api/energyWardenApi";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import { useRecommendationProgress } from "../hooks/useRecommendationProgress";
import { useTariffData } from "../hooks/useTariffData";
import type {
  ConsumptionData,
  LocalRecommendation,
  PersonalizedAiRecommendation,
  PersonalizedRecommendationProfile,
  PersonalizedRecommendationResponse,
  RecommendationCategory,
  Tariff,
} from "../types/energyWarden";
import { generateLocalRecommendations } from "../utils/recommendationUtils";

type Filter = "all" | "high" | "easy" | "completed";

const euro = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });
const decimal = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

const priorityLabels = { high: "High priority", medium: "Medium priority", low: "Low priority" };
const categoryLabels: Record<RecommendationCategory, string> = {
  device: "Appliance",
  behavior: "Habit",
  tariff: "Tariff",
  anomaly: "Anomaly",
};

const AI_RECOMMENDATION_STORAGE_KEY = "energy-warden-ai-recommendations-v1";
type StoredAiRecommendations = PersonalizedRecommendationResponse & {
  generatedAt: string;
  profileSignature: string;
};

/** Lädt die letzte KI-Analyse, damit sie nach einem Seitenwechsel erhalten bleibt. */
function loadAiRecommendations(): StoredAiRecommendations | null {
  try {
    const stored = localStorage.getItem(AI_RECOMMENDATION_STORAGE_KEY);
    return stored ? JSON.parse(stored) as StoredAiRecommendations : null;
  } catch {
    return null;
  }
}

/** Reduziert lokale Daten auf die für die Beratung nötigen, nicht identifizierenden Felder. */
function buildAiProfile(
  data: ConsumptionData,
  tariffs: Tariff[],
  recommendations: LocalRecommendation[],
): PersonalizedRecommendationProfile {
  return {
    meterReadings: data.meterReadings.slice(0, 24).map((reading) => ({
      readingDate: reading.readingDate,
      readingKwh: reading.readingKwh,
    })),
    invoices: data.invoices.slice(0, 12).map((invoice) => ({
      billingStart: invoice.billingStart,
      billingEnd: invoice.billingEnd,
      consumptionKwh: invoice.consumptionKwh,
      totalAmountEur: invoice.totalAmountEur,
    })),
    appliances: data.applianceEstimates.slice(0, 30).map((appliance) => ({
      applianceName: appliance.applianceName,
      powerWatts: appliance.powerWatts,
      hoursPerDay: appliance.hoursPerDay,
      daysPerWeek: appliance.daysPerWeek,
      annualConsumptionKwh: appliance.annualConsumptionKwh,
      annualCostEur: appliance.annualCostEur,
    })),
    tariffs: tariffs.slice(0, 20).map((tariff) => ({
      provider: tariff.provider,
      name: tariff.name,
      basePriceMonthly: tariff.basePriceMonthly,
      unitPrice: tariff.unitPrice,
      isCurrent: tariff.isCurrent,
    })),
    calculatedRecommendations: recommendations.slice(0, 20).map((recommendation) => ({
      category: recommendation.category,
      title: recommendation.title,
      description: recommendation.description,
      annualSavingsKwh: recommendation.annualSavingsKwh,
      annualSavingsEur: recommendation.annualSavingsEur,
      basedOn: recommendation.basedOn,
    })),
  };
}

/** Erzeugt, filtert und verwaltet die personalisierte Maßnahmenübersicht. */
export default function RecommendationsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [aiResult, setAiResult] = useState<StoredAiRecommendations | null>(loadAiRecommendations);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "error">("idle");
  const [aiError, setAiError] = useState("");
  const consumption = useConsumptionData();
  const tariffs = useTariffData();
  const progressStore = useRecommendationProgress();
  const recommendations = useMemo(
    () => generateLocalRecommendations(consumption.data, tariffs.data.tariffs),
    [consumption.data, tariffs.data.tariffs],
  );
  const aiProfile = useMemo(
    () => buildAiProfile(consumption.data, tariffs.data.tariffs, recommendations),
    [consumption.data, recommendations, tariffs.data.tariffs],
  );
  const profileSignature = JSON.stringify(aiProfile);
  const currentAiResult = aiResult?.profileSignature === profileSignature ? aiResult : null;
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
  const hasProfileData = aiProfile.meterReadings.length > 0
    || aiProfile.invoices.length > 0
    || aiProfile.appliances.length > 0
    || aiProfile.tariffs.length > 0;

  /** Fordert eine neue KI-Analyse des reduzierten Haushaltsprofils an. */
  async function createAiRecommendations() {
    setAiStatus("loading");
    setAiError("");
    try {
      const result = await generatePersonalizedRecommendations(aiProfile);
      const stored = { ...result, generatedAt: new Date().toISOString(), profileSignature };
      setAiResult(stored);
      localStorage.setItem(AI_RECOMMENDATION_STORAGE_KEY, JSON.stringify(stored));
      setAiStatus("idle");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "The AI analysis could not be created.");
      setAiStatus("error");
    }
  }

  return (
    <main className="page-content recommendations-page">
      <div className="page-heading heading-row">
        <div>
          <p className="eyebrow">Recommendations &amp; savings ideas</p>
          <h1>Small steps, measurable impact</h1>
          <p className="subtitle">Personally prioritised from your appliances, consumption and tariffs.</p>
        </div>
        <span className="hardware-badge"><Icon name="leaf" size={17} /> No expensive smart-home hardware</span>
      </div>

      <div className="recommendation-summary">
        <article className="recommendation-potential">
          <span className="icon-tile large"><Icon name="savings" /></span>
          <div><small>Calculated savings potential</small><strong>{euro.format(potentialEur)} <em>per year</em></strong><p>Up to {decimal.format(potentialKwh)} kWh less consumption</p></div>
        </article>
        <div className="recommendation-mini-stats">
          <span><strong>{active.filter((item) => !progressStore.progress.completedIds.includes(item.id)).length}</strong><small>open actions</small></span>
          <span><strong>{completed.length}</strong><small>already completed</small></span>
          <span><strong>{active.filter((item) => item.priority === "high" && !progressStore.progress.completedIds.includes(item.id)).length}</strong><small>high priority</small></span>
        </div>
      </div>

      <section className="ai-recommendation-panel">
        <div className="ai-recommendation-header">
          <span className="ai-recommendation-icon"><Icon name="recommendation" size={25} /></span>
          <div><p className="eyebrow">AI advice</p><h2>Analyse your energy profile individually</h2><p>The AI combines your consumption trend, appliances, tariffs and calculated actions into a prioritised personal assessment.</p></div>
          <button className="ai-generate-button" type="button" disabled={!hasProfileData || aiStatus === "loading"} onClick={() => { void createAiRecommendations(); }}><Icon name={aiStatus === "loading" ? "refresh" : "recommendation"} size={18} />{aiStatus === "loading" ? "AI is analysing…" : currentAiResult ? "Update analysis" : "Create AI recommendations"}</button>
        </div>

        {!hasProfileData && <p className="ai-profile-hint"><Icon name="alert" size={14} /> First record at least one meter reading, appliance, invoice or tariff.</p>}
        {aiStatus === "error" && <p className="form-error">{aiError} Check the backend and `ANTHROPIC_API_KEY`.</p>}
        <p className="ai-privacy-note"><Icon name="alert" size={13} /> Only summarised energy data is transmitted—no meter numbers, notes or documents. The analysis uses a paid AI request.</p>

        {currentAiResult && (
          <div className="ai-result">
            <div className="ai-result-summary"><span><Icon name="recommendation" size={20} /></span><div><strong>Personal assessment</strong><p>{currentAiResult.summary}</p><small>Created on {new Date(currentAiResult.generatedAt).toLocaleString("en-GB")}</small></div></div>
            <div className="ai-recommendation-grid">{currentAiResult.recommendations.map((recommendation, index) => <AiRecommendationCard key={`${recommendation.title}-${index}`} recommendation={recommendation} />)}</div>
          </div>
        )}
      </section>

      <section className="recommendation-section">
        <div className="recommendation-toolbar">
          <div>
            <p className="eyebrow"></p>
            <h2>Calculated actions</h2>
          </div>
          <div className="recommendation-filters" aria-label="Filter recommendations">
            <FilterButton active={filter === "all"} label="Open" onClick={() => setFilter("all")} />
            <FilterButton active={filter === "high"} label="High priority" onClick={() => setFilter("high")} />
            <FilterButton active={filter === "easy"} label="Quick to implement" onClick={() => setFilter("easy")} />
            <FilterButton active={filter === "completed"} label={`Completed (${completed.length})`} onClick={() => setFilter("completed")} />
          </div>
        </div>

        {visible.length === 0
          ? <div className="recommendation-empty"><span className="icon-tile large"><Icon name="check" /></span><strong>{filter === "completed" ? "No actions completed yet" : "Everything here is done"}</strong><p>Select another filter or record more consumption data.</p></div>
          : <div className="recommendation-grid">{visible.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} completed={progressStore.progress.completedIds.includes(recommendation.id)} onComplete={() => progressStore.toggleCompleted(recommendation.id)} onDismiss={() => progressStore.dismiss(recommendation.id)} />)}</div>}

        {progressStore.progress.dismissedIds.length > 0 && <button className="restore-button" type="button" onClick={progressStore.restoreDismissed}>Restore hidden recommendations</button>}
      </section>

      <p className="calculation-note"><Icon name="calculator" size={15} /> Savings are estimates for each individual action and cannot necessarily be added together in full.</p>
    </main>
  );
}

/** Zeigt eine qualitative KI-Empfehlung ohne erfundene Einsparwerte. */
function AiRecommendationCard({ recommendation }: { recommendation: PersonalizedAiRecommendation }) {
  return (
    <article className={`ai-recommendation-card priority-${recommendation.priority}`}>
      <div className="recommendation-card-top">
        <span className={`recommendation-category ${recommendation.category}`}><RecommendationIcon category={recommendation.category} /> {categoryLabels[recommendation.category]}</span>
        <span className={`priority-label ${recommendation.priority}`}>{priorityLabels[recommendation.priority]}</span>
      </div>
      <h3>{recommendation.title}</h3>
      <p>{recommendation.description}</p>
      <div className="ai-reasoning"><strong>Why this suits you</strong><p>{recommendation.reasoning}</p></div>
      <ol>{recommendation.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <small><strong>Data basis:</strong> {recommendation.basedOn}</small>
    </article>
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
        <span><small>Financial</small><strong>{recommendation.annualSavingsEur > 0 ? euro.format(recommendation.annualSavingsEur) : "After recording"}<em>{recommendation.annualSavingsEur > 0 ? "/ year" : "calculable"}</em></strong></span>
        <span><small>Consumption</small><strong>{recommendation.annualSavingsKwh > 0 ? `${decimal.format(recommendation.annualSavingsKwh)} kWh` : "–"}<em>{recommendation.annualSavingsKwh > 0 ? "/ year" : ""}</em></strong></span>
      </div>

      <div className="recommendation-meta">
        <span><Icon name="check" size={15} /> {recommendation.feasibility === "easy" ? "Easy to implement" : recommendation.feasibility === "medium" ? "Easy to plan" : "Some preparation"}</span>
        <span><Icon name="clock" size={15} /> {recommendation.effort}</span>
        {recommendation.noHardware && <span><Icon name="leaf" size={15} /> No additional hardware</span>}
      </div>

      <details className="recommendation-details">
        <summary>Show specific steps</summary>
        <ol>{recommendation.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <p><strong>Calculation basis:</strong> {recommendation.basedOn}</p>
      </details>

      <div className="recommendation-actions">
        <button className={completed ? "complete-button completed" : "complete-button"} type="button" onClick={onComplete}><Icon name="check" size={17} />{completed ? "Mark as open" : "Mark as completed"}</button>
        {!completed && <button className="dismiss-button" type="button" onClick={onDismiss}>Hide</button>}
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
