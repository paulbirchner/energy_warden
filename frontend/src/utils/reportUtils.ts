import type { ConsumptionData, LocalRecommendation, Tariff } from "../types/energyWarden";
import { buildMonthlySeries } from "./analysisUtils";

export type MonthlyReport = {
  monthKey: string;
  monthLabel: string;
  consumptionKwh: number;
  previousChange: number | null;
  baseCostEur: number;
  consumptionCostEur: number;
  totalCostEur: number | null;
  achievedSavingsEur: number;
  achievedSavingsKwh: number;
  openSavingsEur: number;
  dataSource: string;
  recommendations: LocalRecommendation[];
  hotspots: Array<{ name: string; consumptionKwh: number; share: number }>;
};

/** Liefert vorhandene sowie mindestens die letzten zwölf auswählbaren Berichtsmonate. */
export function getReportMonths(series: ReturnType<typeof buildMonthlySeries>) {
  const keys = new Set(series.map((point) => point.key));
  const now = new Date();
  for (let offset = 0; offset < 12; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    keys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return [...keys].sort((a, b) => b.localeCompare(a));
}

/** Formatiert YYYY-MM als deutschen Monatsnamen mit Jahr. */
export function formatReportMonth(key: string) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" })
    .format(new Date(`${key}-01T00:00:00`));
}

/**
 * Baut das vollständige Berichtsmodell für einen Monat auf: Verbrauch, Kosten,
 * Einsparfortschritt, Hotspots und die drei wichtigsten offenen Maßnahmen.
 */
export function buildMonthlyReport(
  monthKey: string,
  data: ConsumptionData,
  tariffs: Tariff[],
  recommendations: LocalRecommendation[],
  completedIds: string[],
  dismissedIds: string[],
): MonthlyReport {
  const series = buildMonthlySeries(data);
  const point = series.find((entry) => entry.key === monthKey);
  const pointIndex = series.findIndex((entry) => entry.key === monthKey);
  const previous = pointIndex > 0 ? series[pointIndex - 1] : undefined;
  const consumptionKwh = point?.consumption ?? 0;
  const previousChange = previous && previous.consumption > 0
    ? (consumptionKwh - previous.consumption) / previous.consumption * 100
    : null;
  const tariff = tariffs.find((entry) => entry.utilityType === "electricity" && entry.isCurrent);
  const baseCostEur = tariff ? tariff.basePriceMonthly : 0;
  const consumptionCostEur = tariff ? tariff.unitPrice * consumptionKwh : 0;
  const completed = recommendations.filter((entry) => completedIds.includes(entry.id));
  const open = recommendations.filter(
    (entry) => !completedIds.includes(entry.id) && !dismissedIds.includes(entry.id),
  );
  const totalDeviceConsumption = data.applianceEstimates.reduce(
    (sum, appliance) => sum + appliance.annualConsumptionKwh,
    0,
  );
  const hotspots = [...data.applianceEstimates]
    .sort((a, b) => b.annualConsumptionKwh - a.annualConsumptionKwh)
    .slice(0, 4)
    .map((appliance) => ({
      name: appliance.applianceName,
      consumptionKwh: appliance.annualConsumptionKwh,
      share: totalDeviceConsumption
        ? appliance.annualConsumptionKwh / totalDeviceConsumption * 100
        : 0,
    }));

  return {
    monthKey,
    monthLabel: formatReportMonth(monthKey),
    consumptionKwh,
    previousChange,
    baseCostEur,
    consumptionCostEur,
    totalCostEur: tariff ? baseCostEur + consumptionCostEur : null,
    achievedSavingsEur: completed.reduce((sum, entry) => sum + entry.annualSavingsEur / 12, 0),
    achievedSavingsKwh: completed.reduce((sum, entry) => sum + entry.annualSavingsKwh / 12, 0),
    openSavingsEur: open.reduce((sum, entry) => sum + entry.annualSavingsEur, 0),
    dataSource: point ? point.estimated ? "Geräteschätzung" : "Erfasste Verbrauchsdaten" : "Keine Verbrauchsdaten",
    recommendations: open.slice(0, 3),
    hotspots,
  };
}

/** Maskiert einen Wert RFC-4180-ähnlich für die semikolongetrennte CSV-Datei. */
function csvValue(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

/** Exportiert alle Monatswerte und ihre Tarifkosten als deutschen CSV-Inhalt. */
export function createConsumptionCsv(data: ConsumptionData, tariffs: Tariff[]) {
  const tariff = tariffs.find((entry) => entry.utilityType === "electricity" && entry.isCurrent);
  const rows = buildMonthlySeries(data).map((point) => {
    const baseCost = tariff?.basePriceMonthly ?? 0;
    const consumptionCost = tariff ? tariff.unitPrice * point.consumption : 0;
    return [
      point.key,
      point.consumption.toFixed(2),
      tariff ? baseCost.toFixed(2) : "",
      tariff ? consumptionCost.toFixed(2) : "",
      tariff ? (baseCost + consumptionCost).toFixed(2) : "",
      point.estimated ? "Geräteschätzung" : "Verbrauchsdaten",
    ];
  });
  const header = ["Monat", "Verbrauch (kWh)", "Grundpreis (EUR)", "Verbrauchskosten (EUR)", "Gesamtkosten (EUR)", "Datenquelle"];
  return [header, ...rows].map((row) => row.map(csvValue).join(";")).join("\r\n");
}
