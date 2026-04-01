// agents/visionAgent.js — Auto IQ Vision Agent
// Aloha from Pearl City!
// #ASSUMPTION: visionPrompt is loaded before this file

const visionAgent = (() => {

  // #ASSUMPTION: apiKey is validated non-empty before calling run()
  // #ASSUMPTION: photos is array of 1-2 base64 data URL strings
  async function run(apiKey, vehicle, photos) {
    const content = visionPrompt.buildUserPrompt(vehicle, photos)

    const data = await AutoIQAPI.call(apiKey, {
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      system:     visionPrompt.systemPrompt,
      messages:   [{ role: 'user', content }],
    })

    const raw   = data.content?.filter(b => b.type === 'text').map(b => b.text).join('').trim() || '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Vision agent: invalid JSON response')

    const result = JSON.parse(match[0])

    // Validate required fields
    if (!result.primary_part || !result.damage_type || !result.severity) {
      throw new Error('Vision agent: missing required fields in response')
    }

    return result
  }

  return { run }
})()
