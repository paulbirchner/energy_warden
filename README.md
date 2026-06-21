# Energy Warden

Energy Warden ist eine Beratungs-Web-App für Haushalte mit dynamischem Stromtarif. Die App zeigt stündliche Börsenstrompreise, verwaltet Verbrauchs- und Tarifdaten und erstellt auf Wunsch KI-gestützte Empfehlungen. Das Projekt besteht aus einem FastAPI-Backend, einem React-/Vite-Frontend und einer lokalen SQLite-Datenbank.

## Voraussetzungen

Für den vollständigen Betrieb werden benötigt:

- Python 3.11 oder neuer
- Node.js `^20.19.0` oder `>=22.12.0` inklusive npm
- ein aktueller Browser
- Internetzugang für aWATTar, Open-Meteo und die optionalen KI-Funktionen
- ein Anthropic-API-Key für KI-Empfehlungen und Geräteerkennung per Foto

SQLite ist in Python enthalten und muss nicht separat installiert werden.

### Abhängigkeiten

Die exakten Versionen stehen in den jeweiligen Paketdateien:

- Backend: [requirements.txt](requirements.txt) – unter anderem FastAPI, Uvicorn, HTTPX, Anthropic, Pydantic, python-dotenv und python-multipart
- Frontend: [frontend/package.json](frontend/package.json) und [frontend/package-lock.json](frontend/package-lock.json) – React, React DOM, Vite, TypeScript und ESLint
- Externe Dienste: [aWATTar](https://api.awattar.de/) für Strompreise, [Open-Meteo](https://open-meteo.com/) für Wetter-/PV-Daten und optional die Anthropic API für KI-Funktionen

aWATTar und Open-Meteo benötigen für die verwendeten Endpunkte keinen API-Key.

## Installation unter Windows

Alle Backend-Befehle sollten im Projektordner ausgeführt werden, da dort auch `database.db` angelegt und gelesen wird.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

Copy-Item .env.example .env

Set-Location frontend
npm.cmd ci
Set-Location ..
```

`npm.cmd` umgeht den häufigen PowerShell-Fehler, bei dem die Ausführung von `npm.ps1` deaktiviert ist. In einer Shell ohne dieses Problem kann stattdessen `npm` verwendet werden.

### macOS/Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
cd frontend
npm ci
cd ..
```

## Konfiguration

In der `.env` im Projektordner kann der Anthropic-API-Key hinterlegt werden:

```dotenv
ANTHROPIC_API_KEY=dein_api_key
```

Ohne API-Key funktionieren Dashboard, lokale Dateneingabe, Tarifberechnungen sowie Preis- und Wetterabruf weiterhin. Folgende Funktionen benötigen den Key und verursachen externe API-Kosten:

- KI-Vorschläge über `POST /suggestions/generate`
- personalisierte Empfehlungen
- Geräteerkennung per Foto

Optionale Frontend-Einstellungen können in `frontend/.env.local` gesetzt werden:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_PRICE_SURCHARGE_CENT_KWH=20
VITE_DYNAMIC_BASE_PRICE_MONTHLY=9.90
```

Nach Änderungen an Vite-Variablen muss der Frontend-Entwicklungsserver neu gestartet werden.

## Preisdaten und Datenbank initialisieren

Vor dem ersten Start und danach an jedem neuen Kalendertag müssen die aktuellen Daten synchronisiert werden:

```powershell
.\.venv\Scripts\python.exe .\init.py
```

Der Befehl:

- erstellt bei Bedarf `database.db` und die Tabellen,
- legt die Demo-Geräte an,
- lädt die heutigen Preise von aWATTar,
- lädt Wetter-/PV-Prognosen von Open-Meteo.

Die Daten werden derzeit **nicht automatisch beim Start oder täglich aktualisiert**. Sind nur Daten eines vergangenen Tages vorhanden, liefert `/prices/current` keine passende Zeile. Der typische Fehler ist dann:

```text
TypeError: 'NoneType' object is not subscriptable
```

In diesem Fall `init.py` erneut ausführen. Für die einmalige Synchronisierung inklusive kostenpflichtiger KI-Vorschläge kann Folgendes verwendet werden:

```powershell
.\.venv\Scripts\python.exe .\init.py --suggest
```

Der gespeicherte aWATTar-Wert ist der reine Börsenpreis in EUR/MWh. Das Frontend rechnet ihn in ct/kWh um und addiert standardmäßig einen geschätzten Aufschlag von 20 ct/kWh. Netzentgelte, Steuern, Abgaben und Vertriebskosten sind dadurch nur angenähert; der monatliche Grundpreis wird separat berücksichtigt.

## Anwendung starten

Backend und Frontend laufen in zwei Terminals.

Terminal 1 – Backend aus dem Projektordner:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Terminal 2 – Frontend:

```powershell
Set-Location frontend
npm.cmd run dev
```

Anschließend öffnen:

- Webseite: <http://127.0.0.1:5173>
- Backend: <http://127.0.0.1:8000>
- interaktive API-Dokumentation: <http://127.0.0.1:8000/docs>
- Health-Check: <http://127.0.0.1:8000/health>

## Wichtige Hinweise

- Das Backend erlaubt Browserzugriffe standardmäßig nur von `localhost:5173` und `127.0.0.1:5173`. Bei einem anderen Frontend-Port muss die CORS-Liste in `main.py` angepasst werden.
- Verbrauchs-, Tarif-, Benachrichtigungs- und Demo-Daten werden größtenteils im `localStorage` des Browsers gespeichert. Das Löschen der Browserdaten entfernt diese Eingaben.
- Geräte, Preis-, Wetter- und generierte Vorschlagsdaten liegen in der lokalen `database.db`.
- Für Kameraaufnahmen muss der Browser den Kamerazugriff erlauben. Lokal funktioniert dies üblicherweise über `localhost`; in einer Bereitstellung ist HTTPS erforderlich.
- Unix-Zeitstempel werden in Sekunden gespeichert und anhand der lokalen Systemzeitzone ausgewertet. Eine falsche Systemzeit oder Zeitzone kann zu fehlenden aktuellen Preisen führen.

## API-Überblick

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/health` | Backend-Verfügbarkeit prüfen |
| `GET` | `/prices` | heutige stündliche Strompreise abrufen |
| `GET` | `/prices/current` | Börsenpreis der aktuellen Stunde abrufen |
| `GET` | `/appliances` | gespeicherte Geräte abrufen |
| `POST` | `/appliances/estimate-from-photo` | Gerät per KI erkennen und speichern |
| `GET` | `/suggestions` | gespeicherte Vorschläge abrufen |
| `POST` | `/suggestions/generate` | neue KI-Vorschläge erzeugen |
| `POST` | `/recommendations/personalized` | personalisierte KI-Beratung erzeugen |

## Fehlerbehebung

- **`NoneType` bei `/prices/current`:** `init.py` für den aktuellen Tag ausführen.
- **Frontend meldet, das Backend sei nicht erreichbar:** prüfen, ob Uvicorn auf Port 8000 läuft und `VITE_API_BASE_URL` korrekt ist.
- **CORS-Fehler im Browser:** Frontend über Port 5173 starten oder die erlaubten Ursprünge in `main.py` ergänzen.
- **`npm.ps1 cannot be loaded`:** `npm.cmd ci` beziehungsweise `npm.cmd run dev` verwenden.
- **KI-Endpunkt antwortet mit 503:** `ANTHROPIC_API_KEY` prüfen, Backend nach einer `.env`-Änderung neu starten und Internetverbindung kontrollieren.
- **Leere Preis- oder Wetterdaten:** Internetverbindung und Erreichbarkeit von aWATTar/Open-Meteo prüfen, danach `init.py` erneut starten.

## Produktions-Build des Frontends

```powershell
Set-Location frontend
npm.cmd run build
npm.cmd run preview
```

Der Build wird in `frontend/dist` erzeugt. Das FastAPI-Backend liefert diesen Ordner nicht selbst aus; für eine echte Bereitstellung wird zusätzlich ein Webserver oder Hosting-Dienst für das Frontend benötigt.
