export function formatHourFromUnix(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimeWindow(start: number, end: number): string {
  return `${formatHourFromUnix(start)}–${formatHourFromUnix(end)} Uhr`;
}