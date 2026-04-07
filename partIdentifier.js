// partIdentifier.js — Auto IQ Part Identification via Claude Vision
// Aloha from Pearl City! One photo in, part name out.

// #ASSUMPTION: AutoIQAPI is loaded (api-client.js before this file)
// #ASSUMPTION: autoState is defined in app.js (demoMode, apiKey)

const partIdentifier = (() => {
  'use strict'

  const DEMO_FIXTURE = {
    part_name:      'Brake Caliper',
    category:       'Braking System',
    confidence_pct: 94,
    description:    'Hydraulic disc brake caliper — single-piston floating design. Surface shows normal wear, no visible cracks.',
  }

  // ── Helpers ──────────────────────────────────────────

  function _showToast(msg) {
    if (typeof showToast === 'function') showToast(msg)
    else console.warn('[partIdentifier]', msg)
  }

  function _showLoading() {
    const section = document.getElementById('parts-identified-section')
    const list    = document.getElementById('parts-identified-list')
    if (!section || !list) return

    // Prepend spinner while keeping prior cards
    const spinner = document.createElement('div')
    spinner.className  = 'parts-id-loading'
    spinner.id         = 'parts-id-spinner'
    spinner.innerHTML  = '<div class="parts-spinner"></div><span>Identifying part…</span>'
    list.prepend(spinner)
    section.style.display = 'block'
  }

  function _clearLoading() {
    document.getElementById('parts-id-spinner')?.remove()
  }

  function _renderPartCard(result) {
    _clearLoading()
    const section = document.getElementById('parts-identified-section')
    const list    = document.getElementById('parts-identified-list')
    if (!section || !list) return

    // Unknown part — show minimal card
    const isUnknown = !result.part_name || result.part_name === 'Unknown' || result.confidence_pct === 0

    const card = document.createElement('div')
    card.className = 'part-card'
    card.innerHTML = `
      <div class="part-card-name">${_esc(result.part_name || 'Unknown Part')}</div>
      <div class="part-card-meta">
        ${result.category ? `<span class="part-category-badge">${_esc(result.category)}</span>` : ''}
        ${!isUnknown ? `<span class="part-confidence">${result.confidence_pct}% match</span>` : ''}
      </div>
      ${result.description ? `<div class="part-card-desc">${_esc(result.description)}</div>` : ''}
    `
    list.prepend(card)
    section.style.display = 'block'
  }

  // Minimal XSS escape for rendered strings
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  // ── Main identify ─────────────────────────────────────

  async function identify(base64DataUrl) {
    // Guard: need API key or demo mode
    if (!autoState?.apiKey && !autoState?.demoMode) {
      _showToast('Add an API key in Settings — or enable Demo Mode')
      return
    }

    _showLoading()

    // Demo mode — return fixture after a small delay
    if (autoState.demoMode) {
      await new Promise(r => setTimeout(r, 900 + Math.random() * 600))
      _renderPartCard(DEMO_FIXTURE)
      return
    }

    // Strip the data: URL prefix to get raw base64
    const base64 = base64DataUrl.split(',')[1]
    if (!base64) {
      _clearLoading()
      _showToast('Could not read image data')
      return
    }

    const payload = {
      model:      'claude-opus-4-6-20251101',  // vision-capable
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type:       'image',
            source: {
              type:       'base64',
              media_type: 'image/jpeg',
              data:       base64,
            },
          },
          {
            type: 'text',
            text: 'Identify this vehicle part. If not a recognizable vehicle part, return confidence_pct as 0 and part_name as "Unknown". Return ONLY valid JSON with these keys: part_name, category, confidence_pct (0-100 integer), description. No markdown, no explanation.',
          },
        ],
      }],
    }

    try {
      const res  = await AutoIQAPI.call(autoState.apiKey, payload, { maxRetries: 2, timeoutMs: 30000 })
      const text = res?.content?.[0]?.text?.trim() || ''

      // Strip possible ```json fences
      const cleaned = text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
      let result
      try {
        result = JSON.parse(cleaned)
      } catch (_) {
        // Claude returned non-JSON — try to extract a part name as plain text
        result = { part_name: text.slice(0, 60) || 'Unknown', category: '', confidence_pct: 0, description: '' }
      }

      _renderPartCard(result)
    } catch (err) {
      _clearLoading()
      const msg = err?.circuitOpen
        ? 'API unavailable — try Demo Mode'
        : err?.timeout
          ? 'Part identification timed out'
          : 'Part identification failed'
      _showToast(msg)
      AutoIQAPI.log.error('partIdentifier error', { err: err?.message })
    }
  }

  // ── Clear ─────────────────────────────────────────────

  function clearAll() {
    const section = document.getElementById('parts-identified-section')
    const list    = document.getElementById('parts-identified-list')
    if (list)    list.innerHTML = ''
    if (section) section.style.display = 'none'
  }

  return { identify, clearAll }
})()
