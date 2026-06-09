import { useState } from "react";
import { generateSuggestions } from "../api/energyWardenApi";
import type { Suggestion } from "../types/energyWarden";

type Props = {
  onGenerated: (suggestions: Suggestion[]) => void;
};

export function GenerateSuggestionsButton({ onGenerated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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
          ? "Empfehlungen werden berechnet..."
          : "Empfehlungen neu berechnen"}
      </button>

      {error && (
        <p>
          Empfehlungen konnten nicht generiert werden. Bitte prüfen, ob
          Preis-/Wetterdaten vorhanden sind und der API-Key gesetzt ist.
        </p>
      )}
    </div>
  );
}