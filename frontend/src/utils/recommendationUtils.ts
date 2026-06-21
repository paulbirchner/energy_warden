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
  const current = tariffs.find((tariff) => tariff.isCurrent);
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
  const normalizedName = device.applianceName.toLocaleLowerCase("en-GB");
  let title = `${device.applianceName}: reduce usage time`;
  let description: string;
  let savingsKwh: number;
  let steps: string[];

  if (/wasch|spül|trockner|washer|washing|dishwasher|dryer/.test(normalizedName)) {
    savingsKwh = device.powerWatts / 1000 * device.hoursPerDay * 12;
    title = `Run ${device.applianceName} more efficiently`;
    description = "Avoiding just one partially filled cycle per month reduces both consumption and costs.";
    steps = [
      "Only start the appliance with a sensible load.",
      "Use the eco programme when there is enough time.",
      "After one month, check whether avoiding twelve unnecessary cycles per year is realistic.",
    ];
  } else if (/heiz|wärme|heat/.test(normalizedName)) {
    savingsKwh = device.annualConsumptionKwh * 0.05;
    title = `Fine-tune ${device.applianceName}`;
    description = "A small adjustment to the schedule and target temperature can reduce estimated appliance consumption by around five per cent.";
    steps = [
      "Adjust the schedule to actual occupancy times.",
      "Change the target temperature gradually rather than dramatically.",
      "Compare consumption with the previous period after four weeks.",
    ];
  } else {
    const reducedMinutes = Math.min(30, Math.max(10, Math.round(device.hoursPerDay * 60 * 0.15)));
    savingsKwh = device.powerWatts / 1000 * reducedMinutes / 60 * device.daysPerWeek * 52;
    description = `Reducing usage by around ${reducedMinutes} minutes on ${device.daysPerWeek} days per week lowers projected annual consumption.`;
    steps = [
      `Start by reducing usage by ${reducedMinutes} minutes.`,
      "Switch the appliance off completely after use.",
      "After four weeks, check whether the change works in everyday life.",
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
    effort: "No purchase required",
    basedOn: `${device.annualConsumptionKwh.toFixed(0)} kWh estimated annual consumption`,
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
      title: "Consistently avoid standby consumption",
      description: "Create a fixed evening routine and fully switch off appliances you do not need. Five per cent of your projected consumption is used as a conservative target.",
      annualSavingsKwh: savingsKwh,
      annualSavingsEur: savingsEur,
      effort: "5 minutes per day",
      basedOn: `${annual.toFixed(0)} kWh annual projection`,
      steps: ["Check the kitchen, workspace and entertainment electronics in the evening.", "Switch standby appliances off completely.", "Test the routine for two weeks and keep what works."],
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
        title: `Review the consumption increase in ${current.label}`,
        description: "The latest monthly value is significantly above the previous three months. If this additional consumption continues, it will create avoidable costs.",
        annualSavingsKwh: avoidableKwh,
        annualSavingsEur: savingsEur,
        effort: "About 15 minutes",
        basedOn: `${((current.consumption - baseline) / baseline * 100).toFixed(0)}% deviation`,
        steps: ["Note any new appliances or appliances used for longer.", "Check the meter reading for input errors.", "Record the next meter reading earlier than usual."],
        noHardware: true,
      });
    }
  }

  const currentTariff = tariffs.find((tariff) => tariff.isCurrent);
  if (currentTariff && annual > 0) {
    const alternatives = tariffs
      .filter((tariff) => tariff.id !== currentTariff.id)
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
        title: `Review the “${best.tariff.name}” tariff`,
        description: `Based on your projected consumption, the saved alternative tariff is cheaper than “${currentTariff.name}”.`,
        annualSavingsKwh: 0,
        annualSavingsEur: savingsEur,
        effort: "Review tariff terms",
        basedOn: `${annual.toFixed(0)} kWh and both saved tariffs`,
        steps: ["Check the term and notice period of the current contract.", "Compare price guarantees and one-off bonuses.", "Only switch after reviewing all contract terms."],
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
      title: "Build a reliable consumption baseline",
      description: "Record two meter readings and your most important appliances. Energy Warden can then calculate specific savings instead of giving general tips.",
      annualSavingsKwh: 0,
      annualSavingsEur: 0,
      effort: "About 10 minutes",
      basedOn: "Incomplete consumption data",
      steps: ["Record the current meter reading.", "Estimate at least one frequently used appliance.", "Return here after the next meter reading."],
      noHardware: true,
    });
  }

  const priorityOrder: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority] || b.annualSavingsEur - a.annualSavingsEur,
  );
}
