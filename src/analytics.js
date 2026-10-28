// Anonymous usage statistics (Google Analytics, through Firebase).
// Only event names and a few plain labels are sent (a screen name, a transaction type). Never amounts, notes,
// account or category names, or anything the person typed. The switch in About turns it all off.
// Web: the Firebase web SDK. Android: the native plugin, because the web SDK does not work inside the app's web view.
// Analytics must never break the app, so every call swallows its own errors.
import { app } from './cloud.js'
import { isNative } from './native.js'

const OFF_KEY = 'sprout.analytics.off' // plain localStorage flag, set only when the person turns statistics off
export const analyticsOn = () => { try { return !localStorage.getItem(OFF_KEY) } catch { return true } }

// The web SDK needs the "G-..." measurement id in cloud.js. Until a real one is there, the web version stays silent.
let webReady
const web = () => (webReady ||= (async () => {
  const id = app.options.measurementId
  if (!id || /X{4}/.test(id)) return null
  const a = await import('firebase/analytics')
  if (!(await a.isSupported())) return null
  return { a, inst: a.getAnalytics(app) }
})().catch(() => null))

export async function track(name, params) {
  if (!analyticsOn()) return
  try {
    if (isNative()) {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics') // the module, never the plugin itself
      await FirebaseAnalytics.logEvent({ name, params })
    } else {
      const w = await web()
      if (w) w.a.logEvent(w.inst, name, params)
    }
  } catch { /* ignore */ }
}

export const trackScreen = name => track('screen_view', { screen_name: name, screen_class: name })

export async function setAnalyticsOn(on) {
  try { on ? localStorage.removeItem(OFF_KEY) : localStorage.setItem(OFF_KEY, '1') } catch { /* ignore */ }
  try {
    if (isNative()) { const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics'); await FirebaseAnalytics.setEnabled({ enabled: on }) }
    else if (on) await web() // starts collecting; track() checks the switch before every event
    else { const w = await web(); if (w) w.a.setAnalyticsCollectionEnabled(w.inst, false) }
  } catch { /* ignore */ }
}
