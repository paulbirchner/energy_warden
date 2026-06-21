type IconName = "meter" | "invoice" | "upload" | "device" | "camera" | "trash" | "check" | "tariff" | "calculator" | "compare" | "refresh" | "chart" | "hotspot" | "alert" | "trend" | "bell" | "clock" | "settings" | "close" | "recommendation" | "leaf" | "savings" | "report" | "download" | "print";

const paths: Record<IconName, string> = {
  meter: "M4 19v-7a8 8 0 0 1 16 0v7M7 19h10M12 12l3-3M12 12h.01",
  invoice: "M6 3h9l3 3v15l-3-2-3 2-3-2-3 2V3Zm3 6h6M9 13h6",
  upload: "M12 16V4m0 0L7 9m5-5 5 5M5 20h14",
  device: "M7 3h10a2 2 0 0 1 2 2v14H5V5a2 2 0 0 1 2-2Zm2 12h6M9 7h6",
  camera: "M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  trash: "M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6",
  check: "m5 12 4 4L19 6",
  tariff: "M4 6.5V5a2 2 0 0 1 2-2h5.5L20 11.5 11.5 20 3 11.5V6.5h1Zm4 2h.01",
  calculator: "M6 3h12v18H6V3Zm3 4h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  compare: "M7 4v16M3 8l4-4 4 4m6 12V4m-4 12 4 4 4-4",
  refresh: "M20 7v5h-5M4 17v-5h5m9.5-4A7 7 0 0 0 6.2 6M5.5 16A7 7 0 0 0 17.8 18",
  chart: "M4 19V9m5 10V5m5 14v-7m5 7V3",
  hotspot: "M12 22a7 7 0 0 0 7-7c0-4-3-5-2-10-3 2-4 4-4 7-1-2-2-3-4-4-1 3-3 5-3 8a7 7 0 0 0 7 7Zm0-3a3 3 0 0 1-3-3c0-1.5 1-2.5 2-4 0 2 2 2 2 4a3 3 0 0 1-3 3Z",
  alert: "M12 9v4m0 4h.01M10.3 3.7 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z",
  trend: "M3 17 9 11l4 4 8-9m-6 0h6v6",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.7 7.7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.8 3h-4L10.4 6a8 8 0 0 0-1.8 1L6.2 6 4.2 9.4l2 1.6a7.7 7.7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3h4l.4-3a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2-1.6a7.7 7.7 0 0 0 .1-1Z",
  close: "m6 6 12 12M18 6 6 18",
  recommendation: "M9 18h6m-5 3h4m4-9a6 6 0 1 0-12 0c0 2 1 3.5 2.2 4.6.5.6.8 1.4.8 2.2h6c0-.8.3-1.6.8-2.2C17 15.5 18 14 18 12Z",
  leaf: "M20 4C12 4 6 7 5 13c-.7 4 2 7 6 7 6 0 9-7 9-16ZM4 21c3-5 7-8 12-11",
  savings: "M12 6c-4 0-7 2.5-7 6s3 6 7 6 7-2.5 7-6-3-6-7-6Zm0-3v3m0 12v3m-2-6h3a2 2 0 0 0 0-4h-2a2 2 0 0 1 0-4h3",
  report: "M6 3h9l3 3v15H6V3Zm8 0v4h4M9 11h6M9 15h6M9 19h4",
  download: "M12 3v12m0 0 5-5m-5 5-5-5M5 21h14",
  print: "M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7v-7Z",
};

/** Rendert ein einheitliches, dekoratives SVG-Icon aus dem zentralen Pfadkatalog. */
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
