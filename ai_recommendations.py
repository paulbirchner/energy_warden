"""Personalized AI recommendations based on the browser's summarized energy profile."""

import json
import os
from typing import Literal

import pydantic
from anthropic import AsyncAnthropic

from database import get_prices, get_weather_data


class AiConfigurationError(RuntimeError):
    """Raised when the external AI service cannot be configured locally."""


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class MeterReadingProfile(ApiModel):
    reading_date: str
    reading_kwh: float = pydantic.Field(ge=0)


class InvoiceProfile(ApiModel):
    billing_start: str
    billing_end: str
    consumption_kwh: float = pydantic.Field(ge=0)
    total_amount_eur: float = pydantic.Field(ge=0)


class ApplianceProfile(ApiModel):
    appliance_name: str = pydantic.Field(min_length=1, max_length=120)
    power_watts: float = pydantic.Field(ge=0, le=100_000)
    hours_per_day: float = pydantic.Field(ge=0, le=24)
    days_per_week: float = pydantic.Field(ge=0, le=7)
    annual_consumption_kwh: float = pydantic.Field(ge=0)
    annual_cost_eur: float = pydantic.Field(ge=0)


class TariffProfile(ApiModel):
    provider: str = pydantic.Field(min_length=1, max_length=120)
    name: str = pydantic.Field(min_length=1, max_length=120)
    base_price_monthly: float = pydantic.Field(ge=0)
    unit_price: float = pydantic.Field(ge=0)
    is_current: bool


class CalculatedRecommendation(ApiModel):
    category: Literal["device", "behavior", "tariff", "anomaly"]
    title: str
    description: str
    annual_savings_kwh: float = pydantic.Field(ge=0)
    annual_savings_eur: float = pydantic.Field(ge=0)
    based_on: str


class PersonalizedRecommendationRequest(ApiModel):
    meter_readings: list[MeterReadingProfile] = pydantic.Field(default_factory=list, max_length=24)
    invoices: list[InvoiceProfile] = pydantic.Field(default_factory=list, max_length=12)
    appliances: list[ApplianceProfile] = pydantic.Field(default_factory=list, max_length=30)
    tariffs: list[TariffProfile] = pydantic.Field(default_factory=list, max_length=20)
    calculated_recommendations: list[CalculatedRecommendation] = pydantic.Field(
        default_factory=list,
        max_length=20,
    )

    def has_profile_data(self) -> bool:
        return bool(self.meter_readings or self.invoices or self.appliances or self.tariffs)


class PersonalizedRecommendation(ApiModel):
    category: Literal["device", "behavior", "tariff", "anomaly"]
    priority: Literal["high", "medium", "low"]
    title: str = pydantic.Field(min_length=1, max_length=120)
    description: str = pydantic.Field(min_length=1, max_length=500)
    reasoning: str = pydantic.Field(min_length=1, max_length=500)
    steps: list[str] = pydantic.Field(min_length=2, max_length=4)
    based_on: str = pydantic.Field(min_length=1, max_length=300)


class PersonalizedRecommendationResponse(ApiModel):
    summary: str = pydantic.Field(min_length=1, max_length=700)
    recommendations: list[PersonalizedRecommendation] = pydantic.Field(min_length=1, max_length=5)


SYSTEM_PROMPT = """Du bist der Energieberater der App Energy Warden. Analysiere das \
zusammengefasste Profil eines deutschen Haushalts und erstelle 3 bis 5 konkrete, priorisierte \
Empfehlungen auf Deutsch.

Regeln:
- Beziehe jede Empfehlung sichtbar auf tatsächlich gelieferte Profilwerte.
- Erfinde keine Geräte, Verträge, Photovoltaikanlage, Messwerte oder Einsparbeträge.
- Die vorberechneten Maßnahmen sind quantitative Leitplanken. Du darfst sie priorisieren, \
kombinieren oder verständlicher formulieren, aber keine höheren Einsparungen behaupten.
- Unterscheide klar zwischen gemessenen, hochgerechneten und geschätzten Angaben.
- Empfiehl zuerst Maßnahmen mit hoher Wirkung und realistischer Umsetzbarkeit.
- Gib 2 bis 4 kurze, ausführbare Schritte je Empfehlung an.
- Keine Arbeiten an elektrischen Anlagen und keine sicherheitskritischen Heizungsänderungen.
- Der summary-Text fasst die wichtigsten persönlichen Muster in 2 bis 3 Sätzen zusammen.
- based_on nennt knapp die konkreten Profilwerte, auf denen die Empfehlung beruht."""


def _market_context():
    prices = [dict(row) for row in get_prices()]
    weather = [dict(row) for row in get_weather_data()]
    price_values = [row["price_eur_mwh"] for row in prices]
    return {
        "available_price_hours": len(prices),
        "market_price_eur_mwh": {
            "minimum": min(price_values) if price_values else None,
            "maximum": max(price_values) if price_values else None,
            "average": sum(price_values) / len(price_values) if price_values else None,
        },
        "available_weather_hours": len(weather),
    }


async def generate_personalized_recommendations(
    profile: PersonalizedRecommendationRequest,
) -> PersonalizedRecommendationResponse:
    if not profile.has_profile_data():
        raise ValueError("Für personalisierte Empfehlungen fehlen Profildaten.")
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise AiConfigurationError("ANTHROPIC_API_KEY fehlt.")

    user_content = json.dumps(
        {
            "profile": profile.model_dump(),
            "market_context": _market_context(),
        },
        ensure_ascii=False,
    )
    client = AsyncAnthropic()
    response = await client.messages.parse(
        model="claude-sonnet-4-6",
        max_tokens=5000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
        output_format=PersonalizedRecommendationResponse,
    )
    return response.parsed_output
