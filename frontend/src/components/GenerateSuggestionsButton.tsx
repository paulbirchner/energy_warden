import { useState } from "react";
import { generateSuggestions } from "../api/energyWardenApi";
import type { Suggestion } from "../types/energyWarden";

type Props = {
  onGenerated: (suggestions: Suggestion[]) => void;
};

/** Startet die serverseitige Empfehlungsgenerierung und meldet das Ergebnis zurück. */
export function GenerateSuggestionsButton({ onGenerated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  /** Kapselt Lade-, Erfolgs- und Fehlerzustand des POST-Aufrufs. */
  async function handleClick() {
    setLoading(true);
    setError(false);

    try {
      const newSuggestions = await generateSuggestions();
      onGenerated(newSuggestions);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading
          ? "Calculating recommendations..."
          : "Recalculate recommendations"}
      </button>

      {error && (
        <p>
          Recommendations could not be generated. Please check that price and
          weather data are available and that the API key is configured.
        </p>
      )}
    </div>
  );
}
