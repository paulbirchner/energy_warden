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

Zeitstempel sind überall **Unix-Sekunden**. Preise sind in **€/MWh**
(€/kWh = Wert / 1000).

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