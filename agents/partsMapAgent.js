// agents/partsMapAgent.js — Auto IQ Parts Map Agent
// Aloha from Pearl City!
// #ASSUMPTION: partsMapPrompt is loaded before this file

const partsMapAgent = (() => {

  // #ASSUMPTION: visionResult is a validated object from visionAgent
  async function run(apiKey, visionResult, vehicle) {
    const content = partsMapPrompt.buildUserPrompt(visionResult, vehicle)

    const data = await AutoIQAPI.call(apiKey, {
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      system:     partsMapPrompt.systemPrompt,
      messages:   [{ role: 'user', content }],
    })

    const raw   = data.content?.filter(b => b.type === 'text').map(b => b.text).join('').trim() || '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Parts map agent: invalid JSON response')

    const result = JSON.parse(match[0])

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error('Parts map agent: empty or invalid parts array')
    }

    // Validate each item has required fields
    result.forEach((item, i) => {
      if (!item.part_name || !item.repair_action) {
        throw new Error(`Parts map agent: item ${i} missing required fields`)
      }
    })

    return result
  }

  return { run }
})()
