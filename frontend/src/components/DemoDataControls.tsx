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
      "Your existing entries will be backed up and replaced with demo data. Continue?",
    )) return;
    installDemoData();
    window.location.reload();
  }

  /** Beendet den Demo-Modus und stellt den automatisch gesicherten Stand wieder her. */
  function leaveDemo() {
    if (!window.confirm("Exit demo mode and restore your previous data?")) return;
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
        <button className="demo-close" type="button" aria-label="Close demo window" onClick={() => setOpen(false)}><Icon name="close" size={18} /></button>
        <span className="icon-tile large"><Icon name="report" /></span>
        <p className="eyebrow">PoC Presentation</p>
        <h2 id="demo-title">{demoActive ? "Demo mode is active" : "Load demo data"}</h2>
        <p className="demo-modal-intro">A prepared sample household fills every section with plausible data generated relative to the current month.</p>

        <ul className="demo-feature-list">
          <li><Icon name="check" size={15} /> 12 months of consumption with a visible anomaly</li>
          <li><Icon name="check" size={15} /> Appliances, invoice and alternative tariffs</li>
          <li><Icon name="check" size={15} /> Recommendations, alerts and monthly report</li>
        </ul>

        <div className="demo-safety-note"><Icon name="savings" size={18} /><span><strong>Your data is preserved</strong>Existing entries are backed up before the demo and restored when you reset it.</span></div>

        <div className="demo-modal-actions">
          <button className="primary-button" type="button" onClick={loadDemo}><Icon name="refresh" size={17} />{demoActive ? "Reload demo data" : "Load demo data"}</button>
          {demoActive && <button className="secondary-button" type="button" onClick={leaveDemo}>Restore original data</button>}
          <button className="text-action" type="button" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </section>
    </div>, document.body)}
  </>;
}
