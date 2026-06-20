import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import {
  hasExistingAppData,
  installDemoData,
  isDemoModeActive,
  restoreOriginalData,
} from "../utils/demoDataUtils";

/**
 * Öffnet die Demo-Verwaltung und führt Laden beziehungsweise Wiederherstellen aus.
 * Ein Reload stellt sicher, dass alle lokalen Daten-Hooks denselben Stand einlesen.
 */
export function DemoDataControls() {
  const [open, setOpen] = useState(false);
  const demoActive = isDemoModeActive();

  /** Sichert vorhandene Eingaben nach Bestätigung und aktiviert den PoC-Datensatz. */
  function loadDemo() {
    const needsConfirmation = !demoActive && hasExistingAppData();
    if (needsConfirmation && !window.confirm(
      "Vorhandene Eingaben werden sicher zwischengespeichert und durch Demo-Daten ersetzt. Fortfahren?",
    )) return;
    installDemoData();
    window.location.reload();
  }

  /** Beendet den Demo-Modus und stellt den automatisch gesicherten Stand wieder her. */
  function leaveDemo() {
    if (!window.confirm("Demo-Modus beenden und die vorherigen Daten wiederherstellen?")) return;
    restoreOriginalData();
    window.location.reload();
  }

  return <>
    <div className="demo-data-controls">
      <button className={demoActive ? "demo-trigger active" : "demo-trigger"} type="button" onClick={() => setOpen(true)}>
        <span /> Demo
      </button>
    </div>

    {open && createPortal(<div className="demo-modal-backdrop" role="presentation">
      <section className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title">
        <button className="demo-close" type="button" aria-label="Demo-Fenster schließen" onClick={() => setOpen(false)}><Icon name="close" size={18} /></button>
        <span className="icon-tile large"><Icon name="report" /></span>
        <p className="eyebrow">PoC-Präsentation</p>
        <h2 id="demo-title">{demoActive ? "Demo-Modus ist aktiv" : "Demo-Daten laden"}</h2>
        <p className="demo-modal-intro">Ein vorbereiteter Beispielhaushalt füllt alle Bereiche mit plausiblen, relativ zum aktuellen Monat erzeugten Daten.</p>

        <ul className="demo-feature-list">
          <li><Icon name="check" size={15} /> 12 Monate Verbrauch mit erkennbarer Auffälligkeit</li>
          <li><Icon name="check" size={15} /> Geräte, Rechnung und alternative Tarife</li>
          <li><Icon name="check" size={15} /> Empfehlungen, Warnungen und Monatsbericht</li>
        </ul>

        <div className="demo-safety-note"><Icon name="savings" size={18} /><span><strong>Deine Daten bleiben erhalten</strong>Vorhandene Eingaben werden vor der Demo gesichert und beim Zurücksetzen wiederhergestellt.</span></div>

        <div className="demo-modal-actions">
          <button className="primary-button" type="button" onClick={loadDemo}><Icon name="refresh" size={17} />{demoActive ? "Demo-Daten neu laden" : "Demo-Daten laden"}</button>
          {demoActive && <button className="secondary-button" type="button" onClick={leaveDemo}>Originaldaten wiederherstellen</button>}
          <button className="text-action" type="button" onClick={() => setOpen(false)}>Abbrechen</button>
        </div>
      </section>
    </div>, document.body)}
  </>;
}
