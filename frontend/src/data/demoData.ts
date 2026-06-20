import type {
  ConsumptionData,
  NotificationPreferences,
  RecommendationProgress,
  TariffData,
} from "../types/energyWarden";

/** Alle lokalen Speicherbereiche, die ein vollständiges PoC-Szenario bilden. */
export type DemoDataBundle = {
  consumption: ConsumptionData;
  tariffs: TariffData;
  notifications: NotificationPreferences;
  recommendationProgress: RecommendationProgress;
};

/** Formatiert ein lokales Datum ohne mögliche UTC-Verschiebung als YYYY-MM-DD. */
function dateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Erzeugt einen stabilen Tag in einem Monat relativ zum aktuellen Datum. */
function relativeMonth(offset: number, day = 1) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, day);
}

/**
 * Erzeugt einen reproduzierbaren, aber datumsrelativen Demo-Haushalt.
 * Der letzte Monat enthält bewusst eine deutliche Verbrauchsspitze, damit
 * Analyse, Warnungen und Empfehlungen während der Präsentation sichtbar sind.
 */
export function createDemoData(): DemoDataBundle {
  const monthlyConsumption = [242, 228, 219, 235, 258, 284, 310, 295, 276, 251, 268, 382];
  let meterValue = 12_500;
  const meterReadings = Array.from({ length: 13 }, (_, index) => {
    if (index > 0) meterValue += monthlyConsumption[index - 1];
    const readingDate = dateInput(relativeMonth(index - 12));
    return {
      id: `demo-meter-${index}`,
      meterNumber: "1 EMH 00428731",
      readingKwh: meterValue,
      readingDate,
      note: index === 12 ? "Ablesung für die PoC-Präsentation" : "Monatliche Demo-Ablesung",
      createdAt: `${readingDate}T08:00:00`,
    };
  }).reverse();

  const billingStart = dateInput(relativeMonth(-12, 1));
  const billingEnd = dateInput(relativeMonth(0, 1));
  const now = new Date().toISOString();

  return {
    consumption: {
      meterReadings,
      invoices: [
        {
          id: "demo-invoice-electricity",
          provider: "Stadtwerke Regensburg",
          billingStart,
          billingEnd,
          consumptionKwh: monthlyConsumption.reduce((sum, value) => sum + value, 0),
          totalAmountEur: 1_284.6,
          documentName: "stromabrechnung-demo.pdf",
          documentSize: 486_240,
          createdAt: now,
        },
      ],
      applianceEstimates: [
        {
          id: "demo-device-heat-pump",
          applianceName: "Wärmepumpe",
          powerWatts: 2_800,
          hoursPerDay: 2,
          daysPerWeek: 7,
          pricePerKwh: 0.36,
          annualConsumptionKwh: 2_038.4,
          annualCostEur: 733.82,
          createdAt: now,
        },
        {
          id: "demo-device-dishwasher",
          applianceName: "Geschirrspüler",
          powerWatts: 1_800,
          hoursPerDay: 1.2,
          daysPerWeek: 5,
          pricePerKwh: 0.36,
          annualConsumptionKwh: 561.6,
          annualCostEur: 202.18,
          createdAt: now,
        },
        {
          id: "demo-device-washer",
          applianceName: "Waschmaschine",
          powerWatts: 2_000,
          hoursPerDay: 1.1,
          daysPerWeek: 3,
          pricePerKwh: 0.36,
          annualConsumptionKwh: 343.2,
          annualCostEur: 123.55,
          createdAt: now,
        },
        {
          id: "demo-device-gaming-pc",
          applianceName: "Gaming-PC",
          powerWatts: 450,
          hoursPerDay: 3,
          daysPerWeek: 5,
          pricePerKwh: 0.36,
          annualConsumptionKwh: 351,
          annualCostEur: 126.36,
          createdAt: now,
        },
        {
          id: "demo-device-tv",
          applianceName: "Fernseher",
          powerWatts: 120,
          hoursPerDay: 4,
          daysPerWeek: 7,
          pricePerKwh: 0.36,
          annualConsumptionKwh: 174.72,
          annualCostEur: 62.9,
          createdAt: now,
        },
      ],
    },
    tariffs: {
      tariffs: [
        {
          id: "demo-tariff-current",
          provider: "Stadtwerke Regensburg",
          name: "Regensburg Komfort",
          basePriceMonthly: 14.5,
          unitPrice: 0.36,
          validFrom: dateInput(relativeMonth(-8, 1)),
          isCurrent: true,
          createdAt: now,
        },
        {
          id: "demo-tariff-alternative",
          provider: "Grünstrom Bayern",
          name: "ÖkoDirekt 24",
          basePriceMonthly: 11.9,
          unitPrice: 0.31,
          validFrom: dateInput(relativeMonth(-2, 1)),
          isCurrent: false,
          createdAt: now,
        },
        {
          id: "demo-tariff-flex",
          provider: "Energy Flex",
          name: "Flex Zuhause",
          basePriceMonthly: 9.9,
          unitPrice: 0.335,
          validFrom: dateInput(relativeMonth(-1, 1)),
          isCurrent: false,
          createdAt: now,
        },
      ],
    },
    notifications: {
      consumptionAlerts: true,
      meterReminders: true,
      realtimeTips: true,
      browserNotifications: false,
      anomalyThresholdPercent: 25,
      meterReminderDays: 30,
      highPriceThresholdCent: 25,
      lowPriceThresholdCent: 12,
      quietStart: "22:00",
      quietEnd: "07:00",
      dismissedIds: [],
    },
    recommendationProgress: {
      completedIds: ["device-demo-device-tv"],
      dismissedIds: [],
    },
  };
}
