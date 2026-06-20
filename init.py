"""One-shot setup so the app has data to test against.

Creates/seeds the DB, fetches today's prices + weather, and (optionally) generates
the AI suggestions. Run once before starting the server / the demo:

    source .venv/bin/activate
    python init.py            # DB + sync only (no paid API call)
    python init.py --suggest  # additionally generate suggestions (calls Anthropic, costs money)
"""

import asyncio
import sys

from dotenv import load_dotenv

load_dotenv()

from database import (
    init_db,
    get_prices,
    get_weather_data,
    get_appliances,
    get_suggestions,
)
from sync import sync_prices, sync_weather
from suggestions import generate_suggestions


async def main(with_suggestions: bool):
    print("→ init_db() ...")
    init_db()
    print(f"  {len(get_appliances())} appliances seeded")

    print("→ sync_prices() ...")
    await sync_prices()
    print(f"  {len(get_prices())} price rows for today")

    print("→ sync_weather() ...")
    await sync_weather()
    print(f"  {len(get_weather_data())} weather rows for today")

    if with_suggestions:
        print("→ generate_suggestions()  (Anthropic call) ...")
        await generate_suggestions()
        print(f"  {len(get_suggestions())} suggestions written")
    else:
        print("→ skipping suggestions (pass --suggest to generate them)")

    print("done. start the server with: uvicorn main:app --reload")


if __name__ == "__main__":
    asyncio.run(main(with_suggestions="--suggest" in sys.argv))