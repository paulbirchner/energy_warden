import { useEffect, useState } from "react";
import { getPriceData } from "../api/energyWardenApi";
import type { PriceData } from "../types/energyWarden";
import { formatCentKwh, formatEstimatedHouseholdPrice } from "../utils/priceUtils";
import { formatHourFromUnix } from "../utils/timeUtils";

/** Zeigt die stündlichen Preise des Tages als einfache Liste. */
export function PriceList() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getPriceData()
      .then(setPrices)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section>
        <h2>Today's electricity prices</h2>
        <p>Loading today's prices...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2>Today's electricity prices</h2>
        <p>Price data could not be loaded.</p>
      </section>
    );
  }

  if (prices.length === 0) {
    return (
      <section>
        <h2>Today's electricity prices</h2>
        <p>No price data is available.</p>
        <p>
          Price data must be synchronised in the backend for the demo.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2>Today's electricity prices</h2>

      <ul>
        {prices.map((price) => (
          <li key={price.id}>
            {formatHourFromUnix(price.timestamp)}:{" "}
            <strong>{formatEstimatedHouseholdPrice(price.price_eur_mwh)}</strong>{" "}
            <small>(wholesale {formatCentKwh(price.price_eur_mwh)})</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
