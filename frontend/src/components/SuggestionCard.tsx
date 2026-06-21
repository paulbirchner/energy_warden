import type { Suggestion } from "../types/energyWarden";
import { formatEuro } from "../utils/priceUtils";
import { formatTimeWindow } from "../utils/timeUtils";

type Props = {
  suggestion: Suggestion;
};

/** Übersetzt technische API-Kategorien in verständliche deutsche Bezeichnungen. */
function translateCategory(category: Suggestion["category"]): string {
  switch (category) {
    case "time_shift":
      return "Time shifting";
    case "weather":
      return "Solar/weather optimisation";
    case "always_on":
      return "Always-on load";
    default:
      return category;
  }
}

/** Stellt eine einzelne serverseitig erzeugte Empfehlung dar. */
export function SuggestionCard({ suggestion }: Props) {
  return (
    <article>
      <h3>{suggestion.appliance_name}</h3>

      <p>
        Category: <strong>{translateCategory(suggestion.category)}</strong>
      </p>

      <p>
        Recommended time window:{" "}
        <strong>
          {formatTimeWindow(
            suggestion.recommended_start,
            suggestion.recommended_end
          )}
        </strong>
      </p>

      <p>
        Estimated savings:{" "}
        <strong>{formatEuro(suggestion.savings_eur)}</strong>
      </p>

      <p>{suggestion.reasoning}</p>
    </article>
  );
}
