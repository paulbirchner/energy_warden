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