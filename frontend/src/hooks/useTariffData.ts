import { useState } from "react";
import type { Tariff, TariffData } from "../types/energyWarden";

/** Gemeinsamer Persistenzschlüssel für Tarife und Demo-Daten. */
export const TARIFF_STORAGE_KEY = "energy-warden-tariffs-v1";
const EMPTY_DATA: TariffData = { tariffs: [] };

/** Liest Stromtarife und entfernt nicht-strombezogene Einträge aus älteren Speicherständen. */
function loadData(): TariffData {
  try {
    const stored = localStorage.getItem(TARIFF_STORAGE_KEY);
    if (!stored) return EMPTY_DATA;
    const parsed = JSON.parse(stored) as { tariffs?: Array<Tariff & { utilityType?: string }> };
    const tariffs = (parsed.tariffs ?? [])
      .filter((tariff) => tariff.utilityType === undefined || tariff.utilityType === "electricity")
      .map((tariff) => ({
        id: tariff.id,
        provider: tariff.provider,
        name: tariff.name,
        basePriceMonthly: tariff.basePriceMonthly,
        unitPrice: tariff.unitPrice,
        validFrom: tariff.validFrom,
        isCurrent: tariff.isCurrent,
        createdAt: tariff.createdAt,
      }));
    localStorage.setItem(TARIFF_STORAGE_KEY, JSON.stringify({ tariffs }));
    return { tariffs };
  } catch {
    return EMPTY_DATA;
  }
}

/** Verwaltet Stromtarife persistent im Browser. */
export function useTariffData() {
  const [data, setData] = useState<TariffData>(loadData);

  /** Schreibt die komplette Tarifliste in State und localStorage. */
  function update(tariffs: Tariff[]) {
    const next = { tariffs };
    setData(next);
    localStorage.setItem(TARIFF_STORAGE_KEY, JSON.stringify(next));
  }

  /** Stellt sicher, dass höchstens ein Stromtarif aktiv ist. */
  function makeOnlyCurrent(tariffs: Tariff[], id: string) {
    return tariffs.map((tariff) => ({ ...tariff, isCurrent: tariff.id === id }));
  }

  return {
    data,
    /** Fügt einen Stromtarif hinzu und aktiviert ihn auf Wunsch exklusiv. */
    addTariff(tariff: Tariff) {
      const tariffs = [tariff, ...data.tariffs];
      update(tariff.isCurrent ? makeOnlyCurrent(tariffs, tariff.id) : tariffs);
    },
    /** Markiert einen bestehenden Stromtarif als aktuell. */
    setCurrent(id: string) {
      if (data.tariffs.some((tariff) => tariff.id === id)) {
        update(makeOnlyCurrent(data.tariffs, id));
      }
    },
    /** Löscht einen Tarif dauerhaft aus dem lokalen Speicher. */
    removeTariff(id: string) {
      update(data.tariffs.filter((tariff) => tariff.id !== id));
    },
  };
}
