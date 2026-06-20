# energy_warden

PoC-Backend für eine Beratungs-Web-App für Nutzer dynamischer Stromtarife.
Zeigt Echtzeit-Strompreise und gibt KI-gestützte Empfehlungen, wann Geräte
laufen sollten. Keine Hardware, kein Auth — ein fest hinterlegter Demo-Nutzer.

Uni-Projekt (OTH Regensburg).

## Setup

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

`.env` mit `ANTHROPIC_API_KEY=...` anlegen.

## Starten

```bash
uvicorn main:app --reload
```

Läuft auf `http://127.0.0.1:8000`. Interaktive Doku: `http://127.0.0.1:8000/docs`.

Preis- und Wetterdaten werden **nicht** automatisch geholt — `sync_prices()`
und `sync_weather()` aus `sync.py` müssen vor der Demo einmal manuell laufen.

## API

Zeitstempel sind überall **Unix-Sekunden**. Die Börsenpreise stammen aus der
deutschen aWATTar-API und werden in **€/MWh** gespeichert
(ct/kWh = Wert / 10). Netzentgelte, Steuern, Abgaben, Vertriebskosten und
Grundpreise sind darin nicht enthalten.

Das Frontend zeigt zusätzlich einen **geschätzten variablen Haushaltsstrompreis**:
Börsenpreis plus pauschal 20 ct/kWh für Netzentgelte, Steuern, Abgaben und
Vertrieb. Der Zuschlag lässt sich beim Frontend-Start über
`VITE_PRICE_SURCHARGE_CENT_KWH` an den eigenen dynamischen Tarif anpassen. Ein
monatlicher Grundpreis bleibt außerhalb dieser Schätzung.

Im Tarifvergleich simuliert das Frontend außerdem einen repräsentativen Tag.
Dafür kombiniert es den hochgerechneten Jahresverbrauch mit einem synthetischen
Stundenprofil, den heutigen Preisen und flexibel verschiebbaren Geräten. Der
dynamische Grundpreis ist über `VITE_DYNAMIC_BASE_PRICE_MONTHLY` konfigurierbar
(Standard: 9,90 Euro/Monat). Fehlende Preisstunden werden für den PoC sichtbar
gekennzeichnet und mit dem Mittelwert der vorhandenen Stunden ergänzt.

### `GET /health`

Health-Check.

**200 OK**
```json
{ "status": "ok" }
```

### `GET /prices`

Alle Preis-Datensätze von heute (lokale Mitternacht bis zur nächsten
Mitternacht), ein Eintrag pro Stunde.

**200 OK**
```json
[
  {
    "id": 1,
    "timestamp": 1749340800,
    "price_eur_mwh": 84.95,
    "source": "awattar"
  }
]
```

### `GET /prices/current`

Preis für die aktuelle Stunde.

**200 OK**
```json
84.95
```

Gibt den reinen `price_eur_mwh`-Wert zurück (Zahl, kein Objekt).

### `POST /suggestions/generate`

Erzeugt die KI-Empfehlungen neu: liest die heutigen Preise + Wetterdaten,
fragt das Sprachmodell nach sinnvollen Laufzeit-Fenstern, berechnet die
Ersparnis im Code und schreibt das Ergebnis in die DB (alte Vorschläge werden
vorher gelöscht). Gibt die frisch erzeugten Vorschläge zurück — gleiche Form
wie `GET /suggestions`.

Benötigt befüllte Preis-/Wetterdaten (`sync.py`) und den `ANTHROPIC_API_KEY`.
Macht einen echten, kostenpflichtigen Modell-Aufruf. Bei leerer Datenlage wird
`[]` zurückgegeben.

Kein Request-Body.

### `GET /suggestions`

Die zuletzt erzeugten Empfehlungen aus der DB (löst `appliance_id` per JOIN auf
den Gerätenamen auf). Liest nur — erzeugt nichts neu.

`category` ist einer von `time_shift`, `weather`, `always_on`.
`recommended_start` / `recommended_end` sind Unix-Sekunden, `savings_eur` wird
im Code berechnet (nicht vom Modell).

**200 OK**
```json
[
  {
    "id": 1,
    "category": "time_shift",
    "appliance_id": 3,
    "recommended_start": 1780916400,
    "recommended_end": 1780930800,
    "savings_eur": 0.1759,
    "reasoning": "The EV Charger needs 4 consecutive hours and the cheapest window today spans 11:00–15:00 ...",
    "created_at": 1780900000,
    "appliance_name": "EV Charger"
  }
]
```

### `GET /appliances`

Alle Geräte des Demo-Haushalts.

**200 OK**
```json
[
  { "id": 1, "name": "Washing machine", "room_id": 3, "watt": 2000, "duration_min": 90 }
]
```

### `POST /appliances/estimate-from-photo`

Schätzt aus einem Foto, um welches Gerät es sich handelt und wie sein
Stromprofil aussieht (Sprachmodell mit Bilderkennung), **speichert das Gerät in
die `appliances`-Tabelle** und gibt die Schätzung samt neuer `id` zurück. Das
gespeicherte Gerät fließt beim nächsten `POST /suggestions/generate`
automatisch in die Empfehlungen ein.

Request: `multipart/form-data` mit dem Feld `image` (JPG, PNG, WEBP oder GIF).
Macht einen echten, kostenpflichtigen Modell-Aufruf, benötigt den
`ANTHROPIC_API_KEY`.

```bash
curl -X POST http://127.0.0.1:8000/appliances/estimate-from-photo \
  -F "image=@waschmaschine.jpg"
```

**200 OK**
```json
{
  "id": 6,
  "name": "Washing machine",
  "estimated_watt": 2000,
  "typical_duration_min": 90,
  "confidence": "high",
  "note": "Front-loading washing machine erkannt; Leistung je nach Programm."
}
```

`confidence` ist einer von `low`, `medium`, `high`. Bei ungültigem Dateityp
oder leerer Datei kommt `400`.

### `POST /recommendations/personalized`

Erstellt per KI eine qualitative, priorisierte Beratung aus dem vom Frontend
reduzierten Haushaltsprofil. Übertragen werden Verbrauchswerte, Rechnungs-
summen, Geräteschätzungen, Tarife und bereits im Code berechnete Maßnahmen –
keine Zählernummern, Notizen oder Dokumente. Die Antwort enthält eine persönliche
Einordnung sowie drei bis fünf Empfehlungen mit Begründung und konkreten
Schritten.

Der Aufruf benötigt `ANTHROPIC_API_KEY` in `.env` und ist kostenpflichtig. Als
Vorlage kann `.env.example` nach `.env` kopiert und anschließend der Schlüssel
eingetragen werden.
Copy-Item .env.example .env

```json
{
  "appliances": [
    {
      "applianceName": "Wärmepumpe",
      "powerWatts": 2800,
      "hoursPerDay": 2,
      "daysPerWeek": 7,
      "annualConsumptionKwh": 2038.4,
      "annualCostEur": 733.82
    }
  ]
}
```
