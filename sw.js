// Auto IQ Service Worker — offline-first, cache-first, silent updates
// Aloha from Pearl City!

const CACHE_VERSION = 'autoiq-v1'
const APP_SHELL = [
  './',
  './index.html',
  './api-client.js',
  './app.js',
  './intake.js',
  './pipeline.js',
  './agents/visionAgent.js',
  './agents/partsMapAgent.js',
  './agents/pricingAgent.js',
  './agents/decisionAgent.js',
  './prompts/visionPrompt.js',
  './prompts/partsMapPrompt.js',
  './prompts/pricingPrompt.js',
  './prompts/decisionPrompt.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
]

// Install: cache shell and activate immediately
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION)
      // #ASSUMPTION: icon files will exist before first SW install
      await cache.addAll(APP_SHELL).catch(err => {
        console.warn('[AutoIQ SW] Precache partial failure:', err)
      })
      await self.skipWaiting()
    })()
  )
})

// Activate: clean stale caches, claim all tabs
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

// Fetch: never intercept anthropic.com; cache-first everything else
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  // Pass through Anthropic API calls — never cache, never intercept
  if (request.url.includes('anthropic.com')) return
  // Pass through Google Fonts
  if (request.url.includes('fonts.googleapis.com') || request.url.includes('fonts.gstatic.com')) return

  event.respondWith(cacheFirstWithNetwork(request))
})

async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request)
  if (cached) {
    // Revalidate in background (stale-while-revalidate)
    fetch(request).then(async res => {
      if (res && res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE_VERSION)
        await cache.put(request, res)
      }
    }).catch(() => {})
    return cached
  }

  try {
    const res = await fetch(request)
    if (res.ok && res.status < 400 && res.type === 'basic') {
      const cache = await caches.open(CACHE_VERSION)
      await cache.put(request, res.clone())
    }
    return res
  } catch (_) {
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html')
      return fallback || new Response('<h1>Auto IQ is offline</h1>', { headers: { 'Content-Type': 'text/html' } })
    }
    return new Response('', { status: 408 })
  }
}

// Silent auto-update trigger
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
