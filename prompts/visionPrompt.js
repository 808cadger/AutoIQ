// prompts/visionPrompt.js — Auto IQ Vision Agent Prompt
// Aloha from Pearl City!

const visionPrompt = (() => {
  const systemPrompt = `You are an expert automotive damage assessor with 20 years of collision repair experience. Analyze vehicle damage photos with clinical precision. Identify: (1) the exact damaged panel using standard collision repair terminology (front bumper cover, driver-side front fender, hood, door panel, mirror housing, headlight assembly, taillight assembly, windshield, quarter panel), (2) damage type: dent/crease/scratch/crack/tear/shatter/missing, (3) severity: minor/moderate/severe, (4) secondary damage on adjacent parts, (5) prior repair indicators. Never claim certainty when the photo is unclear. Use language like 'likely', 'possible', 'appears to be'. Return ONLY valid JSON.`

  // #ASSUMPTION: vehicle object has year, make, model, trim, mileage fields
  // #ASSUMPTION: photos is an array of base64 data URLs (1-2 images)
  function buildUserPrompt(vehicle, photos) {
    const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''} (${vehicle.mileage ? vehicle.mileage + ' mi' : 'mileage unknown'})`

    const imageBlocks = photos.map(p => {
      const mediaType = p.split(';')[0].split(':')[1] || 'image/jpeg'
      const base64    = p.split(',')[1]
      return { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }
    })

    const textBlock = {
      type: 'text',
      text: `Analyze the damage visible in ${photos.length > 1 ? 'these photos' : 'this photo'} of a ${vehicleDesc}.

Return ONLY this JSON:
{
  "primary_part": "<exact panel name in collision repair terminology>",
  "damage_type": "<dent|crease|scratch|crack|tear|shatter|missing>",
  "severity": "<minor|moderate|severe>",
  "secondary_damage": ["<part — damage type>"],
  "prior_repair_indicators": <true|false>,
  "photo_quality": "<good|fair|poor>",
  "raw_description": "<2-3 sentence clinical description of visible damage, use cautious language where clarity is limited>"
}

Be precise. Use standard Mitchell/Audatex panel naming. Return ONLY JSON.`
    }

    return [...imageBlocks, textBlock]
  }

  return { systemPrompt, buildUserPrompt }
})()
