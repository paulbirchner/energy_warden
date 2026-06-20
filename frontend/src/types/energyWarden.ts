// API-Antworten des vorhandenen Backends.
export type HealthResponse = {
    status: "ok";
};

export type CurrentPrice = number;

export type PriceData = {
    id: number;
    timestamp: number;
    price_eur_mwh: number;
    source: string;
};

export type SuggestionCategory = "time_shift" | "weather" | "always_on";

export type Suggestion = {
  id: number;
  category: SuggestionCategory;
  appliance_id: number;
  recommended_start: number;
  recommended_end: number;
  savings_eur: number;
  reasoning: string;
  created_at: number;
  appliance_name: string;
};

export type BackendAppliance = {
  id: number;
  name: string;
  room_id: number | null;
  watt: number;
  duration_min: number;
};

export type AppliancePhotoEstimate = {
  id: number;
  name: string;
  estimated_watt: number;
  typical_duration_min: number;
  confidence: "low" | "medium" | "high";
  note: string;
};

// Lokal erfasste Verbrauchsdaten (FA-05 bis FA-08).
export type MeterReading = {
  id: string;
  meterNumber: string;
  readingKwh: number;
  readingDate: string;
  note: string;
  createdAt: string;
};

export type Invoice = {
  id: string;
  provider: string;
  billingStart: string;
  billingEnd: string;
  consumptionKwh: number;
  totalAmountEur: number;
  documentName: string | null;
  documentSize: number | null;
  createdAt: string;
};

export type ApplianceEstimate = {
  id: string;
  applianceName: string;
  powerWatts: number;
  hoursPerDay: number;
  daysPerWeek: number;
  pricePerKwh: number;
  annualConsumptionKwh: number;
  annualCostEur: number;
  createdAt: string;
};

export type ConsumptionData = {
  meterReadings: MeterReading[];
  invoices: Invoice[];
  applianceEstimates: ApplianceEstimate[];
};

// Stromtarif- und Kostendaten (FA-09 bis FA-12).
export type Tariff = {
  id: string;
  provider: string;
  name: string;
  basePriceMonthly: number;
  unitPrice: number;
  validFrom: string;
  isCurrent: boolean;
  createdAt: string;
};

export type TariffData = {
  tariffs: Tariff[];
};

// Konfigurierbare Mitteilungsoptionen (FA-23 bis FA-26).
export type NotificationPreferences = {
  consumptionAlerts: boolean;
  meterReminders: boolean;
  realtimeTips: boolean;
  browserNotifications: boolean;
  anomalyThresholdPercent: number;
  meterReminderDays: number;
  highPriceThresholdCent: number;
  lowPriceThresholdCent: number;
  quietStart: string;
  quietEnd: string;
  dismissedIds: string[];
};

// Lokal erzeugte und priorisierte Einsparmaßnahmen (FA-18 bis FA-22).
export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationCategory = "device" | "behavior" | "tariff" | "anomaly";
export type RecommendationFeasibility = "easy" | "medium" | "advanced";

export type LocalRecommendation = {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  feasibility: RecommendationFeasibility;
  title: string;
  description: string;
  annualSavingsKwh: number;
  annualSavingsEur: number;
  effort: string;
  basedOn: string;
  steps: string[];
  noHardware: boolean;
};

export type RecommendationProgress = {
  completedIds: string[];
  dismissedIds: string[];
};

export type PersonalizedRecommendationProfile = {
  meterReadings: Array<{ readingDate: string; readingKwh: number }>;
  invoices: Array<{
    billingStart: string;
    billingEnd: string;
    consumptionKwh: number;
    totalAmountEur: number;
  }>;
  appliances: Array<{
    applianceName: string;
    powerWatts: number;
    hoursPerDay: number;
    daysPerWeek: number;
    annualConsumptionKwh: number;
    annualCostEur: number;
  }>;
  tariffs: Array<{
    provider: string;
    name: string;
    basePriceMonthly: number;
    unitPrice: number;
    isCurrent: boolean;
  }>;
  calculatedRecommendations: Array<{
    category: RecommendationCategory;
    title: string;
    description: string;
    annualSavingsKwh: number;
    annualSavingsEur: number;
    basedOn: string;
  }>;
};

export type PersonalizedAiRecommendation = {
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  reasoning: string;
  steps: string[];
  basedOn: string;
};

export type PersonalizedRecommendationResponse = {
  summary: string;
  recommendations: PersonalizedAiRecommendation[];
};
