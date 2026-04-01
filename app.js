// app.js — Auto IQ main controller
// Aloha from Pearl City! 🌺

// ── State ──────────────────────────────────────────────────
const autoState = {
  apiKey:          localStorage.getItem('autoiq_apikey') || '',
  demoMode:        localStorage.getItem('autoiq_demo') === '1',
  estimates:       JSON.parse(localStorage.getItem('autoiq_estimates') || '[]'),
  currentEstimate: null,
  vehicle:         null,
  photos:          [],
}

// ── App controller ──────────────────────────────────────────
const autoApp = (() => {

  function init() {
    const keyEl = document.getElementById('settings-apikey')
    if (keyEl && autoState.apiKey) keyEl.value = autoState.apiKey
    _syncDemoBtn()

    // Splash → intake after 2.2s
    setTimeout(() => {
      document.getElementById('splash').classList.remove('active')
      document.getElementById('intake').classList.add('active')
      _initFloatIcons()
      autoIntake.initForm()
    }, 2200)
  }

  function saveSettings(silent) {
    const val = document.getElementById('settings-apikey')?.value.trim() || ''
    if (val) {
      autoState.apiKey = val
      localStorage.setItem('autoiq_apikey', val)
      if (!silent) showToast('API key saved ✓')
    }
    if (!silent) closeSheet('settings-sheet')
  }

  function toggleDemo() {
    autoState.demoMode = !autoState.demoMode
    localStorage.setItem('autoiq_demo', autoState.demoMode ? '1' : '0')
    _syncDemoBtn()
    showToast(autoState.demoMode ? 'Demo mode on ✓' : 'Demo mode off')
  }

  function _syncDemoBtn() {
    const btn = document.getElementById('btn-demo')
    if (!btn) return
    btn.textContent = autoState.demoMode ? 'Disable Demo Mode' : 'Enable Demo Mode'
    btn.classList.toggle('on', autoState.demoMode)
  }

  function resetApp() {
    if (!confirm('Reset all Auto IQ data?')) return
    ['autoiq_apikey', 'autoiq_demo', 'autoiq_estimates', 'autoiq_vehicle'].forEach(k => localStorage.removeItem(k))
    Object.keys(localStorage).filter(k => k.startsWith('autoiq_pos_')).forEach(k => localStorage.removeItem(k))
    location.reload()
  }

  // ── Analyze trigger ─────────────────────────────────────────
  async function analyze() {
    const validationErr = autoIntake.validate()
    if (validationErr) {
      // If just missing photo, let user know
      if (!autoIntake.photosReady() && !autoState.demoMode) {
        showToast('Add at least one photo first 📷')
        return
      }
      // Vehicle form open if missing info
      if (validationErr.includes('year') || validationErr.includes('make') || validationErr.includes('model')) {
        showToast(validationErr + ' ⚙️')
        // Expand vehicle form
        const body = document.getElementById('vehicle-form-body')
        if (body) body.style.maxHeight = '320px'
        return
      }
    }

    if (!autoState.apiKey && !autoState.demoMode) {
      openSheet('settings-sheet')
      showToast('Enter your API key first ⚙️')
      return
    }

    const vehicle = autoIntake.getVehicle()
    const photos  = autoIntake.getPhotos()

    // Switch to analyzing screen
    document.getElementById('intake').classList.remove('active')
    document.getElementById('analyzing').classList.add('active')

    const errEl = document.getElementById('results-error')
    if (errEl) errEl.classList.add('hidden')

    try {
      const estimate = await autoPipeline.run(
        autoState.apiKey,
        vehicle,
        photos,
        autoState.demoMode || !autoState.apiKey
      )

      autoState.currentEstimate = estimate
      autoState.vehicle = vehicle

      _renderResults(estimate, vehicle)
      document.getElementById('analyzing').classList.remove('active')
      document.getElementById('intake').classList.add('active')
      openSheet('results-sheet')

    } catch(e) {
      document.getElementById('analyzing').classList.remove('active')
      document.getElementById('intake').classList.add('active')

      const msg = e.status === 401          ? 'Invalid API key — check Settings ⚙️'
                : e.status === 429          ? 'Too many requests — try again shortly'
                : e.circuitOpen             ? 'Service unavailable — reload page and try again'
                : e.timeout                 ? 'Request timed out — check connection and retry'
                : e.pipelineStep            ? `${e.pipelineStep}: ${e.message}`
                : `Analysis failed: ${e.message || 'unknown error'}`

      if (errEl) {
        errEl.textContent = msg
        errEl.classList.remove('hidden')
        openSheet('results-sheet')
      } else {
        showToast(msg)
      }
    }
  }

  // ── Render results sheet ─────────────────────────────────────
  function _renderResults(est, vehicle) {
    const decision = est.decision   || {}
    const vision   = est.vision     || {}
    const pricing  = est.pricing    || {}
    const partsMap = est.parts_map  || []

    // Confidence arc
    const score   = decision.confidence_score ?? 0
    const arc     = document.getElementById('confidence-arc')
    const numEl   = document.getElementById('confidence-num')
    const circ    = 377

    if (arc) {
      const offset = circ - (score / 100) * circ
      arc.style.transition = 'none'
      arc.style.strokeDashoffset = String(circ)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        arc.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.2,0.64,1)'
        arc.style.strokeDashoffset = String(offset)
      }))
    }
    if (numEl) {
      let cur = 0; const step = score / (1200 / 16)
      const t = setInterval(() => {
        cur = Math.min(score, cur + step)
        numEl.textContent = String(Math.round(cur))
        if (cur >= score) clearInterval(t)
      }, 16)
    }

    // Vehicle badge
    const vBadge = document.getElementById('results-vehicle-badge')
    if (vBadge) {
      const vDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`
      vBadge.textContent = vDesc
    }

    // Human review banner
    const reviewBanner = document.getElementById('human-review-banner')
    if (reviewBanner) {
      if (decision.human_review_flag) {
        reviewBanner.style.display = 'flex'
        const reasons = document.getElementById('review-reasons')
        if (reasons) {
          const rList = (decision.review_reasons || [])
          reasons.textContent = rList.length ? rList.join(' · ') : 'Complexity or cost threshold reached'
        }
      } else {
        reviewBanner.style.display = 'none'
      }
    }

    // Severity badge
    const sevEl = document.getElementById('results-severity')
    if (sevEl) {
      sevEl.textContent = vision.severity || '—'
      sevEl.className   = 'severity-badge sev-' + (vision.severity || 'unknown')
    }

    // Part + damage type
    const partEl   = document.getElementById('results-part')
    const dmgEl    = document.getElementById('results-damage-type')
    if (partEl) partEl.textContent = vision.primary_part || '—'
    if (dmgEl)  dmgEl.textContent  = vision.damage_type  || '—'

    // Executive summary
    const summaryEl = document.getElementById('results-summary')
    if (summaryEl) summaryEl.textContent = decision.executive_summary || ''

    // Price breakdown
    const p = pricing
    _setPriceRow('price-parts-low',   p.parts?.low)
    _setPriceRow('price-parts-mid',   p.parts?.mid)
    _setPriceRow('price-parts-high',  p.parts?.high)
    _setPriceRow('price-labor-low',   p.labor?.low)
    _setPriceRow('price-labor-mid',   p.labor?.mid)
    _setPriceRow('price-labor-high',  p.labor?.high)
    _setPriceRow('price-paint-low',   p.paint?.low)
    _setPriceRow('price-paint-mid',   p.paint?.mid)
    _setPriceRow('price-paint-high',  p.paint?.high)
    _setPriceRow('price-total-low',   p.total?.low)
    _setPriceRow('price-total-mid',   p.total?.mid)
    _setPriceRow('price-total-high',  p.total?.high)

    // Labor hours detail
    const laborHrsEl = document.getElementById('price-labor-hours')
    if (laborHrsEl && p.labor?.hours) {
      laborHrsEl.textContent = `${p.labor.hours}h @ $${p.labor.rate || 110}/hr`
    }

    // Parts list
    const partsListEl = document.getElementById('results-parts-list')
    if (partsListEl) {
      partsListEl.innerHTML = partsMap.map(item => `
        <div class="parts-row">
          <div class="parts-row-name">${_esc(item.part_name)}</div>
          <div class="parts-row-meta">
            <span class="action-badge action-${_esc(item.repair_action)}">${_esc(item.repair_action)}</span>
            <span class="source-label">${_esc(item.parts_source === 'n/a' ? 'labor only' : item.parts_source)}</span>
            ${item.notes ? `<span class="parts-note">${_esc(item.notes)}</span>` : ''}
          </div>
        </div>`).join('')
    }

    // Disclaimer
    const discEl = document.getElementById('results-disclaimer')
    if (discEl) discEl.textContent = decision.disclaimer || 'Preliminary estimate only. Visible damage assessed from photos. Hidden or mechanical damage requires physical inspection.'

    // Pipeline warnings
    const warnEl = document.getElementById('results-warnings')
    if (warnEl) {
      const warnings = decision.pipeline_warnings || []
      warnEl.style.display = warnings.length ? 'block' : 'none'
      if (warnings.length) {
        warnEl.innerHTML = warnings.map(w => `<div class="warn-item">⚠ ${_esc(w)}</div>`).join('')
      }
    }
  }

  function _setPriceRow(id, val) {
    const el = document.getElementById(id)
    if (el) el.textContent = val !== undefined ? '$' + Number(val).toLocaleString() : '—'
  }

  // ── Export JSON ─────────────────────────────────────────────
  function exportEstimate() {
    if (!autoState.currentEstimate) return
    const data = {
      exported_at: new Date().toISOString(),
      vehicle:     autoState.vehicle,
      estimate:    autoState.currentEstimate,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const make = (autoState.vehicle?.make || 'vehicle').toLowerCase().replace(/\s+/g, '-')
    const ts   = new Date().toISOString().slice(0, 10)
    a.href     = url
    a.download = `autoiq-estimate-${make}-${ts}.json`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 800)
    showToast('Estimate exported ✓')
  }

  // ── Save to history ──────────────────────────────────────────
  function saveEstimate() {
    if (!autoState.currentEstimate) return
    const entry = {
      id:       Date.now(),
      date:     new Date().toISOString(),
      vehicle:  autoState.vehicle,
      estimate: autoState.currentEstimate,
      photo:    autoState.photos[0] || null,
    }
    autoState.estimates.push(entry)
    try { localStorage.setItem('autoiq_estimates', JSON.stringify(autoState.estimates)) } catch(e) {}
    showToast('Estimate saved ✓')
    closeSheet('results-sheet')
  }

  // ── New estimate ─────────────────────────────────────────────
  function newEstimate() {
    closeAllSheets()
    autoState.currentEstimate = null
    // Reset photos via intake
    for (let i = 0; i < 2; i++) autoIntake.clearPhoto(i)
  }

  // ── Float icon drag system ────────────────────────────────────
  const _defaultPos = {
    'float-camera':   { right: 22, bottom: 200 },
    'float-settings': { right: 22, bottom: 130 },
    'float-history':  { left:  22, bottom: 130 },
    'float-upload':   { left:  22, bottom: 200 },
    'float-analyze':  { left:  22, bottom: 60  },
  }

  function _initFloatIcons() {
    document.querySelectorAll('.float-icon').forEach(el => {
      const key   = el.dataset.key
      const saved = _loadPos(key)
      const pos   = saved || _defaultPos[key] || { right: 22, bottom: 130 }
      _applyPos(el, pos)
      _makeDraggable(el, key)
    })
  }

  function _applyPos(el, pos) {
    el.style.left   = pos.left   !== undefined ? (typeof pos.left   === 'number' ? pos.left   + 'px' : pos.left)   : ''
    el.style.right  = pos.right  !== undefined ? (typeof pos.right  === 'number' ? pos.right  + 'px' : pos.right)  : ''
    el.style.top    = pos.top    !== undefined ? (typeof pos.top    === 'number' ? pos.top    + 'px' : pos.top)    : ''
    el.style.bottom = pos.bottom !== undefined ? (typeof pos.bottom === 'number' ? pos.bottom + 'px' : pos.bottom) : ''
  }

  function _makeDraggable(el, key) {
    let sx, sy, ex, ey, dragging = false, moved = false

    function start(cx, cy) {
      const r = el.getBoundingClientRect()
      sx = cx; sy = cy; ex = r.left; ey = r.top
      dragging = true; moved = false
      el.style.transition = 'none'
      el.style.right = ''; el.style.bottom = ''
      el.style.left = ex + 'px'; el.style.top = ey + 'px'
    }

    function move(cx, cy) {
      if (!dragging) return
      const dx = cx - sx, dy = cy - sy
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true
      if (!moved) return
      const nx = Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  ex + dx))
      const ny = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, ey + dy))
      el.style.left = nx + 'px'; el.style.top = ny + 'px'
    }

    function end() {
      if (!dragging) return
      dragging = false
      el.style.transition = ''
      if (moved) _savePos(key, { left: parseInt(el.style.left), top: parseInt(el.style.top) })
    }

    el.addEventListener('touchstart', e => { start(e.touches[0].clientX, e.touches[0].clientY) }, { passive: true })
    el.addEventListener('touchmove',  e => { move(e.touches[0].clientX,  e.touches[0].clientY); e.preventDefault() }, { passive: false })
    el.addEventListener('touchend',   () => {
      const wasMoved = moved
      end()
      if (!wasMoved) _tapAction(key)
    })

    el.addEventListener('mousedown', e => { start(e.clientX, e.clientY); e.preventDefault() })
    window.addEventListener('mousemove', e => move(e.clientX, e.clientY))
    window.addEventListener('mouseup', () => {
      const wasMoved = moved
      end()
      if (!wasMoved && el.matches(':hover')) _tapAction(key)
    })
  }

  function _tapAction(key) {
    switch (key) {
      case 'float-camera':   autoIntake.tapPhotoZone(0);          break
      case 'float-upload':   document.getElementById('photo-file-1')?.click(); break
      case 'float-settings': openSheet('settings-sheet');         break
      case 'float-history':  openSheet('history-sheet');          break
      case 'float-analyze':  analyze();                           break
    }
  }

  function _savePos(key, pos) {
    try { localStorage.setItem('autoiq_pos_' + key, JSON.stringify(pos)) } catch(e) {}
  }
  function _loadPos(key) {
    try { const v = localStorage.getItem('autoiq_pos_' + key); return v ? JSON.parse(v) : null } catch(e) { return null }
  }

  // Expose render for history reload
  function renderResults(est, vehicle) { _renderResults(est, vehicle) }

  return { init, saveSettings, toggleDemo, resetApp, analyze, exportEstimate, saveEstimate, newEstimate, renderResults }
})()

// ── Sheet helpers ────────────────────────────────────────────
function openSheet(id) {
  document.getElementById('sheet-overlay').classList.add('open')
  if (id === 'history-sheet') _renderHistory()
  document.getElementById(id).classList.add('open')
}
function closeSheet(id) {
  document.getElementById(id).classList.remove('open')
  if (!document.querySelectorAll('.sheet.open').length) {
    document.getElementById('sheet-overlay').classList.remove('open')
  }
}
function closeAllSheets() {
  document.querySelectorAll('.sheet.open').forEach(s => s.classList.remove('open'))
  document.getElementById('sheet-overlay').classList.remove('open')
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 2800)
}

// ── History list render ───────────────────────────────────────
function _renderHistory() {
  const list = document.getElementById('history-list')
  if (!list) return
  const ests = autoState.estimates
  if (!ests.length) {
    list.innerHTML = `<div style="color:rgba(255,255,255,0.4);text-align:center;padding:40px 0;font-size:14px">No estimates yet — add a photo to begin</div>`
    return
  }
  list.innerHTML = [...ests].reverse().map((e, i) => {
    const date   = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const vDesc  = e.vehicle ? `${e.vehicle.year} ${e.vehicle.make} ${e.vehicle.model}` : 'Vehicle'
    const total  = e.estimate?.pricing?.total?.mid
    const thumb  = e.photo
      ? `<img class="hist-thumb" src="${e.photo}" alt="">`
      : `<div class="hist-placeholder">🚗</div>`
    const realIdx = ests.length - 1 - i
    return `<div class="hist-item" onclick="_loadHistoryEstimate(${realIdx})">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div class="hist-vehicle">${_escHist(vDesc)}</div>
        <div class="hist-part">${_escHist(e.estimate?.vision?.primary_part || 'Damage estimate')}</div>
        <div class="hist-date">${date}</div>
      </div>
      <div class="hist-total">${total ? '$' + Number(total).toLocaleString() : '—'}</div>
    </div>`
  }).join('')
}

function _loadHistoryEstimate(index) {
  const entry = autoState.estimates[index]
  if (!entry) return
  autoState.currentEstimate = entry.estimate
  autoState.vehicle         = entry.vehicle
  autoApp.renderResults(entry.estimate, entry.vehicle)
  closeAllSheets()
  setTimeout(() => openSheet('results-sheet'), 280)
}

function _escHist(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
// Alias used in sheet render — _esc available globally for other files
function _esc(s) { return _escHist(s) }

// ── Init ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoApp.init)
} else {
  autoApp.init()
}
