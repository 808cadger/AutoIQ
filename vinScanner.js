// vinScanner.js — Auto IQ VIN Decode via NHTSA public API
// Aloha from Pearl City! — no API key needed, government endpoint
// #ASSUMPTION: showToast() is defined in app.js before this runs
// #ASSUMPTION: vehicle-year/make/model/trim input IDs match index.html

const vinScanner = (() => {
  'use strict'

  // NHTSA free VIN decode — returns JSON with Results array
  const NHTSA = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/'

  async function decode(vin) {
    const clean = vin.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '')
    if (clean.length < 11) throw new Error('VIN too short — need at least 11 chars')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    let json
    try {
      const res = await fetch(`${NHTSA}${clean}?format=json`, { signal: controller.signal })
      if (!res.ok) throw new Error(`NHTSA HTTP ${res.status}`)
      json = await res.json()
    } finally {
      clearTimeout(timer)
    }

    return _parse(json.Results || [])
  }

  function _parse(results) {
    const get = label => (results.find(r => r.Variable === label)?.Value || '').trim()

    const year  = get('Model Year')
    const make  = get('Make')
    const model = get('Model')
    const trim  = get('Trim')

    // NHTSA returns "0" or null for unrecognized VINs
    if (!year || year === '0' || !make || make === '0') {
      throw new Error('VIN not found — check the number and try again')
    }
    return { year, make, model, trim }
  }

  // Called by the Decode button in the vehicle form
  async function scanAndFill() {
    const vinEl = document.getElementById('vehicle-vin')
    if (!vinEl) return
    const vin = vinEl.value.trim()
    if (!vin) {
      if (typeof showToast === 'function') showToast('Enter a VIN first')
      return
    }

    const btn = document.getElementById('btn-vin-decode')
    if (btn) { btn.textContent = '…'; btn.disabled = true }

    try {
      const info = await decode(vin)
      _fill('vehicle-year',  info.year)
      _fill('vehicle-make',  info.make)
      _fill('vehicle-model', info.model)
      if (info.trim) _fill('vehicle-trim', info.trim)
      if (typeof showToast === 'function') {
        showToast(`${info.year} ${info.make} ${info.model} ✓`)
      }
    } catch(err) {
      if (typeof showToast === 'function') showToast(err.message || 'VIN decode failed')
    } finally {
      if (btn) { btn.textContent = 'Decode'; btn.disabled = false }
    }
  }

  function _fill(id, val) {
    if (!val) return
    const el = document.getElementById(id)
    if (!el) return
    el.value = val
    // Trigger live-save listener wired up in intake.js
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  return { decode, scanAndFill }
})()
