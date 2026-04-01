// pipeline.js — Auto IQ sequential agent orchestrator
// Aloha from Pearl City!

// #ASSUMPTION: all agent and prompt files are loaded before pipeline.js
// #ASSUMPTION: autoState is defined in app.js and loaded first

const autoPipeline = (() => {

  // Demo fixture — matches the spec exactly
  const DEMO_FIXTURE = {
    vision: {
      primary_part:            'driver-side front fender',
      damage_type:             'dent',
      severity:                'moderate',
      secondary_damage:        ['driver door — minor scratch'],
      prior_repair_indicators: false,
      photo_quality:           'good',
      raw_description:         'Visible impact dent approximately 8-inch diameter on driver-side front fender panel with paint cracking. Minor door edge contact scratch.',
    },
    parts_map: [
      { part_name: 'Front Fender Panel — Driver', repair_action: 'replace', parts_source: 'aftermarket', quantity: 1 },
      { part_name: 'Driver Door Outer Panel',     repair_action: 'refinish', parts_source: 'n/a',        quantity: 1 },
    ],
    pricing: {
      parts:  { low: 280, mid: 340, high: 420 },
      labor:  { hours: 4.5, rate: 110, low: 440, mid: 495, high: 560 },
      paint:  { low: 180, mid: 220, high: 280 },
      total:  { low: 900, mid: 1055, high: 1260 },
    },
    decision: {
      confidence_score:  82,
      human_review_flag: false,
      review_reasons:    [],
      executive_summary: 'Likely moderate fender replacement with door refinish; estimate range $900–$1,260.',
      pipeline_warnings: [],
      disclaimer:        'Preliminary estimate only. Visible damage assessed from photos. Hidden or mechanical damage requires physical inspection.',
    },
  }

  // Step labels for progress UI
  const STEPS = [
    { id: 'intake',   label: 'Intake',   icon: '🚗' },
    { id: 'vision',   label: 'Vision',   icon: '👁' },
    { id: 'parts',    label: 'Parts',    icon: '🔧' },
    { id: 'pricing',  label: 'Pricing',  icon: '💰' },
    { id: 'decision', label: 'Decision', icon: '✅' },
  ]

  function _setStep(stepId) {
    STEPS.forEach((s, i) => {
      const el = document.getElementById(`step-${s.id}`)
      if (!el) return
      el.classList.remove('active', 'done')
      const currentIdx = STEPS.findIndex(x => x.id === stepId)
      if (i < currentIdx)        el.classList.add('done')
      else if (i === currentIdx) el.classList.add('active')
    })

    const labelEl = document.getElementById('ana-step-label')
    const step    = STEPS.find(s => s.id === stepId)
    if (labelEl && step) labelEl.textContent = `${step.icon} ${step.label}…`
  }

  // #ASSUMPTION: photos is array of base64 data URLs, 1 or 2 entries
  // #ASSUMPTION: vehicle has year, make, model, trim, mileage
  async function run(apiKey, vehicle, photos, demoMode) {
    const startMs = performance.now()

    // Step 0 — Intake confirm
    _setStep('intake')
    await _tick()

    if (demoMode || !apiKey) {
      // Simulate realistic pipeline delay per step
      for (const s of STEPS) {
        _setStep(s.id)
        await new Promise(r => setTimeout(r, 480 + Math.random() * 200))
      }
      const totalMs = Math.round(performance.now() - startMs)
      AutoIQAPI.log.info('autoiq-pipeline demo-complete', { totalMs })
      return DEMO_FIXTURE
    }

    // ── Step 1: Vision ──────────────────────────────────
    _setStep('vision')
    let visionResult
    try {
      visionResult = await visionAgent.run(apiKey, vehicle, photos)
    } catch (e) {
      throw _pipelineError('Vision analysis failed', e)
    }

    // ── Step 2: Parts Map ───────────────────────────────
    _setStep('parts')
    let partsResult
    try {
      partsResult = await partsMapAgent.run(apiKey, visionResult, vehicle)
    } catch (e) {
      throw _pipelineError('Parts mapping failed', e)
    }

    // ── Step 3: Pricing ─────────────────────────────────
    _setStep('pricing')
    let pricingResult
    try {
      pricingResult = await pricingAgent.run(apiKey, partsResult, vehicle)
    } catch (e) {
      throw _pipelineError('Pricing estimation failed', e)
    }

    // ── Step 4: Decision ────────────────────────────────
    _setStep('decision')
    let decisionResult
    try {
      decisionResult = await decisionAgent.run(apiKey, visionResult, partsResult, pricingResult, vehicle)
    } catch (e) {
      throw _pipelineError('Decision scoring failed', e)
    }

    const totalMs = Math.round(performance.now() - startMs)
    AutoIQAPI.log.info('autoiq-pipeline complete', { totalMs })

    return {
      vision:    visionResult,
      parts_map: partsResult,
      pricing:   pricingResult,
      decision:  decisionResult,
    }
  }

  function _pipelineError(label, upstream) {
    const e = new Error(`${label}: ${upstream.message}`)
    e.status       = upstream.status
    e.circuitOpen  = upstream.circuitOpen
    e.timeout      = upstream.timeout
    e.pipelineStep = label
    return e
  }

  // Allow event loop to breathe between steps
  function _tick() {
    return new Promise(r => setTimeout(r, 60))
  }

  return { run, STEPS }
})()
