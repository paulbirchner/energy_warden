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
        <h2>Current electricity price</h2>
        <p>Loading current electricity price...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2>Current electricity price</h2>
        <p>The current electricity price is unavailable.</p>
      </section>
    );
  }

  if (price === null) {
    return (
      <section>
        <h2>Current electricity price</h2>
        <p>No current electricity price is available.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Estimated household electricity price</h2>
      <p>
        <strong>{formatEstimatedHouseholdPrice(price)}</strong><br />
        <small>Wholesale component: {formatCentKwh(price)} · excluding base charge</small>
      </p>
    </section>
  );
}
