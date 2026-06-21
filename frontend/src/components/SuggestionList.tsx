import { useEffect, useState } from "react";
import { getSuggestions } from "../api/energyWardenApi";
import type { Suggestion } from "../types/energyWarden";
import { GenerateSuggestionsButton } from "./GenerateSuggestionsButton";
import { SuggestionCard } from "./SuggestionCard";

/** Lädt, aktualisiert und rendert die Empfehlungsliste des Backends. */
export function SuggestionList() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getSuggestions()
      .then(setSuggestions)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h2>AI recommendations</h2>

      <GenerateSuggestionsButton onGenerated={setSuggestions} />

      {loading && <p>Loading recommendations...</p>}

      {error && <p>Recommendations could not be loaded.</p>}

      {!loading && !error && suggestions.length === 0 && (
        <>
          <p>No recommendations are available yet.</p>
          <p>
            Select “Recalculate recommendations” once the backend is ready.
          </p>
        </>
      )}

      {!loading &&
        !error &&
        suggestions.map((suggestion) => (
          <SuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
    </section>
  );
}
