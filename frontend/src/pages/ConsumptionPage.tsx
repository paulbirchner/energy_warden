import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { estimateApplianceFromPhoto } from "../api/energyWardenApi";
import { Icon } from "../components/Icon";
import { useConsumptionData } from "../hooks/useConsumptionData";
import type { AppliancePhotoEstimate, ConsumptionData } from "../types/energyWarden";

type Tab = "meter" | "invoice" | "device";

const today = new Date().toISOString().slice(0, 10);
const euro = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

/** Erzeugt kollisionsarme IDs für lokal gespeicherte Einträge. */
function id() {
  return crypto.randomUUID();
}

/** Hauptseite für Zählerstände, Rechnungen und gerätebezogene Schätzungen. */
export default function ConsumptionPage() {
  const [tab, setTab] = useState<Tab>("device");
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
          <p className="eyebrow">Consumption data</p>
          <h1>Record consumption</h1>
          <p className="subtitle">The more accurate your data, the more useful your energy-saving tips will be.</p>
        </div>
        <span className="local-badge"><span /> Stored locally</span>
      </div>

      <div className="stats-grid" aria-label="Summary">
        <Stat label="Latest meter reading" value={latestReading ? `${number.format(latestReading.readingKwh)} kWh` : "Not recorded"} icon="meter" />
        <Stat label="Recorded invoices" value={String(store.data.invoices.length)} icon="invoice" />
        <Stat label="Appliance projection" value={`${number.format(totalEstimated)} kWh/year`} icon="device" />
      </div>

      <div className="workspace-card">
        <div className="tabs" role="tablist" aria-label="Consumption entry type">
          <TabButton active={tab === "device"} icon="device" label="Appliance estimate" onClick={() => setTab("device")} />
          <TabButton active={tab === "meter"} icon="meter" label="Meter reading" onClick={() => setTab("meter")} />
          <TabButton active={tab === "invoice"} icon="invoice" label="Invoice" onClick={() => setTab("invoice")} />
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
      <FormIntro icon="meter" title="Enter a meter reading">Enter the current reading from your electricity meter.</FormIntro>
      <div className="form-grid">
        <label>Meter number<input required value={form.meterNumber} onChange={(e) => setForm({ ...form, meterNumber: e.target.value })} placeholder="e.g. 1 EMH 001234" /></label>
        <label>Reading date<input required type="date" max={today} value={form.readingDate} onChange={(e) => setForm({ ...form, readingDate: e.target.value })} /></label>
        <label className="wide">Meter reading<div className="input-unit"><input required min="0" step="0.1" type="number" value={form.readingKwh} onChange={(e) => setForm({ ...form, readingKwh: e.target.value })} placeholder="12,450.8" /><span>kWh</span></div></label>
        <label className="wide">Note <small>(optional)</small><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. moving in or a regular reading" rows={3} /></label>
      </div>
      {invalidReading && <p className="form-error">The value is below the previous reading of {number.format(previous.readingKwh)} kWh. Please check your entry.</p>}
      <SubmitButton saved={saved} label="Save meter reading" />
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
    if (!allowed.includes(selected.type)) return setFileError("Please use a PDF, JPG or PNG file.");
    if (selected.size > 10 * 1024 * 1024) return setFileError("The file must not exceed 10 MB.");
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
      <FormIntro icon="invoice" title="Record invoice data">Enter the key figures or attach your invoice directly.</FormIntro>
      <div className="form-grid">
        <label className="wide">Energy supplier<input required value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Name of your energy supplier" /></label>
        <label>Billing period start<input required type="date" max={today} value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Billing period end<input required type="date" max={today} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <label>Consumption<div className="input-unit"><input required min="0" step="0.1" type="number" value={consumption} onChange={(e) => setConsumption(e.target.value)} /><span>kWh</span></div></label>
        <label>Invoice amount<div className="input-unit"><input required min="0" step="0.01" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /><span>€</span></div></label>
      </div>
      {start && end && start > end && <p className="form-error">The end date must be after the start date.</p>}
      <label className="upload-zone">
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => chooseFile(e.target.files?.[0])} />
        <Icon name="upload" size={26} />
        <span><strong>{file ? file.name : "Add invoice"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB selected` : "PDF, JPG or PNG · maximum 10 MB"}</small></span>
      </label>
      {fileError && <p className="form-error">{fileError}</p>}
      <SubmitButton saved={saved} label="Save invoice" />
    </form>
  );
}

/** Zeigt den Live-Kamerastream und erzeugt daraus ein komprimiertes JPEG-Einzelbild. */
function CameraCapture({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("The camera is unavailable here. Open the app over HTTPS or localhost and check the browser permission.");
        setStatus("error");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("ready");
      } catch (cameraError) {
        const name = cameraError instanceof DOMException ? cameraError.name : "";
        const message = name === "NotAllowedError"
          ? "Camera access was not allowed. Enable it in your browser settings and try again."
          : name === "NotFoundError"
            ? "No camera was found."
            : name === "NotReadableError"
              ? "The camera is already being used by another application."
              : "The camera could not be started. Check the browser permission and try again.";
        if (!cancelled) {
          setError(message);
          setStatus("error");
        }
      }
    }

    void startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;

    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("The photo could not be created. Please try again.");
        setStatus("error");
        return;
      }
      onCapture(new File([blob], `appliance-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    }, "image/jpeg", 0.85);
  }

  return (
    <div className="camera-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="camera-modal" role="dialog" aria-modal="true" aria-labelledby="camera-title">
        <div className="camera-heading">
          <div><p className="eyebrow">Live camera</p><h2 id="camera-title">Photograph an appliance</h2></div>
          <button className="camera-close" type="button" aria-label="Close camera" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        <div className="camera-preview">
          <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
          {status === "starting" && <span><Icon name="refresh" size={20} /> Starting camera…</span>}
        </div>
        {status === "error" && <p className="form-error camera-error"><Icon name="alert" size={16} /> {error}</p>}
        <p className="camera-hint">Point the camera at the appliance and make sure there is enough light.</p>
        <div className="camera-actions">
          <button className="camera-cancel" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button camera-shutter" type="button" disabled={status !== "ready"} onClick={takePhoto}>
            <Icon name="camera" size={18} /> Take photo
          </button>
        </div>
      </section>
    </div>
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
  const [cameraOpen, setCameraOpen] = useState(false);
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
      setRecognitionError("Please use a JPG, PNG, WEBP or GIF image.");
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
      setRecognitionError(error instanceof Error ? error.message : "The appliance could not be identified.");
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
      <FormIntro icon="device" title="Estimate appliance consumption">Calculate an appliance's annual consumption based on typical usage.</FormIntro>
      <section className="device-recognition" aria-label="Identify appliance from a photo">
        <div className="device-recognition-copy">
          <span className="icon-tile"><Icon name="device" /></span>
          <div>
            <strong>Identify appliance automatically</strong>
            <p>Photograph the appliance or select an image. The backend estimates its power and typical usage time.</p>
          </div>
        </div>
        <div className="device-image-actions">
          <button className="image-action primary-image-action" type="button" onClick={() => setCameraOpen(true)}>
            <Icon name="camera" size={17} /> Take photo
          </button>
          <label className="image-action">
            <Icon name="upload" size={17} /> Select image
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { void recognizeImage(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
        </div>
        {recognitionStatus === "loading" && <p className="recognition-privacy"><Icon name="refresh" size={14} /> Analysing image…</p>}
        {recognitionStatus === "error" && <p className="form-error">{recognitionError}</p>}
        {recognition && (
          <div className="device-image-result">
            {imageUrl && <img src={imageUrl} alt="Appliance selected for identification" />}
            <div>
              <strong><Icon name="check" size={15} /> {recognition.name}</strong>
              <small>{recognition.estimated_watt} W · typical runtime {recognition.typical_duration_min} minutes<br />{recognition.note}</small>
              <em>Confidence: {recognition.confidence}</em>
            </div>
          </div>
        )}
        <p className="recognition-privacy"><Icon name="alert" size={13} /> The image is sent to the backend for analysis; the backend stores only the identified appliance data.</p>
      </section>
      {cameraOpen && <CameraCapture onClose={() => setCameraOpen(false)} onCapture={(file) => { setCameraOpen(false); void recognizeImage(file); }} />}
      <div className="form-grid">
        <label className="wide">Appliance<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. television, washing machine" /></label>
        <label>Power<div className="input-unit"><input required min="1" step="1" type="number" value={watts} onChange={(e) => setWatts(e.target.value)} /><span>W</span></div></label>
        <label>Usage per day<div className="input-unit"><input required min="0.1" max="24" step="0.1" type="number" value={hours} onChange={(e) => setHours(e.target.value)} /><span>hrs</span></div></label>
        <label>Days per week<input required min="1" max="7" step="1" type="number" value={days} onChange={(e) => setDays(e.target.value)} /></label>
        <label>Electricity price<div className="input-unit"><input required min="0" step="0.01" type="number" value={price} onChange={(e) => setPrice(e.target.value)} /><span>€/kWh</span></div></label>
      </div>
      <div className="estimate-result"><span>Estimated annual consumption<small>{number.format(estimate.annualKwh / 12)} kWh per month</small></span><strong>{number.format(estimate.annualKwh)} kWh<small>{euro.format(estimate.cost)} per year</small></strong></div>
      <SubmitButton saved={saved} label="Apply estimate" />
    </form>
  );
}

/** Einheitlicher Speichern-Button mit kurzem Erfolgszustand. */
function SubmitButton({ saved, label }: { saved: boolean; label: string }) {
  return <button className={saved ? "primary-button saved" : "primary-button"} type="submit"><Icon name={saved ? "check" : "upload"} size={19} />{saved ? "Saved" : label}</button>;
}

/** Führt alle erfassten Datentypen chronologisch in einem Verlauf zusammen. */
function History({ data, onRemove }: { data: ConsumptionData; onRemove: (kind: keyof ConsumptionData, id: string) => void }) {
  const rows = [
    ...data.meterReadings.map((item) => ({ id: item.id, createdAt: item.createdAt, kind: "meterReadings" as const, icon: "meter" as const, title: `${number.format(item.readingKwh)} kWh`, meta: `Meter ${item.meterNumber} · ${new Date(item.readingDate).toLocaleDateString("en-GB")}` })),
    ...data.invoices.map((item) => ({ id: item.id, createdAt: item.createdAt, kind: "invoices" as const, icon: "invoice" as const, title: `${item.provider} · ${euro.format(item.totalAmountEur)}`, meta: `${number.format(item.consumptionKwh)} kWh${item.documentName ? ` · ${item.documentName}` : ""}` })),
    ...data.applianceEstimates.map((item) => ({ id: item.id, createdAt: item.createdAt, kind: "applianceEstimates" as const, icon: "device" as const, title: item.applianceName, meta: `${number.format(item.annualConsumptionKwh)} kWh/year · ${euro.format(item.annualCostEur)}` })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="history-card">
      <div className="section-heading"><div><p className="eyebrow">History</p><h2>Recently recorded</h2></div><span>{rows.length} entries</span></div>
      {rows.length === 0 ? <div className="empty-state"><span className="icon-tile"><Icon name="meter" /></span><p>Your first consumption data will appear here.</p></div> :
        <div className="history-list">{rows.map((row) => <div className="history-row" key={`${row.kind}-${row.id}`}><span className="icon-tile"><Icon name={row.icon} /></span><span><strong>{row.title}</strong><small>{row.meta}</small></span><button type="button" className="icon-button" aria-label={`Delete ${row.title}`} onClick={() => onRemove(row.kind, row.id)}><Icon name="trash" size={18} /></button></div>)}</div>}
    </section>
  );
}
