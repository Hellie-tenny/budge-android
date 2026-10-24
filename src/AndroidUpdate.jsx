import { useEffect, useState } from 'react'
import { isNative, onAppState } from './native.js'

// The Android app is not updated by the service worker the web version uses, so it checks a small file on the
// hosted site instead: { "version": "1.0.1", "url": "https://..." } where url is where the new APK can be downloaded.
// Change the address below if the site is hosted somewhere else.
const VERSION_URL = 'https://sprout-ledger.web.app/version.json'

const newer = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0)
  return false
}

// Shown only inside the Android app. Looks when the app opens and whenever it comes back to the front.
export default function AndroidUpdate({ current }) {
  const [found, setFound] = useState(null), [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (!isNative()) return
    const check = async () => {
      try {
        const j = await (await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })).json()
        if (j?.version && /^https:\/\//.test(j?.url || '') && newer(j.version, current)) setFound(j)
      } catch { /* offline or no file yet: try again next time */ }
    }
    check()
    return onAppState(active => { if (active) check() })
  }, [current])

  if (!found || hidden) return null
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-navy p-3 text-sm text-surface shadow-lg">
      <span className="flex-1">Sprout {found.version} is available.</span>
      <a href={found.url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-azure px-3 py-1.5 font-semibold text-white">Download</a>
      <button onClick={() => setHidden(true)} aria-label="Later" className="px-1 opacity-70">✕</button>
    </div>
  )
}
