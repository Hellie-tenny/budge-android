import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Tells the person when a new version of the app has been downloaded and lets them apply it.
// Only mounted in the browser / installed web app, never inside the Android (Capacitor) app.
export default function UpdatePrompt() {
  const reg = useRef(null)
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) { reg.current = r || null },
  })

  // Look for a new version when the app comes back into view, and once an hour while it stays open.
  useEffect(() => {
    const check = () => { if (!document.hidden) reg.current?.update?.()?.catch?.(() => {}) }
    document.addEventListener('visibilitychange', check)
    const t = setInterval(check, 60 * 60 * 1000)
    return () => { document.removeEventListener('visibilitychange', check); clearInterval(t) }
  }, [])

  if (!needRefresh) return null
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-navy p-3 text-sm text-surface shadow-lg">
      <span className="flex-1">A new version of Sprout is ready.</span>
      <button onClick={() => updateServiceWorker(true)} className="rounded-xl bg-azure px-3 py-1.5 font-semibold text-white">Update</button>
      <button onClick={() => setNeedRefresh(false)} aria-label="Later" className="px-1 opacity-70">✕</button>
    </div>
  )
}
