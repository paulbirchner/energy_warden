/** Rechnet den API-Preis von Euro/MWh in die gebräuchliche Einheit Cent/kWh um. */
export function eurMwhToCentKwh(priceEurMwh: number): number {
  return priceEurMwh / 10;
}

/** Formatiert einen Euro/MWh-Wert direkt als deutsche Cent/kWh-Anzeige. */
export function formatCentKwh(priceEurMwh: number): string {
  return `${eurMwhToCentKwh(priceEurMwh).toFixed(2).replace(".", ",")} ct/kWh`;
}

/** Formatiert einen Geldbetrag mit zwei Nachkommastellen und Eurozeichen. */
export function formatEuro(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

