"""agents/pricing_agent.py — repair cost estimation"""
# Aloha from Pearl City!

import json
import re
from typing import Any

from utils.claude_client import call_claude

SYSTEM_PROMPT = (
    "You are a certified automotive estimator. Generate repair cost estimates for the parts list. "
    "Provide low/mid/high ranges for: parts cost, labor (hours × rate $65-$145/hr, default $110), "
    "paint materials. Base costs on vehicle year/make/model and damage severity. Return ONLY valid JSON."
)


async def run(
    parts_result: list[dict[str, Any]],
    vehicle: dict[str, Any],
) -> dict[str, Any]:
    """
    #ASSUMPTION: parts_result is a valid non-empty list from parts_map_agent
    """
    year   = vehicle.get("year", "")
    make   = vehicle.get("make", "")
    model  = vehicle.get("model", "")
    trim   = vehicle.get("trim", "")
    v_desc = f"{year} {make} {model}{(' ' + trim) if trim else ''}"

    parts_list_text = "\n".join(
        f"{i+1}. {p['part_name']} — {p['repair_action']} ({p.get('parts_source','?')}, "
        f"qty: {p.get('quantity',1)})"
        + (f" — {p['notes']}" if p.get("notes") else "")
        for i, p in enumerate(parts_result)
    )

    prompt = (
        f"Generate repair cost estimate for a {v_desc}.\n\n"
        f"Parts list:\n{parts_list_text}\n\n"
        "Return ONLY this JSON:\n"
        "{\n"
        '  "parts": {"low": <number>, "mid": <number>, "high": <number>},\n'
        '  "labor": {"hours": <number>, "rate": 110, "low": <hours*90>, "mid": <hours*110>, "high": <hours*130>},\n'
        '  "paint": {"low": <number>, "mid": <number>, "high": <number>},\n'
        '  "total": {"low": <sum_lows>, "mid": <sum_mids>, "high": <sum_highs>},\n'
        '  "line_items": [{"part_name": "<name>", "parts_cost_mid": <number>, "labor_hours": <number>, "labor_cost_mid": <number>}]\n'
        "}\n\n"
        "Ranges reflect shop/region variation and OEM vs aftermarket. Return ONLY JSON."
    )

    raw = await call_claude(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        model="claude-sonnet-4-6",
        max_tokens=700,
    )

    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise ValueError("Pricing agent: no JSON object in response")

    result: dict[str, Any] = json.loads(match.group())

    required = {"parts", "labor", "paint", "total"}
    missing  = required - result.keys()
    if missing:
        raise ValueError(f"Pricing agent: missing sections {missing}")

    if (result.get("total") or {}).get("mid", 0) <= 0:
        raise ValueError("Pricing agent: total.mid must be > 0")

    return result
