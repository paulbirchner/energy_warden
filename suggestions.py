import json
from datetime import datetime
from typing import Literal

import pydantic
from anthropic import AsyncAnthropic

from database import (
    get_prices,
    get_weather_data,
    get_appliances,
    clear_suggestions,
    insert_suggestions,
)


class Suggestion(pydantic.BaseModel):
    category: Literal["time_shift", "weather", "always_on"]
    appliance_id: int
    recommended_start: datetime
    recommended_end: datetime
    reasoning: str


class SuggestionList(pydantic.BaseModel):
    suggestions: list[Suggestion]


SYSTEM_PROMPT = """You are the suggestion engine for "Energy Warden", an advisory app \
for households on a dynamic (hourly) electricity tariff. Your job is to recommend WHEN \
to run household appliances today so the user saves money and/or uses self-produced solar power.

You are given, as JSON:
- "prices": hourly electricity prices for today (in EUR/MWh). Lower is cheaper.
- "weather": hourly solar data for today. "estimated_yield_kwh" is the expected PV output \
that hour; "irradiance_wm2" is the solar irradiance.
- "appliances": the household's appliances, each with an "id", power draw ("watt") and \
run length ("duration_min").

Produce a short list of concrete suggestions. Each suggestion picks ONE appliance (by its \
"id") and a recommended start/end time window today. Use these categories:

- "time_shift": move the appliance into the cheapest price window of the day. Use this for \
flexible loads where price is the main lever.
- "weather": align the run with the hours of highest solar yield ("estimated_yield_kwh"), so \
the appliance runs on self-produced power.
- "always_on": for high-power continuous loads (e.g. a heat pump), recommend running the \
heaviest usage during the cheapest hours.

Rules:
- Only use appliance ids from the provided list.
- recommended_start and recommended_end must be times today, in the same format as the "time" \
fields in the data, and at least "duration_min" minutes apart.
- In "reasoning", briefly justify the window in plain language (1-2 sentences), referencing the \
price or solar data.
- Do NOT compute or mention monetary savings — that is calculated separately in code.
- Prefer a handful of high-value suggestions over one per appliance."""


def _prices_for_prompt(prices):
    return [
        {
            "time": datetime.fromtimestamp(p["timestamp"]).isoformat(),
            "price_eur_mwh": p["price_eur_mwh"],
        }
        for p in prices
    ]


def _weather_for_prompt(weather):
    return [
        {
            "time": datetime.fromtimestamp(w["timestamp"]).isoformat(),
            "irradiance_wm2": w["irradiance_wm2"],
            "estimated_yield_kwh": w["estimated_yield_kwh"],
            "humidity": w["humidity"],
        }
        for w in weather
    ]


def _appliances_for_prompt(appliances):
    return [
        {
            "id": a["id"],
            "name": a["name"],
            "watt": a["watt"],
            "duration_min": a["duration_min"],
        }
        for a in appliances
    ]


def _compute_savings(suggestion, appliance, prices):
    """Savings = energy * price difference vs. the day's average price.

    Energy use is fixed regardless of *when* the appliance runs; the saving comes
    from running during cheaper-than-average hours. Prices are EUR/MWh, so we divide
    by 1000 to get EUR/kWh.
    """
    energy_kwh = (appliance["watt"] / 1000) * (appliance["duration_min"] / 60)

    day_avg = sum(p["price_eur_mwh"] for p in prices) / len(prices)

    start = suggestion.recommended_start.timestamp()
    end = suggestion.recommended_end.timestamp()

    # prices of the hours the window covers; fall back to the hour the start lands in
    window = [p["price_eur_mwh"] for p in prices if start <= p["timestamp"] < end]
    if not window:
        window = [
            p["price_eur_mwh"]
            for p in prices
            if p["timestamp"] <= start < p["timestamp"] + 3600
        ]
    window_avg = sum(window) / len(window) if window else day_avg

    savings = energy_kwh * (day_avg - window_avg) / 1000
    return round(savings, 4)


async def generate_suggestions():
    prices = [dict(r) for r in get_prices()]
    weather = [dict(r) for r in get_weather_data()]
    appliances = [dict(r) for r in get_appliances()]

    if not prices or not appliances:
        return SuggestionList(suggestions=[])

    user_content = json.dumps(
        {
            "prices": _prices_for_prompt(prices),
            "weather": _weather_for_prompt(weather),
            "appliances": _appliances_for_prompt(appliances),
        }
    )

    client = AsyncAnthropic()
    response = await client.messages.parse(
        model="claude-sonnet-4-6",
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
        output_format=SuggestionList,
    )
    parsed = response.parsed_output

    appliances_by_id = {a["id"]: a for a in appliances}

    rows = []
    for s in parsed.suggestions:
        appliance = appliances_by_id.get(s.appliance_id)
        if appliance is None:
            continue  # ignore ids the model invented
        savings = _compute_savings(s, appliance, prices)
        rows.append(
            (
                s.category,
                s.appliance_id,
                int(s.recommended_start.timestamp()),
                int(s.recommended_end.timestamp()),
                savings,
                s.reasoning,
            )
        )

    clear_suggestions()
    insert_suggestions(rows)
    return parsed