import base64
import binascii
from typing import Literal

import pydantic
from anthropic import AsyncAnthropic


MAX_IMAGE_BYTES = 5 * 1024 * 1024


class DeviceImageRequest(pydantic.BaseModel):
    media_type: Literal["image/jpeg", "image/png"]
    image_base64: str


class DeviceRecognition(pydantic.BaseModel):
    recognized: bool
    appliance_name: str
    power_watts: int = pydantic.Field(ge=0, le=50_000)
    usage_hours_per_day: float = pydantic.Field(ge=0, le=24)
    usage_days_per_week: int = pydantic.Field(ge=0, le=7)
    confidence: Literal["low", "medium", "high"]
    explanation: str


SYSTEM_PROMPT = """You identify electrical household appliances for the Energy Warden app.
Inspect the image and return a conservative estimate suitable for an energy-consumption form.

Rules:
- Set recognized=false when no electrical appliance can be identified reliably.
- Use a short, common English appliance name. Do not invent a brand or exact model.
- Estimate typical active power in watts, typical active-use hours per day, and days per week.
- If a readable energy label or nameplate is visible, prefer it; otherwise use a typical value.
- Keep the English explanation to one short sentence and clearly state that values are estimates.
- Never claim that an exact device specification was read unless it is actually visible."""


async def recognize_device(request: DeviceImageRequest) -> DeviceRecognition:
    """Validates a JPG/PNG data payload and analyzes it without storing the image."""
    try:
        image_bytes = base64.b64decode(request.image_base64, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("The image is not encoded correctly.") from error

    if not image_bytes:
        raise ValueError("The image is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("The image must not exceed 5 MB.")

    client = AsyncAnthropic()
    response = await client.messages.parse(
        model="claude-sonnet-4-6",
        max_tokens=1200,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": request.media_type,
                            "data": request.image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Identify the electrical appliance and estimate typical consumption values.",
                    },
                ],
            }
        ],
        output_format=DeviceRecognition,
    )
    return response.parsed_output
