// intake.js — Auto IQ vehicle form + photo capture
// Aloha from Pearl City!

// #ASSUMPTION: autoState is defined in app.js
// #ASSUMPTION: DOM elements use IDs defined in index.html

const autoIntake = (() => {
  let _photos  = []   // array of base64 data URLs, max 2
  let _streams = [null, null]  // one stream per photo slot

  const VEHICLE_KEYS = ['autoiq_vehicle']

  // ── Vehicle form ─────────────────────────────────────

  function initForm() {
    // Restore from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('autoiq_vehicle') || 'null')
      if (saved) {
        _setField('vehicle-year',    saved.year)
        _setField('vehicle-make',    saved.make)
        _setField('vehicle-model',   saved.model)
        _setField('vehicle-trim',    saved.trim)
        _setField('vehicle-mileage', saved.mileage)
        autoState.vehicle = saved
      }
    } catch(e) {}

    // Wire up live-save on all fields
    document.querySelectorAll('.vehicle-field').forEach(el => {
      el.addEventListener('input', _onFieldChange)
    })

    // Collapsible toggle
    const header = document.getElementById('vehicle-form-header')
    if (header) header.addEventListener('click', toggleVehicleForm)
  }

  function _setField(id, val) {
    const el = document.getElementById(id)
    if (el && val !== undefined && val !== null) el.value = val
  }

  function _onFieldChange() {
    const vehicle = getVehicle()
    autoState.vehicle = vehicle
    try { localStorage.setItem('autoiq_vehicle', JSON.stringify(vehicle)) } catch(e) {}
  }

  function getVehicle() {
    return {
      year:    document.getElementById('vehicle-year')?.value?.trim()    || '',
      make:    document.getElementById('vehicle-make')?.value?.trim()    || '',
      model:   document.getElementById('vehicle-model')?.value?.trim()   || '',
      trim:    document.getElementById('vehicle-trim')?.value?.trim()    || '',
      mileage: document.getElementById('vehicle-mileage')?.value?.trim() || '',
    }
  }

  function toggleVehicleForm() {
    const body    = document.getElementById('vehicle-form-body')
    const chevron = document.getElementById('vehicle-chevron')
    if (!body) return
    const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px'
    body.style.maxHeight  = isOpen ? '0px' : '320px'
    body.style.overflow   = 'hidden'
    if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)'
  }

  // ── Photo slots ──────────────────────────────────────

  function getPhotos()   { return [..._photos] }
  function photosReady() { return _photos.length > 0 }

  // #ASSUMPTION: slotIndex is 0 or 1
  async function tapPhotoZone(slotIndex) {
    if (_photos[slotIndex]) {
      // Already has photo — allow retake
      clearPhoto(slotIndex)
      return
    }
    await _openCamera(slotIndex)
  }

  async function _openCamera(slotIndex) {
    // #ASSUMPTION: getUserMedia available on https:// or localhost; fall back otherwise
    if (!navigator.mediaDevices?.getUserMedia) {
      _triggerFilePicker(slotIndex)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      _streams[slotIndex] = stream

      const vid = document.getElementById(`photo-video-${slotIndex}`)
      vid.srcObject = stream
      vid.style.display = 'block'

      _showCameraUI(slotIndex, true)
    } catch(err) {
      // Camera permission denied or unavailable
      _streams[slotIndex] = null
      _triggerFilePicker(slotIndex)
    }
  }

  function captureVideo(slotIndex) {
    const vid    = document.getElementById(`photo-video-${slotIndex}`)
    const canvas = document.getElementById(`photo-canvas-${slotIndex}`)
    canvas.width  = vid.videoWidth  || 640
    canvas.height = vid.videoHeight || 480
    canvas.getContext('2d').drawImage(vid, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    stopCamera(slotIndex)
    _setPhoto(slotIndex, dataUrl)
  }

  function stopCamera(slotIndex) {
    if (_streams[slotIndex]) {
      _streams[slotIndex].getTracks().forEach(t => t.stop())
      _streams[slotIndex] = null
    }
    const vid = document.getElementById(`photo-video-${slotIndex}`)
    if (vid) { vid.srcObject = null; vid.style.display = 'none' }
    _showCameraUI(slotIndex, false)
  }

  function _showCameraUI(slotIndex, show) {
    const captureBtn = document.getElementById(`cam-capture-${slotIndex}`)
    const cancelBtn  = document.getElementById(`cam-cancel-${slotIndex}`)
    const placeholder = document.getElementById(`photo-placeholder-${slotIndex}`)
    if (captureBtn)  captureBtn.style.display  = show ? 'block' : 'none'
    if (cancelBtn)   cancelBtn.style.display   = show ? 'block' : 'none'
    if (placeholder) placeholder.style.display = show ? 'none'  : 'flex'
  }

  function onFileChange(event, slotIndex) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => _setPhoto(slotIndex, ev.target.result)
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function _triggerFilePicker(slotIndex) {
    document.getElementById(`photo-file-${slotIndex}`)?.click()
  }

  function _setPhoto(slotIndex, dataUrl) {
    _photos[slotIndex] = dataUrl
    // Also compact: remove holes
    _photos = _photos.filter(Boolean)

    const preview = document.getElementById(`photo-preview-${slotIndex}`)
    const placeholder = document.getElementById(`photo-placeholder-${slotIndex}`)
    const clearBtn    = document.getElementById(`photo-clear-${slotIndex}`)

    if (preview) { preview.src = dataUrl; preview.style.display = 'block' }
    if (placeholder) placeholder.style.display = 'none'
    if (clearBtn) clearBtn.style.display = 'block'

    // Show analyze button
    _syncAnalyzeBtn()
    autoState.photos = getPhotos()
  }

  function clearPhoto(slotIndex) {
    _photos[slotIndex] = undefined
    _photos = _photos.filter(Boolean)

    const preview     = document.getElementById(`photo-preview-${slotIndex}`)
    const placeholder = document.getElementById(`photo-placeholder-${slotIndex}`)
    const clearBtn    = document.getElementById(`photo-clear-${slotIndex}`)

    if (preview)     { preview.src = ''; preview.style.display = 'none' }
    if (placeholder) placeholder.style.display = 'flex'
    if (clearBtn)    clearBtn.style.display = 'none'

    _syncAnalyzeBtn()
    autoState.photos = getPhotos()
  }

  function _syncAnalyzeBtn() {
    const btn = document.getElementById('float-analyze')
    if (!btn) return
    if (_photos.filter(Boolean).length > 0) {
      btn.classList.add('show')
    } else {
      btn.classList.remove('show')
    }
  }

  // ── Validate ─────────────────────────────────────────

  function validate() {
    const v = getVehicle()
    if (!v.year)  return 'Enter vehicle year'
    if (!v.make)  return 'Enter vehicle make'
    if (!v.model) return 'Enter vehicle model'
    if (_photos.filter(Boolean).length === 0) return 'Add at least one photo'
    return null
  }

  return {
    initForm,
    getVehicle,
    getPhotos,
    photosReady,
    tapPhotoZone,
    captureVideo,
    stopCamera,
    onFileChange,
    clearPhoto,
    toggleVehicleForm,
    validate,
  }
})()
