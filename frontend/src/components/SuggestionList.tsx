import { useEffect, useState } from "react";
import { getSuggestions } from "../api/energyWardenApi";
import type { Suggestion } from "../types/energyWarden";
import { GenerateSuggestionsButton } from "./GenerateSuggestionsButton";
import { SuggestionCard } from "./SuggestionCard";

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
      <h2>KI-Empfehlungen</h2>

      <GenerateSuggestionsButton onGenerated={setSuggestions} />

      {loading && <p>Lade Empfehlungen...</p>}

      {error && <p>Empfehlungen konnten nicht geladen werden.</p>}

      {!loading && !error && suggestions.length === 0 && (
        <>
          <p>Noch keine Empfehlungen vorhanden.</p>
          <p>
            Klicke auf „Empfehlungen neu berechnen“, sobald das Backend
            vorbereitet ist.
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