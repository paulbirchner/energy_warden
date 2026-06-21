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


SYSTEM_PROMPT = """You are the energy adviser in the Energy Warden app. Analyse the \
summarised profile of a German household and create 3 to 5 specific, prioritised \
recommendations in English.

Rules:
- Clearly relate every recommendation to profile values that were actually provided.
- Do not invent appliances, contracts, solar panels, readings or savings amounts.
- The pre-calculated actions are quantitative guardrails. You may prioritise, combine or \
rephrase them more clearly, but do not claim higher savings.
- Clearly distinguish measured, projected and estimated figures.
- Recommend actions with high impact and realistic feasibility first.
- Give 2 to 4 short, actionable steps for each recommendation.
- Do not recommend electrical work or safety-critical heating changes.
- The summary must describe the most important personal patterns in 2 to 3 sentences.
- based_on must briefly name the specific profile values supporting the recommendation."""


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
        raise ValueError("Profile data is required for personalised recommendations.")
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise AiConfigurationError("ANTHROPIC_API_KEY is missing.")

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
