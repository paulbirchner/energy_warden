from datetime import date, datetime, timedelta
import httpx

from database import insert_prices, insert_weather_data

PANEL_KWP = 5.0
PANEL_EFFICIENCY = 0.8

async def sync_prices():
    rows = []
    day_start = datetime.combine(date.today(), datetime.min.time())
    day_end = day_start + timedelta(days=1)
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://api.awattar.de/v1/marketdata",
            params={
                "start": int(day_start.timestamp() * 1000),
                "end": int(day_end.timestamp() * 1000),
            },
        )
        response.raise_for_status()
        data = response.json()

        for entry in data["data"]:
            timestamp = entry["start_timestamp"] // 1000
            # aWATTar liefert den deutschen Day-Ahead-Marktpreis bereits in EUR/MWh.
            price_eur_mwh = entry["marketprice"]
            rows.append((timestamp, price_eur_mwh))

        insert_prices(rows)

async def sync_weather():
    rows = []
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get("""https://api.open-meteo.com/v1/forecast?latitude=48.57&longitude=12.15&hourly=direct_radiation,global_tilted_irradiance_instant,cloud_cover,relative_humidity_2m&forecast_days=2""")
        response.raise_for_status()
        data = response.json()
        combined_data = zip(data["hourly"]["time"], data["hourly"]["global_tilted_irradiance_instant"], data["hourly"]["relative_humidity_2m"])

        for time, irradiance, humidity in combined_data:
            timestamp = int(datetime.fromisoformat(time).timestamp())
            estimated_yield_kwh = (irradiance / 1000) * float(PANEL_KWP) * float(PANEL_EFFICIENCY)
            rows.append((timestamp, irradiance, estimated_yield_kwh, humidity))

        insert_weather_data(rows)
