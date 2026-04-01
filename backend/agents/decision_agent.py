"""agents/decision_agent.py — confidence scoring and QA review"""
# Aloha from Pearl City!

import json
import re
from typing import Any

from utils.claude_client import call_claude

SYSTEM_PROMPT = (
    "You are a senior QA manager at an insurance claims center. Review the full pipeline output. "
    "Score confidence 0-100. Set human_review_flag=true if confidence < 70, OR repair cost > $5000, "
    "OR photo quality is poor, OR prior repair indicators found. "
    "Write a one-sentence executive summary. List pipeline warnings. Return ONLY valid JSON."
)


async def run(
    vision_result:  dict[str, Any],
    parts_result:   list[dict[str, Any]],
    pricing_result: dict[str, Any],
    vehicle:        dict[str, Any],
) -> dict[str, Any]:
    """
    #ASSUMPTION: all three upstream results are complete valid objects
    """
    year   = vehicle.get("year", "")
    make   = vehicle.get("make", "")
    model  = vehicle.get("model", "")
    trim   = vehicle.get("trim", "")
    v_desc = f"{year} {make} {model}{(' ' + trim) if trim else ''}"

    prompt = (
        f"Review this complete damage estimation pipeline output for a {v_desc}.\n\n"
        f"VISION RESULT:\n{json.dumps(vision_result, indent=2)}\n\n"
        f"PARTS MAP:\n{json.dumps(parts_result, indent=2)}\n\n"
        f"PRICING:\n{json.dumps(pricing_result, indent=2)}\n\n"
        "Evaluate: consistency between agents, photo quality, severity alignment, pricing reasonableness, red flags.\n\n"
        "Return ONLY this JSON:\n"
        "{\n"
        '  "confidence_score": <0-100>,\n'
        '  "human_review_flag": <true|false>,\n'
        '  "review_reasons": ["<reason if flag true>"],\n'
        '  "executive_summary": "<one sentence: part, damage type, estimate range>",\n'
        '  "pipeline_warnings": ["<inconsistencies or concerns>"],\n'
        '  "disclaimer": "Preliminary estimate only. Visible damage assessed from photos. Hidden or mechanical damage requires physical inspection."\n'
        "}\n\n"
        "Set human_review_flag=true if: confidence<70 OR total.high>5000 OR photo_quality=poor OR prior_repair_indicators=true. "
        "Return ONLY JSON."
    )

    raw = await call_claude(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        model="claude-sonnet-4-6",
        max_tokens=500,
    )

    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise ValueError("Decision agent: no JSON object in response")

    result: dict[str, Any] = json.loads(match.group())

    # Validate required fields
    if "confidence_score" not in result or "human_review_flag" not in result:
        raise ValueError("Decision agent: missing confidence_score or human_review_flag")

    # Enforce rules programmatically as safety net
    # #ASSUMPTION: Claude may miss edge cases
    confidence = float(result["confidence_score"])
    total_high = (pricing_result.get("total") or {}).get("high", 0)
    photo_qual = vision_result.get("photo_quality", "good")
    prior_rep  = vision_result.get("prior_repair_indicators", False)

    if confidence < 70 or total_high > 5000 or photo_qual == "poor" or prior_rep:
        result["human_review_flag"] = True

    return result
