import { useState } from "react";
import type { RecommendationProgress } from "../types/energyWarden";

/** Gemeinsamer Persistenzschlüssel für Maßnahmenfortschritt und Demo-Daten. */
export const RECOMMENDATION_PROGRESS_STORAGE_KEY = "energy-warden-recommendation-progress-v1";
const EMPTY_PROGRESS: RecommendationProgress = { completedIds: [], dismissedIds: [] };

/** Lädt den Bearbeitungsstand der Empfehlungen aus localStorage. */
function loadProgress(): RecommendationProgress {
  try {
    const stored = localStorage.getItem(RECOMMENDATION_PROGRESS_STORAGE_KEY);
    return stored ? { ...EMPTY_PROGRESS, ...JSON.parse(stored) } : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Verwaltet lokal, welche Maßnahmen umgesetzt oder ausgeblendet wurden. */
export function useRecommendationProgress() {
  const [progress, setProgress] = useState<RecommendationProgress>(loadProgress);

  /** Synchronisiert den neuen Fortschritt mit State und Browser-Speicher. */
  function update(next: RecommendationProgress) {
    setProgress(next);
    localStorage.setItem(RECOMMENDATION_PROGRESS_STORAGE_KEY, JSON.stringify(next));
  }

  return {
    progress,
    /** Schaltet eine Empfehlung zwischen offen und umgesetzt um. */
    toggleCompleted(id: string) {
      update({
        ...progress,
        completedIds: progress.completedIds.includes(id)
          ? progress.completedIds.filter((entry) => entry !== id)
          : [...progress.completedIds, id],
      });
    },
    /** Blendet eine Empfehlung aus, ohne sie fachlich zu löschen. */
    dismiss(id: string) {
      update({ ...progress, dismissedIds: [...new Set([...progress.dismissedIds, id])] });
    },
    /** Entfernt alle Ausblendungen. */
    restoreDismissed() {
      update({ ...progress, dismissedIds: [] });
    },
  };
}
