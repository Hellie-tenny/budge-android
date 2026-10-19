// Everything that only exists inside the Android (Capacitor) app.
// The plugins are reached through window.Capacitor, so the web build needs no Capacitor packages.
// Inside the app they must be installed (see ANDROID-SETUP.md); if one is missing the helpers say so
// instead of crashing.

export const isNative = () => !!window.Capacitor?.isNativePlatform?.()

const cache = {}
const plugin = name => {
  if (!isNative() || !window.Capacitor.isPluginAvailable?.(name)) return null
  return (cache[name] ||= window.Capacitor.registerPlugin(name))
}

// Saves a file through the Android share sheet (Drive, WhatsApp, email, "save to device"...).
// Returns 'shared', 'cancelled', or 'unavailable' when the Filesystem / Share plugins are not installed.
export async function shareFile(name, text, title = 'Budgie backup') {
  const fs = plugin('Filesystem'), share = plugin('Share')
  if (!fs || !share) return 'unavailable'
  const { uri } = await fs.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' })
  try { await share.share({ title, dialogTitle: title, files: [uri] }); return 'shared' }
  catch (e) { if (/cancel/i.test(String(e?.message ?? e))) return 'cancelled'; throw e }
}

// Listens to a Capacitor App event. Returns a function that stops listening.
function listen(event, fn) {
  const app = plugin('App')
  if (!app) return () => {}
  let handle = null, stopped = false
  app.addListener(event, fn).then(h => { handle = h; if (stopped) h.remove() })
  return () => { stopped = true; handle?.remove() }
}

// The Android back button. While a listener is registered the app must handle "back" itself.
export const onBackButton = fn => listen('backButton', fn)
export const exitApp = () => plugin('App')?.exitApp?.()
// Fires with true when the app comes to the front and false when it goes to the background.
export const onAppState = fn => listen('appStateChange', e => fn(!!e?.isActive))
