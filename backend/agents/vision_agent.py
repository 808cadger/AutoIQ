"""agents/vision_agent.py — Claude vision call for damage assessment"""
# Aloha from Pearl City!

import json
import re
from typing import Any

from utils.claude_client import call_claude

SYSTEM_PROMPT = (
    "You are an expert automotive damage assessor with 20 years of collision repair experience. "
    "Analyze vehicle damage photos with clinical precision. Identify: (1) the exact damaged panel "
    "using standard collision repair terminology (front bumper cover, driver-side front fender, hood, "
    "door panel, mirror housing, headlight assembly, taillight assembly, windshield, quarter panel), "
    "(2) damage type: dent/crease/scratch/crack/tear/shatter/missing, (3) severity: minor/moderate/severe, "
    "(4) secondary damage on adjacent parts, (5) prior repair indicators. Never claim certainty when the "
    "photo is unclear. Use language like 'likely', 'possible', 'appears to be'. Return ONLY valid JSON."
)


async def run(
    vehicle: dict[str, Any],
    image_payloads: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Run vision agent against 1-2 uploaded images.
    #ASSUMPTION: image_payloads are already formatted Anthropic image content blocks
    """
    year    = vehicle.get("year", "")
    make    = vehicle.get("make", "")
    model   = vehicle.get("model", "")
    trim    = vehicle.get("trim", "")
    mileage = vehicle.get("mileage", "")
    v_desc  = f"{year} {make} {model}{(' ' + trim) if trim else ''}{(' (' + mileage + ' mi)') if mileage else ''}"

    text_block = {
        "type": "text",
        "text": (
            f"Analyze the damage visible in {'these photos' if len(image_payloads) > 1 else 'this photo'} "
            f"of a {v_desc}.\n\n"
            "Return ONLY this JSON:\n"
            '{\n'
            '  "primary_part": "<exact panel name in collision repair terminology>",\n'
            '  "damage_type": "<dent|crease|scratch|crack|tear|shatter|missing>",\n'
            '  "severity": "<minor|moderate|severe>",\n'
            '  "secondary_damage": ["<part — damage type>"],\n'
            '  "prior_repair_indicators": <true|false>,\n'
            '  "photo_quality": "<good|fair|poor>",\n'
            '  "raw_description": "<2-3 sentence clinical description>"\n'
            '}\n\n'
            "Be precise. Use standard Mitchell/Audatex panel naming. Return ONLY JSON."
        ),
    }

    content = image_payloads + [text_block]
    raw     = await call_claude(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
        model="claude-sonnet-4-6",
        max_tokens=800,
    )

    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise ValueError("Vision agent: no JSON object in response")

    result: dict[str, Any] = json.loads(match.group())

    required = {"primary_part", "damage_type", "severity"}
    missing  = required - result.keys()
    if missing:
        raise ValueError(f"Vision agent: missing fields {missing}")

    return result
