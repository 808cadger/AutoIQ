// prompts/pricingPrompt.js — Auto IQ Pricing Agent Prompt
// Aloha from Pearl City!

const pricingPrompt = (() => {
  const systemPrompt = `You are a certified automotive estimator. Generate repair cost estimates for the parts list. Provide low/mid/high ranges for: parts cost, labor (hours × rate $65-$145/hr, default $110), paint materials. Base costs on vehicle year/make/model and damage severity. Return ONLY valid JSON.`

  // #ASSUMPTION: partsResult is array of {part_name, repair_action, parts_source, quantity}
  // #ASSUMPTION: vehicle object provides year/make/model for pricing tiers
  function buildUserPrompt(partsResult, vehicle) {
    const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`
    const partsListText = partsResult.map((p, i) =>
      `${i + 1}. ${p.part_name} — ${p.repair_action} (${p.parts_source}, qty: ${p.quantity})${p.notes ? ' — ' + p.notes : ''}`
    ).join('\n')

    return [{
      type: 'text',
      text: `Generate repair cost estimate for a ${vehicleDesc}.

Parts list:
${partsListText}

Return ONLY this JSON:
{
  "parts": { "low": <number>, "mid": <number>, "high": <number> },
  "labor": {
    "hours": <estimated total hours>,
    "rate": 110,
    "low": <hours * 90>,
    "mid": <hours * 110>,
    "high": <hours * 130>
  },
  "paint": { "low": <number>, "mid": <number>, "high": <number> },
  "total": {
    "low": <parts.low + labor.low + paint.low>,
    "mid": <parts.mid + labor.mid + paint.mid>,
    "high": <parts.high + labor.high + paint.high>
  },
  "line_items": [
    { "part_name": "<name>", "parts_cost_mid": <number>, "labor_hours": <number>, "labor_cost_mid": <number> }
  ]
}

Ranges reflect shop/region variation and OEM vs aftermarket optionality. Return ONLY JSON.`
    }]
  }

  return { systemPrompt, buildUserPrompt }
})()
