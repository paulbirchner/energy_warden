import { useState } from "react";
import type {
  ApplianceEstimate,
  ConsumptionData,
  Invoice,
  MeterReading,
} from "../types/energyWarden";

const STORAGE_KEY = "energy-warden-consumption-v1";
const EMPTY_DATA: ConsumptionData = {
  meterReadings: [],
  invoices: [],
  applianceEstimates: [],
};

/** Liest Verbrauchsdaten fehlertolerant aus dem Browser-Speicher. */
function loadData(): ConsumptionData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...EMPTY_DATA, ...JSON.parse(stored) } : EMPTY_DATA;
  } catch {
    return EMPTY_DATA;
  }
}

/**
 * Zentrale lokale Datenquelle für Zählerstände, Rechnungen und Geräteschätzungen.
 * Jede Änderung aktualisiert React-State und localStorage gemeinsam.
 */
export function useConsumptionData() {
  const [data, setData] = useState<ConsumptionData>(loadData);

  /** Persistiert einen vollständig aktualisierten Verbrauchsdatenstand. */
  function update(next: ConsumptionData) {
    setData(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return {
    data,
    /** Fügt den neuesten Zählerstand am Anfang des Verlaufs ein. */
    addMeterReading(reading: MeterReading) {
      update({ ...data, meterReadings: [reading, ...data.meterReadings] });
    },
    /** Speichert manuell erfasste Rechnungsdaten. */
    addInvoice(invoice: Invoice) {
      update({ ...data, invoices: [invoice, ...data.invoices] });
    },
    /** Speichert die berechnete Jahreshochrechnung eines Geräts. */
    addApplianceEstimate(estimate: ApplianceEstimate) {
      update({
        ...data,
        applianceEstimates: [estimate, ...data.applianceEstimates],
      });
    },
    /** Entfernt einen Eintrag anhand seiner Datengruppe und ID. */
    removeEntry(kind: keyof ConsumptionData, id: string) {
      update({ ...data, [kind]: data[kind].filter((entry) => entry.id !== id) });
    },
  };
}
