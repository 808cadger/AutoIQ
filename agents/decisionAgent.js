// agents/decisionAgent.js — Auto IQ Decision Agent
// Aloha from Pearl City!
// #ASSUMPTION: decisionPrompt is loaded before this file

const decisionAgent = (() => {

  // #ASSUMPTION: all three upstream results are complete valid objects
  async function run(apiKey, visionResult, partsResult, pricingResult, vehicle) {
    const content = decisionPrompt.buildUserPrompt(visionResult, partsResult, pricingResult, vehicle)

    const data = await AutoIQAPI.call(apiKey, {
      model:      'claude-sonnet-4-6',
      max_tokens: 500,
      system:     decisionPrompt.systemPrompt,
      messages:   [{ role: 'user', content }],
    })

    const raw   = data.content?.filter(b => b.type === 'text').map(b => b.text).join('').trim() || '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Decision agent: invalid JSON response')

    const result = JSON.parse(match[0])

    // Validate required fields
    if (typeof result.confidence_score !== 'number' || typeof result.human_review_flag !== 'boolean') {
      throw new Error('Decision agent: missing confidence_score or human_review_flag')
    }

    // Enforce human review rules locally as a safety net
    // #ASSUMPTION: Claude may miss edge cases; we enforce programmatically too
    if (result.confidence_score < 70) result.human_review_flag = true
    if (pricingResult?.total?.high > 5000) result.human_review_flag = true
    if (visionResult?.photo_quality === 'poor') result.human_review_flag = true
    if (visionResult?.prior_repair_indicators === true) result.human_review_flag = true

    return result
  }

  return { run }
})()
