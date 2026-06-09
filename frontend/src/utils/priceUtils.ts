export function eurMwhToCentKwh(priceEurMwh: number): number {
  return priceEurMwh / 10;
}

export function formatCentKwh(priceEurMwh: number): string {
  return `${eurMwhToCentKwh(priceEurMwh).toFixed(2).replace(".", ",")} ct/kWh`;
}

export function formatEuro(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

