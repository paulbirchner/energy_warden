import type { ConsumptionData, Tariff } from "../types/energyWarden";

export type MonthlyPoint = {
  key: string;
  label: string;
  consumption: number;
  estimated: boolean;
};

/** Erzeugt den einheitlichen Schlüssel YYYY-MM für Monatsaggregation. */
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Wandelt ein HTML-Datumsfeld ohne UTC-Verschiebung in ein Date-Objekt um. */
function dateFromInput(value: string) {
  return new Date(`${value}T00:00:00`);
}

/**
 * Verteilt einen Gesamtverbrauch anteilig auf alle berührten Kalendermonate.
 * Dadurch wird beispielsweise eine Jahresrechnung nicht vollständig dem Endmonat zugerechnet.
 */
function addInterval(target: Map<string, number>, start: Date, end: Date, total: number) {
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0 || total < 0) return;

  let cursor = start;
  while (cursor < end) {
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const segmentEnd = nextMonth < end ? nextMonth : end;
    const share = (segmentEnd.getTime() - cursor.getTime()) / totalMs;
    const key = monthKey(cursor);
    target.set(key, (target.get(key) ?? 0) + total * share);
    cursor = segmentEnd;
  }
}

/**
 * Erstellt eine chronologische Monatsreihe aus den bestmöglichen vorhandenen Daten.
 * Priorität: Zählerdifferenzen, danach Rechnungen, danach Geräteschätzungen.
 */
export function buildMonthlySeries(data: ConsumptionData): MonthlyPoint[] {
  const totals = new Map<string, number>();
  const readingsByMeter = new Map<string, typeof data.meterReadings>();

  data.meterReadings.forEach((reading) => {
    const readings = readingsByMeter.get(reading.meterNumber) ?? [];
    readings.push(reading);
    readingsByMeter.set(reading.meterNumber, readings);
  });

  readingsByMeter.forEach((readings) => {
    readings.sort((a, b) => a.readingDate.localeCompare(b.readingDate));
    for (let index = 1; index < readings.length; index += 1) {
      const previous = readings[index - 1];
      const current = readings[index];
      addInterval(
        totals,
        dateFromInput(previous.readingDate),
        dateFromInput(current.readingDate),
        current.readingKwh - previous.readingKwh,
      );
    }
  });

  let estimated = false;
  if (totals.size === 0) {
    data.invoices.forEach((invoice) => addInterval(
      totals,
      dateFromInput(invoice.billingStart),
      dateFromInput(invoice.billingEnd),
      invoice.consumptionKwh,
    ));
  }

  if (totals.size === 0) {
    const annualEstimate = data.applianceEstimates.reduce(
      (sum, appliance) => sum + appliance.annualConsumptionKwh,
      0,
    );
    if (annualEstimate > 0) {
      estimated = true;
      const now = new Date();
      for (let offset = 11; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        totals.set(monthKey(date), annualEstimate / 12);
      }
    }
  }

  return [...totals.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, consumption]) => ({
      key,
      label: new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" })
        .format(new Date(`${key}-01T00:00:00`))
        .replace(" ", " ’"),
      consumption,
      estimated,
    }));
}

/** Hochrechnung auf zwölf Monate anhand maximal der letzten zwölf Monatswerte. */
export function annualProjection(series: MonthlyPoint[]) {
  if (series.length === 0) return 0;
  const relevant = series.slice(-12);
  return relevant.reduce((sum, point) => sum + point.consumption, 0) / relevant.length * 12;
}

/** Berechnet die prozentuale Änderung des letzten zum vorletzten Monatswert. */
export function consumptionChange(series: MonthlyPoint[]) {
  if (series.length < 2) return null;
  const previous = series.at(-2)?.consumption ?? 0;
  const current = series.at(-1)?.consumption ?? 0;
  return previous === 0 ? null : (current - previous) / previous * 100;
}

/** Erkennt Abweichungen ab 25 Prozent gegenüber dem Mittel der drei Vormonate. */
export function findAnomaly(series: MonthlyPoint[]) {
  if (series.length < 4 || series.every((point) => point.estimated)) return null;
  const current = series.at(-1);
  const baseline = series.slice(-4, -1);
  const average = baseline.reduce((sum, point) => sum + point.consumption, 0) / baseline.length;
  if (!current || average === 0) return null;
  const deviation = (current.consumption - average) / average * 100;
  return Math.abs(deviation) >= 25 ? { point: current, deviation } : null;
}

/** Berechnet jährliche Gesamtkosten aus Grundpreis und Verbrauchspreis. */
export function tariffAnnualCost(tariff: Tariff, consumption: number) {
  return tariff.basePriceMonthly * 12 + tariff.unitPrice * consumption;
}

/**
 * Prognostiziert zwölf kommende Monate. Vorhandene Werte desselben Kalendermonats
 * bilden die saisonale Basis, andernfalls wird der Monatsdurchschnitt verwendet.
 */
export function buildForecast(series: MonthlyPoint[], tariff: Tariff | undefined) {
  if (series.length === 0 || !tariff) return [];
  const average = annualProjection(series) / 12;
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
    const historicalMonth = [...series].reverse().find(
      (point) => Number(point.key.slice(5)) === date.getMonth() + 1,
    );
    const consumption = historicalMonth?.consumption ?? average;
    return {
      key: monthKey(date),
      label: new Intl.DateTimeFormat("de-DE", { month: "short" }).format(date),
      consumption,
      cost: tariff.basePriceMonthly + tariff.unitPrice * consumption,
    };
  });
}
