# Energy Warden – Frontend

Das Energy-Warden-Frontend ist eine Beratungs-Webanwendung zur Erfassung und
Auswertung von Energieverbrauch. Es unterstützt unter anderem Zählerstände,
Rechnungen, Geräteschätzungen, Tarife, Analysen, Empfehlungen,
Benachrichtigungen und Monatsberichte.

Das Frontend wurde mit React, TypeScript und Vite umgesetzt. Die meisten
Funktionen arbeiten aktuell vollständig im Browser und speichern ihre Daten im
`localStorage`. Für Live-Strompreise und die älteren KI-Empfehlungen kann das
vorhandene Backend optional gestartet werden.

## Voraussetzungen

Für die lokale Entwicklung werden benötigt:

- [Node.js](https://nodejs.org/) `20.19` oder neuer beziehungsweise `22.12` oder neuer
- npm (wird zusammen mit Node.js installiert)
- ein moderner Browser, beispielsweise Chrome, Edge oder Firefox
- optional: Git zum Klonen des Projekts

Die installierten Versionen lassen sich im Terminal prüfen:

```bash
node --version
npm --version
```

## Installation

### 1. Projekt öffnen

Das Repository klonen oder den vorhandenen Projektordner in VS Code öffnen:

```bash
git clone <repository-url>
cd energy_warden/frontend
```

Wenn das Repository bereits lokal vorhanden ist, reicht der Wechsel in den
Frontend-Ordner:

```powershell
cd C:\Pfad\zum\Projekt\energy_warden\frontend
```

### 2. Abhängigkeiten installieren

Für eine reproduzierbare Installation anhand der `package-lock.json`:

```bash
npm ci
```

Alternativ können die Abhängigkeiten mit folgendem Befehl installiert werden:

```bash
npm install
```

Unter Windows PowerShell kann die Ausführung von `npm.ps1` durch die lokale
Execution Policy blockiert sein. In diesem Fall `npm.cmd` verwenden:

```powershell
npm.cmd ci
```

### 3. Entwicklungsserver starten

```bash
npm run dev
```

Unter Windows PowerShell gegebenenfalls:

```powershell
npm.cmd run dev
```

Vite zeigt anschließend die lokale Adresse im Terminal an. Standardmäßig ist
die Anwendung hier erreichbar:

```text
http://localhost:5173
```

Änderungen am Quellcode werden während der Entwicklung automatisch im Browser
aktualisiert.

## Optional: Backend starten

Das Frontend ist auch ohne Backend bedienbar. Ohne Backend sind lediglich
API-basierte Funktionen wie der Live-Strompreis nicht verfügbar.

Das vorhandene Python-Backend kann aus dem Projektstamm in einem zweiten
Terminal gestartet werden:

```powershell
cd C:\Pfad\zum\Projekt\energy_warden
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Das Backend läuft anschließend standardmäßig unter:

```text
http://127.0.0.1:8000
```

Diese Adresse ist derzeit in `src/api/energyWardenApi.ts` als
`API_BASE_URL` hinterlegt.

## Verfügbare npm-Befehle

| Befehl | Beschreibung |
| --- | --- |
| `npm run dev` | Startet den Vite-Entwicklungsserver mit Hot Reload. |
| `npm run build` | Prüft TypeScript und erstellt den Produktions-Build. |
| `npm run lint` | Prüft den Quellcode mit ESLint. |
| `npm run preview` | Zeigt den zuvor erzeugten Produktions-Build lokal an. |

Unter Windows können alle Befehle bei Bedarf mit `npm.cmd` statt `npm`
ausgeführt werden.

## Produktions-Build testen

```bash
npm run build
npm run preview
```

Der Build wird im Ordner `dist/` erzeugt. Vite zeigt beim Start von `preview`
die lokale Vorschauadresse im Terminal an.

## Funktionsbereiche

- **Dashboard:** Verbrauch, Kosten, Strompreis, Hotspots und Einsparfortschritt
- **Verbrauch:** Zählerstände, Rechnungen, Dokumentmetadaten und Geräteschätzungen
- **Tarife & Kosten:** Strom-/Wassertarife, Kostenberechnung und Tarifvergleich
- **Analyse:** Monatsentwicklung, Haushaltsvergleich, Auffälligkeiten und Prognosen
- **Empfehlungen:** personalisierte Maßnahmen mit berechnetem Einsparpotenzial
- **Hinweise:** Erinnerungen, Verbrauchswarnungen und Browser-Benachrichtigungen
- **Berichte:** Monatsberichte, CSV-Export und PDF-Ausgabe über den Druckdialog

## Lokale Datenspeicherung

Bis zur Anbindung der entsprechenden Backend-Endpunkte werden Fachdaten im
`localStorage` des Browsers gespeichert. Dadurch bleiben Eingaben nach einem
Neuladen der Seite erhalten, gelten aber nur für den jeweiligen Browser und die
verwendete lokale Adresse.

Folgende Daten werden lokal gespeichert:

- Verbrauchsdaten und Zählerstände
- Rechnungswerte und Dateimetadaten
- Geräteschätzungen
- Strom- und Wassertarife
- Benachrichtigungseinstellungen
- Bearbeitungsstand von Empfehlungen

Bei Rechnungsuploads werden aktuell nur Dateiname und Dateigröße gespeichert.
Die eigentliche Datei wird noch nicht übertragen oder dauerhaft abgelegt.

Zum Zurücksetzen der lokalen Daten kann im Browser unter den Entwicklertools
der Anwendungsspeicher für `http://localhost:5173` gelöscht werden.

## Browser-Benachrichtigungen

Browser-Benachrichtigungen müssen ausdrücklich freigegeben werden. Ohne
Push-Backend werden Hinweise nur erzeugt, solange Energy Warden im Browser
geöffnet ist. Auf `localhost` werden Benachrichtigungen von den gängigen
Browsern als sicherer Entwicklungskontext unterstützt.

## Projektstruktur

```text
frontend/
├── public/                 Statische Dateien
├── src/
│   ├── api/                Kommunikation mit dem vorhandenen Backend
│   ├── components/         Wiederverwendbare UI-Komponenten
│   ├── hooks/              Lokaler Zustand und localStorage-Persistenz
│   ├── pages/              Funktionsseiten der Anwendung
│   ├── types/              Gemeinsame TypeScript-Datenmodelle
│   ├── utils/              Analyse-, Empfehlungs- und Berichtslogik
│   ├── App.tsx             Navigation und Seitenauswahl
│   ├── App.css             Komponenten- und Seitenstyles
│   └── main.tsx            React-Einstiegspunkt
├── package.json            Abhängigkeiten und npm-Skripte
└── vite.config.ts          Vite-Konfiguration
```

## Fehlerbehebung

### `npm.ps1` kann nicht ausgeführt werden

PowerShell blockiert das npm-Skript. Ohne Änderung der Execution Policy kann
direkt die Windows-CLI verwendet werden:

```powershell
npm.cmd run dev
```

### Live-Strompreis ist nicht erreichbar

Prüfen, ob das Backend unter `http://127.0.0.1:8000` läuft. Die übrigen lokalen
Frontend-Funktionen können trotzdem weiterverwendet werden.

### Port 5173 ist bereits belegt

Vite wählt normalerweise automatisch einen anderen freien Port. Die tatsächlich
verwendete Adresse steht im Terminal.

### Installation verhält sich unerwartet

Zunächst die Node.js-Version prüfen und anschließend die Abhängigkeiten anhand
der Lockdatei erneut installieren:

```bash
npm ci
npm run build
```
