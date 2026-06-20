import type { ApplianceEstimate, PriceData, Tariff } from "../types/energyWarden";
import { dynamicBasePriceMonthly, estimatedHouseholdPriceCentKwh } from "./priceUtils";

const HOUSEHOLD_PROFILE = [
  0.55, 0.45, 0.4, 0.38, 0.4, 0.55, 0.9, 1.25,
  1.05, 0.85, 0.8, 0.85, 0.95, 1, 0.9, 0.85,
  0.95, 1.25, 1.55, 1.65, 1.5, 1.2, 0.9, 0.7,
];

const FLEXIBLE_DEVICE_PATTERN = /wasch|spül|geschirr|trockner|wallbox|lade|elektroauto|\bev\b/i;

export type ShiftedDevice = {
  id: string;
  name: string;
  energyKwh: number;
  durationHours: number;
  previousStartHour: number;
  optimizedStartHour: number;
  savingEur: number;
};

export type DynamicDayComparison = {
  dailyConsumptionKwh: number;
  flexibleConsumptionKwh: number;
  estimatedPriceHours: number;
  dynamicBeforeEur: number;
  dynamicOptimizedEur: number;
  fixedCosts: Array<{ tariff: Tariff; costEur: number }>;
  shiftedDevices: ShiftedDevice[];
  hourly: Array<{
    timestamp: number;
    totalPriceCentKwh: number;
    optimizedLoadKwh: number;
    optimizedFlexibleLoadKwh: number;
  }>;
};

function normalize(values: number[]) {
  const sum = values.reduce((total, value) => total + value, 0);
  return values.map((value) => value / sum);
}

function localHour(timestamp: number) {
  return new Date(timestamp * 1000).getHours();
}

function preferredStartHour(name: string) {
  if (/geschirr|spül/i.test(name)) return 20;
  if (/wallbox|lade|elektroauto|\bev\b/i.test(name)) return 19;
  return 18;
}

function indexForHour(prices: PriceData[], hour: number) {
  const exact = prices.findIndex((price) => localHour(price.timestamp) === hour);
  return exact >= 0 ? exact : 0;
}

function cheapestWindow(pricesCent: number[], duration: number) {
  let bestIndex = 0;
  let bestAverage = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= pricesCent.length - duration; index += 1) {
    const average = pricesCent
      .slice(index, index + duration)
      .reduce((sum, price) => sum + price, 0) / duration;
    if (average < bestAverage) {
      bestAverage = average;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function addEnergy(load: number[], start: number, duration: number, energyKwh: number) {
  const energyPerHour = energyKwh / duration;
  for (let offset = 0; offset < duration; offset += 1) {
    const index = Math.min(start + offset, load.length - 1);
    load[index] += energyPerHour;
  }
}

function variableCost(load: number[], pricesCent: number[]) {
  return load.reduce((sum, energyKwh, index) => sum + energyKwh * pricesCent[index] / 100, 0);
}

/** Ergänzt fehlende Stunden transparent mit dem Mittel der verfügbaren Tagespreise. */
function completeDayPrices(prices: PriceData[]) {
  const usablePrices = prices.filter((price) => Number.isFinite(price.price_eur_mwh));
  if (usablePrices.length === 0) return null;
  const averagePrice = usablePrices.reduce((sum, price) => sum + price.price_eur_mwh, 0)
    / usablePrices.length;
  const byHour = new Map(usablePrices.map((price) => [localHour(price.timestamp), price]));
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const completed = Array.from({ length: 24 }, (_, hour) => {
    const existing = byHour.get(hour);
    if (existing) return existing;
    const timestamp = new Date(dayStart);
    timestamp.setHours(hour);
    return {
      id: -(hour + 1),
      timestamp: Math.floor(timestamp.getTime() / 1000),
      price_eur_mwh: averagePrice,
      source: "estimated_day_average",
    };
  });
  return { prices: completed, estimatedHours: 24 - byHour.size };
}

/**
 * Simuliert einen repräsentativen Tag mit identischem Verbrauch für Fix- und
 * dynamische Tarife. Flexible Geräte werden in das günstigste zusammenhängende
 * Preisfenster verschoben; es handelt sich bewusst um eine PoC-Modellrechnung.
 */
export function buildDynamicDayComparison(
  prices: PriceData[],
  annualConsumptionKwh: number,
  appliances: ApplianceEstimate[],
  tariffs: Tariff[],
): DynamicDayComparison | null {
  const completedPrices = completeDayPrices(prices);
  if (!completedPrices || annualConsumptionKwh <= 0) return null;
  const sortedPrices = completedPrices.prices;

  const dailyConsumptionKwh = annualConsumptionKwh / 365;
  const pricesCent = sortedPrices.map((price) => estimatedHouseholdPriceCentKwh(price.price_eur_mwh));
  const flexibleDevices = appliances.filter((appliance) =>
    FLEXIBLE_DEVICE_PATTERN.test(appliance.applianceName) && appliance.annualConsumptionKwh > 0,
  );
  const rawFlexibleKwh = flexibleDevices.reduce(
    (sum, appliance) => sum + appliance.annualConsumptionKwh / 365,
    0,
  );
  const flexibleConsumptionKwh = Math.min(rawFlexibleKwh, dailyConsumptionKwh * 0.35);
  const flexibleScale = rawFlexibleKwh > 0 ? flexibleConsumptionKwh / rawFlexibleKwh : 0;
  const profileWeights = normalize(sortedPrices.map((price) => HOUSEHOLD_PROFILE[localHour(price.timestamp)]));
  const baseConsumptionKwh = Math.max(0, dailyConsumptionKwh - flexibleConsumptionKwh);
  const baseLoad = profileWeights.map((weight) => weight * baseConsumptionKwh);
  const beforeLoad = [...baseLoad];
  const optimizedLoad = [...baseLoad];
  const optimizedFlexibleLoad = sortedPrices.map(() => 0);
  const shiftedDevices: ShiftedDevice[] = [];

  for (const appliance of flexibleDevices) {
    const energyKwh = appliance.annualConsumptionKwh / 365 * flexibleScale;
    const durationHours = Math.max(1, Math.min(6, Math.ceil(appliance.hoursPerDay)));
    const previousStartIndex = Math.min(
      indexForHour(sortedPrices, preferredStartHour(appliance.applianceName)),
      sortedPrices.length - durationHours,
    );
    const optimizedStartIndex = cheapestWindow(pricesCent, durationHours);
    addEnergy(beforeLoad, previousStartIndex, durationHours, energyKwh);
    addEnergy(optimizedLoad, optimizedStartIndex, durationHours, energyKwh);
    addEnergy(optimizedFlexibleLoad, optimizedStartIndex, durationHours, energyKwh);

    const previousAverage = pricesCent
      .slice(previousStartIndex, previousStartIndex + durationHours)
      .reduce((sum, price) => sum + price, 0) / durationHours;
    const optimizedAverage = pricesCent
      .slice(optimizedStartIndex, optimizedStartIndex + durationHours)
      .reduce((sum, price) => sum + price, 0) / durationHours;
    shiftedDevices.push({
      id: appliance.id,
      name: appliance.applianceName,
      energyKwh,
      durationHours,
      previousStartHour: localHour(sortedPrices[previousStartIndex].timestamp),
      optimizedStartHour: localHour(sortedPrices[optimizedStartIndex].timestamp),
      savingEur: energyKwh * (previousAverage - optimizedAverage) / 100,
    });
  }

  const dynamicDailyBase = dynamicBasePriceMonthly * 12 / 365;
  return {
    dailyConsumptionKwh,
    flexibleConsumptionKwh,
    estimatedPriceHours: completedPrices.estimatedHours,
    dynamicBeforeEur: variableCost(beforeLoad, pricesCent) + dynamicDailyBase,
    dynamicOptimizedEur: variableCost(optimizedLoad, pricesCent) + dynamicDailyBase,
    fixedCosts: tariffs
      .map((tariff) => ({
        tariff,
        costEur: dailyConsumptionKwh * tariff.unitPrice + tariff.basePriceMonthly * 12 / 365,
      }))
      .sort((a, b) => a.costEur - b.costEur),
    shiftedDevices,
    hourly: sortedPrices.map((price, index) => ({
      timestamp: price.timestamp,
      totalPriceCentKwh: pricesCent[index],
      optimizedLoadKwh: optimizedLoad[index],
      optimizedFlexibleLoadKwh: optimizedFlexibleLoad[index],
    })),
  };
}
