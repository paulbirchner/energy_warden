import { useEffect, useMemo, useState, type FormEvent } from "react";
import { estimateApplianceFromPhoto } from "../api/energyWardenApi";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import type { AppliancePhotoEstimate, ConsumptionData } from "../types/energyWarden";

type Tab = "meter" | "invoice" | "device";

const today = new Date().toISOString().slice(0, 10);
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Erzeugt kollisionsarme IDs für lokal gespeicherte Einträge. */
function id() {
  return crypto.randomUUID();
}

/** Hauptseite für Zählerstände, Rechnungen und gerätebezogene Schätzungen. */
export default function ConsumptionPage() {
  const [tab, setTab] = useState<Tab>("meter");
  const store = useConsumptionData();
  const totalEstimated = store.data.applianceEstimates.reduce(
    (sum, item) => sum + item.annualConsumptionKwh,
    0,
  );
  const latestReading = [...store.data.meterReadings].sort((a, b) =>
    b.readingDate.localeCompare(a.readingDate),
  )[0];

  return (
    <main className="page-content consumption-page">
      <div className="page-heading heading-row">
        <div>
          <p className="eyebrow">Verbrauchsdaten</p>
          <h1>Verbrauch erfassen</h1>
          <p className="subtitle">Je genauer deine Daten, desto hilfreicher werden deine Energiespartipps.</p>
        </div>
        <span className="local-badge"><span /> Lokal gespeichert</span>
      </div>

      <div className="stats-grid" aria-label="Zusammenfassung">
        <Stat label="Letzter Zählerstand" value={latestReading ? `${number.format(latestReading.readingKwh)} kWh` : "Noch offen"} icon="meter" />
        <Stat label="Erfasste Rechnungen" value={String(store.data.invoices.length)} icon="invoice" />
        <Stat label="Gerätehochrechnung" value={`${number.format(totalEstimated)} kWh/Jahr`} icon="device" />
      </div>

      <div className="workspace-card">
        <div className="tabs" role="tablist" aria-label="Art der Verbrauchserfassung">
          <TabButton active={tab === "meter"} icon="meter" label="Zählerstand" onClick={() => setTab("meter")} />
          <TabButton active={tab === "invoice"} icon="invoice" label="Rechnung" onClick={() => setTab("invoice")} />
          <TabButton active={tab === "device"} icon="device" label="Geräteschätzung" onClick={() => setTab("device")} />
        </div>

        <div className="tab-content">
          {tab === "meter" && <MeterForm data={store.data} onSave={store.addMeterReading} />}
          {tab === "invoice" && <InvoiceForm onSave={store.addInvoice} />}
          {tab === "device" && <DeviceForm onSave={store.addApplianceEstimate} />}
        </div>
      </div>

      <History data={store.data} onRemove={store.removeEntry} />
    </main>
  );
}

/** Kleine Kennzahlenkarte der Verbrauchsübersicht. */
function Stat({ label, value, icon }: { label: string; value: string; icon: "meter" | "invoice" | "device" }) {
  return (
    <article className="stat-card">
      <span className="icon-tile"><Icon name={icon} /></span>
      <span><small>{label}</small><strong>{value}</strong></span>
    </article>
  );
}

/** Umschalter zwischen den drei Erfassungsformularen. */
function TabButton({ active, icon, label, onClick }: { active: boolean; icon: "meter" | "invoice" | "device"; label: string; onClick: () => void }) {
  return (
    <button className={active ? "tab active" : "tab"} type="button" role="tab" aria-selected={active} onClick={onClick}>
      <Icon name={icon} size={20} /> {label}
    </button>
  );
}

/** Einheitlicher Kopfbereich für die Verbrauchsformulare. */
function FormIntro({ icon, title, children }: { icon: "meter" | "invoice" | "device"; title: string; children: string }) {
  return (
    <div className="form-intro">
      <span className="icon-tile large"><Icon name={icon} size={26} /></span>
      <div><h2>{title}</h2><p>{children}</p></div>
    </div>
  );
}

type MeterInput = { meterNumber: string; readingKwh: string; readingDate: string; note: string };

/** Erfasst einen Zählerstand und prüft ihn gegen den vorherigen Wert desselben Zählers. */
function MeterForm({ data, onSave }: { data: ConsumptionData; onSave: (value: ConsumptionData["meterReadings"][number]) => void }) {
  const [form, setForm] = useState<MeterInput>({ meterNumber: "", readingKwh: "", readingDate: today, note: "" });
  const [saved, setSaved] = useState(false);
  const previous = data.meterReadings
    .filter((item) => item.meterNumber === form.meterNumber && item.readingDate <= form.readingDate)
    .sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];
  const reading = Number(form.readingKwh);
  const invalidReading = previous && reading > 0 && reading < previous.readingKwh;

  /** Validiert und übergibt den normalisierten Zählerstand an den Datenspeicher. */
  function submit(event: FormEvent) {
    event.preventDefault();
    if (invalidReading) return;
    onSave({ id: id(), ...form, readingKwh: reading, createdAt: new Date().toISOString() });
    setForm({ ...form, readingKwh: "", note: "" });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={submit}>
      <FormIntro icon="meter" title="Zählerstand eintragen">Trage den aktuellen Stand deines Stromzählers ein.</FormIntro>
      <div className="form-grid">
        <label>Zählernummer<input required value={form.meterNumber} onChange={(e) => setForm({ ...form, meterNumber: e.target.value })} placeholder="z. B. 1 EMH 001234" /></label>
        <label>Ablesedatum<input required type="date" max={today} value={form.readingDate} onChange={(e) => setForm({ ...form, readingDate: e.target.value })} /></label>
        <label className="wide">Zählerstand<div className="input-unit"><input required min="0" step="0.1" type="number" value={form.readingKwh} onChange={(e) => setForm({ ...form, readingKwh: e.target.value })} placeholder="12.450,8" /><span>kWh</span></div></label>
        <label className="wide">Notiz <small>(optional)</small><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="z. B. Einzug oder turnusmäßige Ablesung" rows={3} /></label>
      </div>
      {invalidReading && <p className="form-error">Der Wert liegt unter dem letzten Stand von {number.format(previous.readingKwh)} kWh. Bitte prüfe deine Eingabe.</p>}
      <SubmitButton saved={saved} label="Zählerstand speichern" />
    </form>
  );
}

/** Erfasst Rechnungs- und optionale Dokumentmetadaten. */
function InvoiceForm({ onSave }: { onSave: (value: ConsumptionData["invoices"][number]) => void }) {
  const [provider, setProvider] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [consumption, setConsumption] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [saved, setSaved] = useState(false);

  /** Prüft Dateityp und maximale Größe, ohne die Datei selbst lokal zu persistieren. */
  function chooseFile(selected?: File) {
    setFileError("");
    setFile(null);
    if (!selected) return setFile(null);
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(selected.type)) return setFileError("Bitte verwende PDF, JPG oder PNG.");
    if (selected.size > 10 * 1024 * 1024) return setFileError("Die Datei darf höchstens 10 MB groß sein.");
    setFile(selected);
  }

  /** Speichert die Rechnungswerte und die geprüften Dateimetadaten. */
  function submit(event: FormEvent) {
    event.preventDefault();
    if (start > end || fileError) return;
    onSave({ id: id(), provider, billingStart: start, billingEnd: end, consumptionKwh: Number(consumption), totalAmountEur: Number(amount), documentName: file?.name ?? null, documentSize: file?.size ?? null, createdAt: new Date().toISOString() });
    setProvider(""); setStart(""); setEnd(""); setConsumption(""); setAmount(""); setFile(null);
    setSaved(true); window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={submit}>
      <FormIntro icon="invoice" title="Rechnungsdaten erfassen">Übernimm die wichtigsten Werte oder hänge direkt deine Rechnung an.</FormIntro>
      <div className="form-grid">
        <label className="wide">Energieversorger<input required value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Name deines Energieversorgers" /></label>
        <label>Abrechnungsbeginn<input required type="date" max={today} value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Abrechnungsende<input required type="date" max={today} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <label>Verbrauch<div className="input-unit"><input required min="0" step="0.1" type="number" value={consumption} onChange={(e) => setConsumption(e.target.value)} /><span>kWh</span></div></label>
        <label>Rechnungsbetrag<div className="input-unit"><input required min="0" step="0.01" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /><span>€</span></div></label>
      </div>
      {start && end && start > end && <p className="form-error">Das Enddatum muss nach dem Startdatum liegen.</p>}
      <label className="upload-zone">
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => chooseFile(e.target.files?.[0])} />
        <Icon name="upload" size={26} />
        <span><strong>{file ? file.name : "Rechnung hinzufügen"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB ausgewählt` : "PDF, JPG oder PNG · maximal 10 MB"}</small></span>
      </label>
      {fileError && <p className="form-error">{fileError}</p>}
      <SubmitButton saved={saved} label="Rechnung speichern" />
    </form>
  );
}

/** Berechnet den Jahresverbrauch eines Geräts live aus Leistung und Nutzungsdauer. */
function DeviceForm({ onSave }: { onSave: (value: ConsumptionData["applianceEstimates"][number]) => void }) {
  const [name, setName] = useState("");
  const [watts, setWatts] = useState("1000");
  const [hours, setHours] = useState("1");
  const [days, setDays] = useState("7");
  const [price, setPrice] = useState("0.32");
  const [saved, setSaved] = useState(false);
  const [recognition, setRecognition] = useState<AppliancePhotoEstimate | null>(null);
  const [recognitionStatus, setRecognitionStatus] = useState<"idle" | "loading" | "error">("idle");
  const [recognitionError, setRecognitionError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const estimate = useMemo(() => {
    const annualKwh = Number(watts) / 1000 * Number(hours) * Number(days) * 52;
    return { annualKwh: Number.isFinite(annualKwh) ? annualKwh : 0, cost: annualKwh * Number(price) };
  }, [watts, hours, days, price]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  /** Sendet ein Foto an die vorhandene Backend-Erkennung und übernimmt die Schätzung ins Formular. */
  async function recognizeImage(file?: File) {
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setRecognitionError("Bitte verwende JPG, PNG, WEBP oder GIF.");
      setRecognitionStatus("error");
      return;
    }

    setImageUrl(URL.createObjectURL(file));
    setRecognition(null);
    setRecognitionError("");
    setRecognitionStatus("loading");

    try {
      const result = await estimateApplianceFromPhoto(file);
      setRecognition(result);
      setName(result.name);
      setWatts(String(result.estimated_watt));
      setHours(String(Math.max(result.typical_duration_min / 60, 0.1)));
      setRecognitionStatus("idle");
    } catch (error) {
      setRecognitionError(error instanceof Error ? error.message : "Das Gerät konnte nicht erkannt werden.");
      setRecognitionStatus("error");
    }
  }

  /** Übernimmt die aktuelle Hochrechnung dauerhaft in die Verbrauchsdaten. */
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ id: id(), applianceName: name, powerWatts: Number(watts), hoursPerDay: Number(hours), daysPerWeek: Number(days), pricePerKwh: Number(price), annualConsumptionKwh: estimate.annualKwh, annualCostEur: estimate.cost, createdAt: new Date().toISOString() });
    setName(""); setSaved(true); window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={submit}>
      <FormIntro icon="device" title="Geräteverbrauch schätzen">Berechne den Jahresverbrauch eines Geräts anhand seiner typischen Nutzung.</FormIntro>
      <section className="device-recognition" aria-label="Gerät per Foto erkennen">
        <div className="device-recognition-copy">
          <span className="icon-tile"><Icon name="device" /></span>
          <div>
            <strong>Gerät automatisch erkennen</strong>
            <p>Fotografiere das Gerät oder wähle ein Bild aus. Leistung und typische Nutzungsdauer werden vom Backend geschätzt.</p>
          </div>
        </div>
        <div className="device-image-actions">
          <label className="image-action primary-image-action">
            <Icon name="device" size={17} /> Foto aufnehmen
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" onChange={(event) => { void recognizeImage(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <label className="image-action">
            <Icon name="upload" size={17} /> Bild auswählen
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { void recognizeImage(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
        </div>
        {recognitionStatus === "loading" && <p className="recognition-privacy"><Icon name="refresh" size={14} /> Bild wird analysiert …</p>}
        {recognitionStatus === "error" && <p className="form-error">{recognitionError}</p>}
        {recognition && (
          <div className="device-image-result">
            {imageUrl && <img src={imageUrl} alt="Zur Erkennung ausgewähltes Gerät" />}
            <div>
              <strong><Icon name="check" size={15} /> {recognition.name}</strong>
              <small>{recognition.estimated_watt} W · typische Laufzeit {recognition.typical_duration_min} Minuten<br />{recognition.note}</small>
              <em>Konfidenz: {recognition.confidence === "high" ? "hoch" : recognition.confidence === "medium" ? "mittel" : "niedrig"}</em>
            </div>
          </div>
        )}
        <p className="recognition-privacy"><Icon name="alert" size={13} /> Das Bild wird zur Analyse an das Backend übertragen; das Backend speichert nur die erkannten Gerätedaten.</p>
      </section>
      <div className="form-grid">
        <label className="wide">Gerät<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Fernseher, Waschmaschine" /></label>
        <label>Leistung<div className="input-unit"><input required min="1" step="1" type="number" value={watts} onChange={(e) => setWatts(e.target.value)} /><span>W</span></div></label>
        <label>Nutzung pro Tag<div className="input-unit"><input required min="0.1" max="24" step="0.1" type="number" value={hours} onChange={(e) => setHours(e.target.value)} /><span>Std.</span></div></label>
        <label>Tage pro Woche<input required min="1" max="7" step="1" type="number" value={days} onChange={(e) => setDays(e.target.value)} /></label>
        <label>Strompreis<div className="input-unit"><input required min="0" step="0.01" type="number" value={price} onChange={(e) => setPrice(e.target.value)} /><span>€/kWh</span></div></label>
      </div>
      <div className="estimate-result"><span>Geschätzter Jahresverbrauch<small>{number.format(estimate.annualKwh / 12)} kWh pro Monat</small></span><strong>{number.format(estimate.annualKwh)} kWh<small>{euro.format(estimate.cost)} pro Jahr</small></strong></div>
      <SubmitButton saved={saved} label="Schätzung übernehmen" />
    </form>
  );
}

/** Einheitlicher Speichern-Button mit kurzem Erfolgszustand. */
function SubmitButton({ saved, label }: { saved: boolean; label: string }) {
  return <button className={saved ? "primary-button saved" : "primary-button"} type="submit"><Icon name={saved ? "check" : "upload"} size={19} />{saved ? "Gespeichert" : label}</button>;
}

/** Führt alle erfassten Datentypen chronologisch in einem Verlauf zusammen. */
function History({ data, onRemove }: { data: ConsumptionData; onRemove: (kind: keyof ConsumptionData, id: string) => void }) {
  const rows = [
    ...data.meterReadings.map((item) => ({ id: item.id, createdAt: item.createdAt, kind: "meterReadings" as const, icon: "meter" as const, title: `${number.format(item.readingKwh)} kWh`, meta: `Zähler ${item.meterNumber} · ${new Date(item.readingDate).toLocaleDateString("de-DE")}` })),
    ...data.invoices.map((item) => ({ id: item.id, createdAt: item.createdAt, kind: "invoices" as const, icon: "invoice" as const, title: `${item.provider} · ${euro.format(item.totalAmountEur)}`, meta: `${number.format(item.consumptionKwh)} kWh${item.documentName ? ` · ${item.documentName}` : ""}` })),
    ...data.applianceEstimates.map((item) => ({ id: item.id, createdAt: item.createdAt, kind: "applianceEstimates" as const, icon: "device" as const, title: item.applianceName, meta: `${number.format(item.annualConsumptionKwh)} kWh/Jahr · ${euro.format(item.annualCostEur)}` })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="history-card">
      <div className="section-heading"><div><p className="eyebrow">Verlauf</p><h2>Zuletzt erfasst</h2></div><span>{rows.length} Einträge</span></div>
      {rows.length === 0 ? <div className="empty-state"><span className="icon-tile"><Icon name="meter" /></span><p>Deine ersten Verbrauchsdaten erscheinen hier.</p></div> :
        <div className="history-list">{rows.map((row) => <div className="history-row" key={`${row.kind}-${row.id}`}><span className="icon-tile"><Icon name={row.icon} /></span><span><strong>{row.title}</strong><small>{row.meta}</small></span><button type="button" className="icon-button" aria-label={`${row.title} löschen`} onClick={() => onRemove(row.kind, row.id)}><Icon name="trash" size={18} /></button></div>)}</div>}
    </section>
  );
}
