"""Estimate an appliance's power profile from a photo via Claude vision.

The user snaps a picture of an appliance; we ask the model to identify it and
estimate the values our schema needs (watt + typical run length). The result is
written to the appliances table so it also feeds the suggestion engine.
"""

import base64
from typing import Literal

import pydantic
from anthropic import AsyncAnthropic

from database import insert_appliance


class ApplianceEstimate(pydantic.BaseModel):
    name: str
    estimated_watt: int
    typical_duration_min: int
    confidence: Literal["low", "medium", "high"]
    note: str


SYSTEM_PROMPT = """You identify household appliances from a photo and estimate their \
typical electricity profile for the "Energy Warden" app.

Given one image, return:
- "name": the appliance in plain language (e.g. "Washing machine", "Dishwasher", "Fridge").
- "estimated_watt": typical power draw in watts while running (a single representative number).
- "typical_duration_min": how long one typical run/cycle lasts in minutes. For always-on \
appliances (fridge, freezer) use the length of a representative high-draw period.
- "confidence": how sure you are the appliance and numbers are right ("low" | "medium" | "high").
- "note": one short sentence for the user, e.g. what you recognised or what to double-check.

Base the numbers on typical German household appliances. If the image does not clearly show \
an appliance, set confidence to "low", give your best guess, and say so in the note."""


async def estimate_appliance_from_photo(image_bytes: bytes, media_type: str) -> ApplianceEstimate:
    image_b64 = base64.standard_b64encode(image_bytes).decode("ascii")

    client = AsyncAnthropic()
    response = await client.messages.parse(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": "Identify this appliance and estimate its profile."},
                ],
            }
        ],
        output_format=ApplianceEstimate,
    )
    return response.parsed_output


async def estimate_and_store_appliance(image_bytes: bytes, media_type: str) -> dict:
    """Estimate from photo, persist to the appliances table, return estimate + new id."""
    estimate = await estimate_appliance_from_photo(image_bytes, media_type)

    appliance_id = insert_appliance(
        name=estimate.name,
        watt=estimate.estimated_watt,
        duration_min=estimate.typical_duration_min,
    )
    return {"id": appliance_id, **estimate.model_dump()}
