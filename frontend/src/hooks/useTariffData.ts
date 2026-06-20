import { useState } from "react";
import type { Tariff, TariffData, UtilityType } from "../types/energyWarden";

/** Gemeinsamer Persistenzschlüssel für Tarife und Demo-Daten. */
export const TARIFF_STORAGE_KEY = "energy-warden-tariffs-v1";
const EMPTY_DATA: TariffData = { tariffs: [] };

/** Liest gespeicherte Tarife; beschädigte Daten führen zu einem leeren Zustand. */
function loadData(): TariffData {
  try {
    const stored = localStorage.getItem(TARIFF_STORAGE_KEY);
    return stored ? { ...EMPTY_DATA, ...JSON.parse(stored) } : EMPTY_DATA;
  } catch {
    return EMPTY_DATA;
  }
}

/** Verwaltet Strom- und Wassertarife persistent im Browser. */
export function useTariffData() {
  const [data, setData] = useState<TariffData>(loadData);

  /** Schreibt die komplette Tarifliste in State und localStorage. */
  function update(tariffs: Tariff[]) {
    const next = { tariffs };
    setData(next);
    localStorage.setItem(TARIFF_STORAGE_KEY, JSON.stringify(next));
  }

  /** Stellt sicher, dass je Versorgungsart höchstens ein Tarif aktiv ist. */
  function makeOnlyCurrent(tariffs: Tariff[], type: UtilityType, id: string) {
    return tariffs.map((tariff) =>
      tariff.utilityType === type ? { ...tariff, isCurrent: tariff.id === id } : tariff,
    );
  }

  return {
    data,
    /** Fügt einen Tarif hinzu und aktiviert ihn auf Wunsch exklusiv. */
    addTariff(tariff: Tariff) {
      const tariffs = [tariff, ...data.tariffs];
      update(tariff.isCurrent ? makeOnlyCurrent(tariffs, tariff.utilityType, tariff.id) : tariffs);
    },
    /** Markiert einen bestehenden Tarif seiner Versorgungsart als aktuell. */
    setCurrent(id: string) {
      const selected = data.tariffs.find((tariff) => tariff.id === id);
      if (selected) update(makeOnlyCurrent(data.tariffs, selected.utilityType, id));
    },
    /** Löscht einen Tarif dauerhaft aus dem lokalen Speicher. */
    removeTariff(id: string) {
      update(data.tariffs.filter((tariff) => tariff.id !== id));
    },
  };
}
