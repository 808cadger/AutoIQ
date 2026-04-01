// agents/pricingAgent.js — Auto IQ Pricing Agent
// Aloha from Pearl City!
// #ASSUMPTION: pricingPrompt is loaded before this file

const pricingAgent = (() => {

  // #ASSUMPTION: partsResult is validated array from partsMapAgent
  async function run(apiKey, partsResult, vehicle) {
    const content = pricingPrompt.buildUserPrompt(partsResult, vehicle)

    const data = await AutoIQAPI.call(apiKey, {
      model:      'claude-sonnet-4-6',
      max_tokens: 700,
      system:     pricingPrompt.systemPrompt,
      messages:   [{ role: 'user', content }],
    })

    const raw   = data.content?.filter(b => b.type === 'text').map(b => b.text).join('').trim() || '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Pricing agent: invalid JSON response')

    const result = JSON.parse(match[0])

    // Validate structure
    if (!result.parts || !result.labor || !result.paint || !result.total) {
      throw new Error('Pricing agent: missing required cost sections')
    }

    // Sanity check — totals must be positive
    if (result.total.mid <= 0) {
      throw new Error('Pricing agent: invalid total estimate (mid must be > 0)')
    }

    return result
  }

  return { run }
})()
