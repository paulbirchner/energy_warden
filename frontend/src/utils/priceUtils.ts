/** Rechnet den API-Preis von Euro/MWh in die gebräuchliche Einheit Cent/kWh um. */
export function eurMwhToCentKwh(priceEurMwh: number): number {
  return priceEurMwh / 10;
}

/**
 * Vereinfachter variabler Aufschlag für Netzentgelte, Steuern, Abgaben und Vertrieb.
 * Er kann je nach Region und dynamischem Tarif über die Vite-Umgebung angepasst werden.
 * Ein monatlicher Grundpreis ist nicht enthalten.
 */
const configuredSurcharge = Number(import.meta.env.VITE_PRICE_SURCHARGE_CENT_KWH ?? 20);
export const priceSurchargeCentKwh = Number.isFinite(configuredSurcharge)
  ? configuredSurcharge
  : 20;

const configuredDynamicBasePrice = Number(import.meta.env.VITE_DYNAMIC_BASE_PRICE_MONTHLY ?? 9.9);
export const dynamicBasePriceMonthly = Number.isFinite(configuredDynamicBasePrice)
  ? configuredDynamicBasePrice
  : 9.9;

/** Schätzt den variablen Haushaltsstrompreis aus Börsenpreis und pauschalen Preisbestandteilen. */
export function estimatedHouseholdPriceCentKwh(priceEurMwh: number): number {
  return eurMwhToCentKwh(priceEurMwh) + priceSurchargeCentKwh;
}

/** Formatiert Centwerte und vermeidet bei sehr kleinen negativen Preisen die Anzeige „-0,00“. */
function formatCentValue(value: number): string {
  const roundedValue = Math.abs(value) < 0.005 ? 0 : value;
  return roundedValue.toFixed(2);
}

/** Formatiert einen Euro/MWh-Wert direkt als deutsche Cent/kWh-Anzeige. */
export function formatCentKwh(priceEurMwh: number): string {
  return `${formatCentValue(eurMwhToCentKwh(priceEurMwh))} ct/kWh`;
}

/** Formatiert den geschätzten variablen Haushaltsstrompreis. */
export function formatEstimatedHouseholdPrice(priceEurMwh: number): string {
  return `${formatCentValue(estimatedHouseholdPriceCentKwh(priceEurMwh))} ct/kWh`;
}

/** Formatiert einen Geldbetrag mit zwei Nachkommastellen und Eurozeichen. */
export function formatEuro(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(value);
}

