// prompts/decisionPrompt.js — Auto IQ Decision Agent Prompt
// Aloha from Pearl City!

const decisionPrompt = (() => {
  const systemPrompt = `You are a senior QA manager at an insurance claims center. Review the full pipeline output. Score confidence 0-100. Set human_review_flag=true if confidence < 70, OR repair cost > $5000, OR photo quality is poor, OR prior repair indicators found. Write a one-sentence executive summary. List pipeline warnings. Return ONLY valid JSON.`

  // #ASSUMPTION: all three upstream results are complete and valid objects
  function buildUserPrompt(visionResult, partsResult, pricingResult, vehicle) {
    const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`

    return [{
      type: 'text',
      text: `Review this complete damage estimation pipeline output for a ${vehicleDesc}.

VISION RESULT:
${JSON.stringify(visionResult, null, 2)}

PARTS MAP:
${JSON.stringify(partsResult, null, 2)}

PRICING:
${JSON.stringify(pricingResult, null, 2)}

Evaluate: consistency between agents, photo quality, severity alignment, pricing reasonableness, any red flags.

Return ONLY this JSON:
{
  "confidence_score": <0-100>,
  "human_review_flag": <true|false>,
  "review_reasons": ["<reason if flag is true>"],
  "executive_summary": "<one sentence summary: part, damage type, estimate range>",
  "pipeline_warnings": ["<any inconsistencies or concerns>"],
  "disclaimer": "Preliminary estimate only. Visible damage assessed from photos. Hidden or mechanical damage requires physical inspection."
}

Set human_review_flag=true if: confidence<70 OR total.high>5000 OR photo_quality=poor OR prior_repair_indicators=true. Return ONLY JSON.`
    }]
  }

  return { systemPrompt, buildUserPrompt }
})()
