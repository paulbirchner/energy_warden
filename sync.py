from datetime import datetime
import httpx

from database import insert_prices, insert_weather_data

PANEL_KWP = 5.0
PANEL_EFFICIENCY = 0.8

async def sync_prices():
    rows = []
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.awattar.at/v1/marketdata")
        data = response.json()


        for entry in data["data"]:
            timestamp = entry["start_timestamp"] // 1000
            price_eur_mwh = entry["marketprice"] / 10
            rows.append((timestamp, price_eur_mwh))

        insert_prices(rows)

async def sync_weather():
    rows = []
    async with httpx.AsyncClient() as client:
        response = await client.get("""https://api.open-meteo.com/v1/forecast?latitude=48.57&longitude=12.15&hourly=direct_radiation,global_tilted_irradiance_instant,cloud_cover,relative_humidity_2m&forecast_days=2""")
        data = response.json()
        combined_data = zip(data["hourly"]["time"], data["hourly"]["global_tilted_irradiance_instant"], data["hourly"]["relative_humidity_2m"])

        for time, irradiance, humidity in combined_data:
            timestamp = int(datetime.fromisoformat(time).timestamp())
            estimated_yield_kwh = (irradiance / 1000) * float(PANEL_KWP) * float(PANEL_EFFICIENCY)
            rows.append((timestamp, irradiance, estimated_yield_kwh, humidity))

        insert_weather_data(rows)