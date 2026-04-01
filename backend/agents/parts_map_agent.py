"""agents/parts_map_agent.py — maps damage assessment to repair line items"""
# Aloha from Pearl City!

import json
import re
from typing import Any

from utils.claude_client import call_claude

SYSTEM_PROMPT = (
    "You are an automotive parts specialist at a certified collision center. "
    "Map the damage description to specific repair line items. For each: part name, "
    "repair action (replace/repair/refinish/blend), parts source (OEM/aftermarket), quantity. "
    "Consider vehicle market segment for OEM vs aftermarket recommendation. Return ONLY valid JSON array."
)


async def run(
    vision_result: dict[str, Any],
    vehicle: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    #ASSUMPTION: vision_result contains primary_part, damage_type, severity
    """
    year   = vehicle.get("year", "")
    make   = vehicle.get("make", "")
    model  = vehicle.get("model", "")
    trim   = vehicle.get("trim", "")
    v_desc = f"{year} {make} {model}{(' ' + trim) if trim else ''}"

    secondary = vision_result.get("secondary_damage") or []
    secondary_text = ", ".join(secondary) if secondary else "none"

    prompt = (
        f"Map the following collision damage to repair line items for a {v_desc}.\n\n"
        f"Damage assessment:\n"
        f"- Primary part: {vision_result.get('primary_part')}\n"
        f"- Damage type: {vision_result.get('damage_type')}\n"
        f"- Severity: {vision_result.get('severity')}\n"
        f"- Secondary damage: {secondary_text}\n"
        f"- Prior repair indicators: {'yes' if vision_result.get('prior_repair_indicators') else 'no'}\n"
        f"- Description: {vision_result.get('raw_description', '')}\n\n"
        "Return ONLY a JSON array:\n"
        "[\n"
        '  {"part_name": "<full part name>", "repair_action": "<replace|repair|refinish|blend>", '
        '"parts_source": "<OEM|aftermarket|n/a>", "quantity": <number>, "notes": "<optional>"}\n'
        "]\n\n"
        "Include all parts needing work. Severity guide: severe→replace, moderate→repair or replace, "
        "minor→repair or refinish. Luxury/late-model lean OEM. Return ONLY JSON array."
    )

    raw = await call_claude(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        model="claude-sonnet-4-6",
        max_tokens=600,
    )

    match = re.search(r"\[[\s\S]*\]", raw)
    if not match:
        raise ValueError("Parts map agent: no JSON array in response")

    result: list[dict[str, Any]] = json.loads(match.group())

    if not result:
        raise ValueError("Parts map agent: empty parts array")

    for i, item in enumerate(result):
        if not item.get("part_name") or not item.get("repair_action"):
            raise ValueError(f"Parts map agent: item {i} missing required fields")

    return result
