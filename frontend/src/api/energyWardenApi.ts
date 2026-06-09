import type { 
    HealthResponse, 
    CurrentPrice,
    PriceData,
    Suggestion,
} from "../types/energyWarden";

const API_BASE_URL = "http://127.0.0.1:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function getCurrentPrice(): Promise<CurrentPrice> {
  return request<CurrentPrice>("/prices/current");
}

export function getPriceData(): Promise<PriceData[]> {
  return request<PriceData[]>("/prices");
}

export function getSuggestions(): Promise<Suggestion[]> {
  return request<Suggestion[]>("/suggestions");
}

export function generateSuggestions(): Promise<Suggestion[]> {
  return request<Suggestion[]>("/suggestions/generate", {
    method: "POST",
  });
}