import type { 
    AppliancePhotoEstimate,
    BackendAppliance,
    HealthResponse, 
    CurrentPrice,
    PersonalizedRecommendationProfile,
    PersonalizedRecommendationResponse,
    PriceData,
    Suggestion,
} from "../types/energyWarden";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

/** Führt einen typisierten HTTP-Aufruf aus und vereinheitlicht die Fehlerbehandlung. */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `API error: ${response.status}`);
  }

  return response.json();
}

/** Prüft, ob das Backend erreichbar ist. */
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

/** Lädt den Strompreis der aktuellen Stunde in Euro pro MWh. */
export function getCurrentPrice(): Promise<CurrentPrice> {
  return request<CurrentPrice>("/prices/current");
}

/** Lädt alle verfügbaren stündlichen Strompreise des aktuellen Tages. */
export function getPriceData(): Promise<PriceData[]> {
  return request<PriceData[]>("/prices");
}

/** Lädt bereits vom Backend erzeugte KI-Empfehlungen. */
export function getSuggestions(): Promise<Suggestion[]> {
  return request<Suggestion[]>("/suggestions");
}

/** Stößt die Empfehlungsgenerierung im Backend an. */
export function generateSuggestions(): Promise<Suggestion[]> {
  return request<Suggestion[]>("/suggestions/generate", {
    method: "POST",
  });
}

/** Lädt alle im Backend gespeicherten Geräte. */
export function getAppliances(): Promise<BackendAppliance[]> {
  return request<BackendAppliance[]>("/appliances");
}

/** Lässt ein Gerätefoto analysieren und das erkannte Gerät im Backend speichern. */
export function estimateApplianceFromPhoto(image: File): Promise<AppliancePhotoEstimate> {
  const formData = new FormData();
  formData.append("image", image);

  return request<AppliancePhotoEstimate>("/appliances/estimate-from-photo", {
    method: "POST",
    body: formData,
  });
}

/** Erstellt anhand der reduzierten Haushaltsdaten personalisierte KI-Empfehlungen. */
export function generatePersonalizedRecommendations(
  profile: PersonalizedRecommendationProfile,
): Promise<PersonalizedRecommendationResponse> {
  return request<PersonalizedRecommendationResponse>("/recommendations/personalized", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}
