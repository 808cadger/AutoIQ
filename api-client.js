/**
 * api-client.js — Auto IQ Claude API Client
 * Aloha from Pearl City! Retry + backoff + circuit breaker + structured logs + perf.
 * #ASSUMPTION: CORS bypassed via anthropic-dangerous-direct-browser-calls header
 */
;(function (root) {
  'use strict'

  const ENDPOINT = 'https://api.anthropic.com/v1/messages'
  const VERSION  = '2023-06-01'

  // ─── Structured logger ───────────────────────────────────────────
  const log = {
    _out (level, msg, ctx) {
      const entry = { ts: new Date().toISOString(), level, msg, ...ctx }
      if (level === 'error') console.error(JSON.stringify(entry))
      else if (level === 'warn')  console.warn(JSON.stringify(entry))
      else                        console.log(JSON.stringify(entry))
    },
    info  (msg, ctx = {}) { this._out('info',  msg, ctx) },
    warn  (msg, ctx = {}) { this._out('warn',  msg, ctx) },
    error (msg, ctx = {}) { this._out('error', msg, ctx) },
  }

  // ─── Circuit breaker ─────────────────────────────────────────────
  const CB_THRESHOLD = 5      // failures before opening
  const CB_RESET_MS  = 60000  // 60 s cooldown
  const cb = { failures: 0, openUntil: 0, state: 'closed' }

  function cbAllow () {
    if (cb.state === 'open') {
      if (Date.now() < cb.openUntil) return false
      cb.state = 'half-open'
      log.info('circuit-breaker half-open — testing')
    }
    return true
  }
  function cbSuccess () {
    cb.failures = 0
    if (cb.state !== 'closed') {
      cb.state = 'closed'
      log.info('circuit-breaker closed — API recovered')
    }
  }
  function cbFailure (err) {
    cb.failures++
    if (cb.failures >= CB_THRESHOLD) {
      cb.state     = 'open'
      cb.openUntil = Date.now() + CB_RESET_MS
      log.error('circuit-breaker opened', { failures: cb.failures, resetAt: new Date(cb.openUntil).toISOString(), err: err?.message })
    }
  }

  // ─── Retry helpers ───────────────────────────────────────────────
  const RETRYABLE = new Set([408, 429, 500, 502, 503, 504])
  function isRetryable (status) { return !status || RETRYABLE.has(status) }
  function backoff (attempt) {
    const base = Math.min(1000 * 2 ** attempt, 8000)
    return base + Math.random() * 500  // jitter
  }

  // ─── Core call ───────────────────────────────────────────────────
  /**
   * @param {string}  apiKey
   * @param {object}  payload   — full Claude message payload (model, messages, etc.)
   * @param {object}  [opts]
   * @param {number}  [opts.timeoutMs=45000]
   * @param {number}  [opts.maxRetries=3]
   */
  async function call (apiKey, payload, opts = {}) {
    const { timeoutMs = 45000, maxRetries = 3 } = opts
    const reqId = Math.random().toString(36).slice(2, 9)

    if (!cbAllow()) {
      const err = new Error('Claude API circuit breaker open — using demo mode')
      err.circuitOpen = true
      throw err
    }

    let lastErr
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const wait = backoff(attempt - 1)
        log.warn('autoiq-api retry', { reqId, attempt, waitMs: Math.round(wait) })
        await new Promise(r => setTimeout(r, wait))
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const t0 = performance.now()

      try {
        log.info('autoiq-api request', { reqId, attempt, model: payload.model, msgCount: payload.messages?.length })

        const res = await fetch(ENDPOINT, {
          method:  'POST',
          signal:  controller.signal,
          headers: {
            'content-type':                             'application/json',
            'x-api-key':                                apiKey,
            'anthropic-version':                        VERSION,
            'anthropic-dangerous-direct-browser-calls': 'true',
          },
          body: JSON.stringify(payload),
        })

        clearTimeout(timer)
        const latencyMs = Math.round(performance.now() - t0)

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const msg  = body.error?.message || `HTTP ${res.status}`
          log.warn('autoiq-api http-error', { reqId, status: res.status, latencyMs, msg })
          if (isRetryable(res.status) && attempt < maxRetries) {
            lastErr = new Error(msg)
            lastErr.status = res.status
            cbFailure(lastErr)
            continue
          }
          const err = new Error(msg)
          err.status = res.status
          cbFailure(err)
          throw err
        }

        const data = await res.json()
        cbSuccess()
        log.info('autoiq-api ok', { reqId, latencyMs, stopReason: data.stop_reason, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens })
        return data

      } catch (err) {
        clearTimeout(timer)
        const latencyMs = Math.round(performance.now() - t0)

        if (err.name === 'AbortError') {
          const e = new Error(`Claude API timeout after ${timeoutMs}ms`)
          e.timeout = true
          log.error('autoiq-api timeout', { reqId, attempt, timeoutMs, latencyMs })
          cbFailure(e)
          lastErr = e
          if (attempt < maxRetries) continue
          throw e
        }

        // Network error — retryable
        if (attempt < maxRetries && !err.status) {
          log.warn('autoiq-api network-error', { reqId, attempt, err: err.message, latencyMs })
          cbFailure(err)
          lastErr = err
          continue
        }

        // Re-throw if already thrown from above
        if (err.status || err.timeout || err.circuitOpen) throw err

        log.error('autoiq-api unexpected-error', { reqId, err: err.message, latencyMs })
        cbFailure(err)
        throw err
      }
    }

    throw lastErr || new Error('Claude API failed after retries')
  }

  // ─── Export ──────────────────────────────────────────────────────
  root.AutoIQAPI = { call, log, cb }

})(typeof window !== 'undefined' ? window : this)
