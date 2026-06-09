import type { Suggestion } from "../types/energyWarden";
import { formatEuro } from "../utils/priceUtils";
import { formatTimeWindow } from "../utils/timeUtils";

type Props = {
  suggestion: Suggestion;
};

function translateCategory(category: Suggestion["category"]): string {
  switch (category) {
    case "time_shift":
      return "Zeitverschiebung";
    case "weather":
      return "PV-/Wetteroptimierung";
    case "always_on":
      return "Dauerverbraucher";
    default:
      return category;
  }
}

export function SuggestionCard({ suggestion }: Props) {
  return (
    <article>
      <h3>{suggestion.appliance_name}</h3>

      <p>
        Kategorie: <strong>{translateCategory(suggestion.category)}</strong>
      </p>

      <p>
        Empfohlenes Zeitfenster:{" "}
        <strong>
          {formatTimeWindow(
            suggestion.recommended_start,
            suggestion.recommended_end
          )}
        </strong>
      </p>

      <p>
        Geschätzte Ersparnis:{" "}
        <strong>{formatEuro(suggestion.savings_eur)}</strong>
      </p>

      <p>{suggestion.reasoning}</p>
    </article>
  );
}