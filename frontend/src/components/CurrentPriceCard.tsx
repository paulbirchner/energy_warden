import { useEffect, useState } from "react";
import { getCurrentPrice } from "../api/energyWardenApi";
import { formatCentKwh, formatEstimatedHouseholdPrice } from "../utils/priceUtils";

/** Lädt und zeigt den aktuellen Strompreis inklusive Lade- und Fehlerzustand. */
export function CurrentPriceCard() {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getCurrentPrice()
      .then(setPrice)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section>
        <h2>Aktueller Strompreis</h2>
        <p>Lade aktuellen Strompreis...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2>Aktueller Strompreis</h2>
        <p>Aktueller Strompreis nicht verfügbar.</p>
      </section>
    );
  }

  if (price === null) {
    return (
      <section>
        <h2>Aktueller Strompreis</h2>
        <p>Kein aktueller Strompreis vorhanden.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Geschätzter Haushaltsstrompreis</h2>
      <p>
        <strong>{formatEstimatedHouseholdPrice(price)}</strong><br />
        <small>Börsenanteil: {formatCentKwh(price)} · ohne Grundpreis</small>
      </p>
    </section>
  );
}
