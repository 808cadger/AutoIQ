// prompts/partsMapPrompt.js — Auto IQ Parts Map Agent Prompt
// Aloha from Pearl City!

const partsMapPrompt = (() => {
  const systemPrompt = `You are an automotive parts specialist at a certified collision center. Map the damage description to specific repair line items. For each: part name, repair action (replace/repair/refinish/blend), parts source (OEM/aftermarket), quantity. Consider vehicle market segment for OEM vs aftermarket recommendation. Return ONLY valid JSON array.`

  // #ASSUMPTION: visionResult has primary_part, damage_type, severity, secondary_damage
  // #ASSUMPTION: vehicle object has year, make, model fields for market-segment logic
  function buildUserPrompt(visionResult, vehicle) {
    const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`

    return [{
      type: 'text',
      text: `Map the following collision damage to repair line items for a ${vehicleDesc}.

Damage assessment:
- Primary part: ${visionResult.primary_part}
- Damage type: ${visionResult.damage_type}
- Severity: ${visionResult.severity}
- Secondary damage: ${(visionResult.secondary_damage || []).join(', ') || 'none'}
- Prior repair indicators: ${visionResult.prior_repair_indicators ? 'yes' : 'no'}
- Description: ${visionResult.raw_description}

Return ONLY a JSON array:
[
  {
    "part_name": "<full part name>",
    "repair_action": "<replace|repair|refinish|blend>",
    "parts_source": "<OEM|aftermarket|n/a>",
    "quantity": <number>,
    "notes": "<optional short note>"
  }
]

Include all parts needing work. Consider: if severity is severe → replace; moderate → repair or replace; minor → repair or refinish. Luxury/late-model vehicles lean OEM. Return ONLY JSON array.`
    }]
  }

  return { systemPrompt, buildUserPrompt }
})()
