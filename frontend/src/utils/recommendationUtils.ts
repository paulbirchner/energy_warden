import type {
  ApplianceEstimate,
  ConsumptionData,
  LocalRecommendation,
  RecommendationPriority,
  Tariff,
} from "../types/energyWarden";
import { annualProjection, buildMonthlySeries, tariffAnnualCost } from "./analysisUtils";

/** Leitet aus finanzieller und energetischer Wirkung eine Prioritätsstufe ab. */
function priorityFor(savingsEur: number, savingsKwh: number): RecommendationPriority {
  if (savingsEur >= 60 || savingsKwh >= 200) return "high";
  if (savingsEur >= 20 || savingsKwh >= 75) return "medium";
  return "low";
}

/** Bestimmt den geeignetsten Strompreis: aktiver Tarif, Gerätemittel oder Fallback. */
function electricityPrice(data: ConsumptionData, tariffs: Tariff[]) {
  const current = tariffs.find((tariff) => tariff.utilityType === "electricity" && tariff.isCurrent);
  if (current) return current.unitPrice;
  const devicePrices = data.applianceEstimates.map((item) => item.pricePerKwh).filter((price) => price > 0);
  return devicePrices.length > 0
    ? devicePrices.reduce((sum, price) => sum + price, 0) / devicePrices.length
    : 0.32;
}

/**
 * Erzeugt eine konkrete Maßnahme für ein Gerät. Die Berechnung wird an typische
 * Gerätegruppen angepasst, bleibt aber vollständig nachvollziehbar und lokal.
 */
function deviceRecommendation(device: ApplianceEstimate, price: number): LocalRecommendation {
  const normalizedName = device.applianceName.toLocaleLowerCase("de-DE");
  let title = `${device.applianceName}: Nutzungszeit gezielt reduzieren`;
  let description: string;
  let savingsKwh: number;
  let steps: string[];

  if (/wasch|spül|trockner/.test(normalizedName)) {
    savingsKwh = device.powerWatts / 1000 * device.hoursPerDay * 12;
    title = `${device.applianceName} besser auslasten`;
    description = "Bereits ein vermiedener, nur teilweise gefüllter Durchlauf pro Monat senkt Verbrauch und Kosten.";
    steps = [
      "Gerät erst bei sinnvoller Beladung starten.",
      "Eco-Programm nutzen, wenn ausreichend Zeit vorhanden ist.",
      "Nach einem Monat prüfen, ob zwölf unnötige Läufe pro Jahr realistisch sind.",
    ];
  } else if (/heiz|wärme|heat/.test(normalizedName)) {
    savingsKwh = device.annualConsumptionKwh * 0.05;
    title = `${device.applianceName} feinjustieren`;
    description = "Eine kleine Anpassung von Zeitplan und Solltemperatur kann den geschätzten Geräteverbrauch um etwa fünf Prozent reduzieren.";
    steps = [
      "Zeitplan an tatsächliche Anwesenheitszeiten anpassen.",
      "Solltemperatur schrittweise statt stark verändern.",
      "Verbrauch nach vier Wochen mit dem vorherigen Zeitraum vergleichen.",
    ];
  } else {
    const reducedMinutes = Math.min(30, Math.max(10, Math.round(device.hoursPerDay * 60 * 0.15)));
    savingsKwh = device.powerWatts / 1000 * reducedMinutes / 60 * device.daysPerWeek * 52;
    description = `Wenn du die Nutzung an ${device.daysPerWeek} Tagen pro Woche um etwa ${reducedMinutes} Minuten verkürzt, sinkt der hochgerechnete Jahresverbrauch.`;
    steps = [
      `Nutzungsdauer zunächst um ${reducedMinutes} Minuten reduzieren.`,
      "Gerät nach Gebrauch vollständig ausschalten.",
      "Nach vier Wochen prüfen, ob die Änderung alltagstauglich ist.",
    ];
  }

  const savingsEur = savingsKwh * price;
  return {
    id: `device-${device.id}`,
    category: "device",
    priority: priorityFor(savingsEur, savingsKwh),
    feasibility: "easy",
    title,
    description,
    annualSavingsKwh: savingsKwh,
    annualSavingsEur: savingsEur,
    effort: "Kein Kauf notwendig",
    basedOn: `${device.annualConsumptionKwh.toFixed(0)} kWh geschätzter Jahresverbrauch`,
    steps,
    noHardware: true,
  };
}

/**
 * Generiert und sortiert alle persönlichen Maßnahmen aus Geräten, Monatsverlauf
 * und Tarifalternativen. Ohne Datengrundlage wird eine Onboarding-Maßnahme geliefert.
 */
export function generateLocalRecommendations(data: ConsumptionData, tariffs: Tariff[]): LocalRecommendation[] {
  const recommendations: LocalRecommendation[] = [];
  const price = electricityPrice(data, tariffs);
  const series = buildMonthlySeries(data);
  const annual = annualProjection(series);

  [...data.applianceEstimates]
    .sort((a, b) => b.annualConsumptionKwh - a.annualConsumptionKwh)
    .slice(0, 4)
    .forEach((device) => recommendations.push(deviceRecommendation(device, price)));

  if (annual > 0) {
    const savingsKwh = annual * 0.05;
    const savingsEur = savingsKwh * price;
    recommendations.push({
      id: "behavior-standby",
      category: "behavior",
      priority: priorityFor(savingsEur, savingsKwh),
      feasibility: "easy",
      title: "Dauerverbrauch konsequent vermeiden",
      description: "Setze dir eine feste Abendroutine und schalte nicht benötigte Geräte vollständig aus. Als vorsichtiges Ziel werden fünf Prozent deines hochgerechneten Verbrauchs angesetzt.",
      annualSavingsKwh: savingsKwh,
      annualSavingsEur: savingsEur,
      effort: "5 Minuten pro Tag",
      basedOn: `${annual.toFixed(0)} kWh Jahreshochrechnung`,
      steps: ["Abends Küche, Arbeitsplatz und Unterhaltungselektronik prüfen.", "Standby-Geräte vollständig ausschalten.", "Routine zwei Wochen lang testen und beibehalten, was funktioniert."],
      noHardware: true,
    });
  }

  if (series.length >= 4 && !series.every((point) => point.estimated)) {
    const current = series.at(-1);
    const previous = series.slice(-4, -1);
    const baseline = previous.reduce((sum, point) => sum + point.consumption, 0) / previous.length;
    if (current && baseline > 0 && current.consumption > baseline * 1.25) {
      const avoidableKwh = (current.consumption - baseline) * 12;
      const savingsEur = avoidableKwh * price;
      recommendations.push({
        id: `anomaly-${current.key}`,
        category: "anomaly",
        priority: "high",
        feasibility: "easy",
        title: `Verbrauchsanstieg im ${current.label} prüfen`,
        description: "Der letzte Monatswert liegt deutlich über den drei Vormonaten. Bleibt der Mehrverbrauch bestehen, entstehen vermeidbare Folgekosten.",
        annualSavingsKwh: avoidableKwh,
        annualSavingsEur: savingsEur,
        effort: "Etwa 15 Minuten",
        basedOn: `${((current.consumption - baseline) / baseline * 100).toFixed(0)} % Abweichung`,
        steps: ["Neue oder länger genutzte Geräte notieren.", "Zählerstand auf Eingabefehler prüfen.", "Den nächsten Zählerstand früher als üblich erfassen."],
        noHardware: true,
      });
    }
  }

  const currentTariff = tariffs.find((tariff) => tariff.utilityType === "electricity" && tariff.isCurrent);
  if (currentTariff && annual > 0) {
    const alternatives = tariffs
      .filter((tariff) => tariff.utilityType === "electricity" && tariff.id !== currentTariff.id)
      .map((tariff) => ({ tariff, cost: tariffAnnualCost(tariff, annual) }))
      .sort((a, b) => a.cost - b.cost);
    const best = alternatives[0];
    const currentCost = tariffAnnualCost(currentTariff, annual);
    if (best && best.cost < currentCost) {
      const savingsEur = currentCost - best.cost;
      recommendations.push({
        id: `tariff-${currentTariff.id}-${best.tariff.id}`,
        category: "tariff",
        priority: priorityFor(savingsEur, 0),
        feasibility: "medium",
        title: `Tarif „${best.tariff.name}“ prüfen`,
        description: `Bei deinem hochgerechneten Verbrauch ist der gespeicherte Alternativtarif günstiger als „${currentTariff.name}“.` ,
        annualSavingsKwh: 0,
        annualSavingsEur: savingsEur,
        effort: "Tarifbedingungen prüfen",
        basedOn: `${annual.toFixed(0)} kWh und beide gespeicherten Tarife`,
        steps: ["Laufzeit und Kündigungsfrist des aktuellen Vertrags prüfen.", "Preisgarantie und einmalige Boni vergleichen.", "Erst nach Prüfung aller Vertragsbedingungen wechseln."],
        noHardware: true,
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "starter-measurement",
      category: "behavior",
      priority: "medium",
      feasibility: "easy",
      title: "Eine belastbare Verbrauchsbasis schaffen",
      description: "Erfasse zwei Zählerstände und deine wichtigsten Geräte. Danach kann Energy Warden konkrete Einsparungen statt allgemeiner Tipps berechnen.",
      annualSavingsKwh: 0,
      annualSavingsEur: 0,
      effort: "Etwa 10 Minuten",
      basedOn: "Noch unvollständige Verbrauchsdaten",
      steps: ["Aktuellen Zählerstand erfassen.", "Mindestens ein häufig genutztes Gerät schätzen.", "Nach dem nächsten Zählerstand erneut hierher zurückkehren."],
      noHardware: true,
    });
  }

  const priorityOrder: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority] || b.annualSavingsEur - a.annualSavingsEur,
  );
}
