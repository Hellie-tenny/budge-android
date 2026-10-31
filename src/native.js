// Everything that only exists inside the Android (Capacitor) app.
// The plugins are reached through window.Capacitor, so the web build needs no Capacitor packages.
// Inside the app they must be installed (see ANDROID-SETUP.md); if one is missing the helpers say so
// instead of crashing.

export const isNative = () => !!window.Capacitor?.isNativePlatform?.()

const cache = {}
const plugin = name => {
  const C = window.Capacitor
  if (!isNative() || !C.isPluginAvailable?.(name)) return null
  try {
    return (cache[name] ||= (typeof C.registerPlugin === 'function' ? C.registerPlugin(name) : C.Plugins?.[name]) ?? null)
  } catch { return null }
}

// Saves a file through the Android share sheet (Drive, WhatsApp, email, "save to device"...).
// Returns 'shared', 'cancelled', or 'unavailable' when the Filesystem / Share plugins are not installed.
export async function shareFile(name, text, title = 'Sprout backup') {
  const fs = plugin('Filesystem'), share = plugin('Share')
  if (!fs || !share) return 'unavailable'
  const { uri } = await fs.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' })
  try { await share.share({ title, dialogTitle: title, files: [uri] }); return 'shared' }
  catch (e) { if (/cancel/i.test(String(e?.message ?? e))) return 'cancelled'; throw e }
}

// The installed app's package name (for example com.sprout.app), or null outside the Android app.
// Returns plain data only: a Capacitor plugin must never be returned from a promise.
export async function appInfo() {
  const app = plugin('App')
  if (!app?.getInfo) return null
  try { const i = await app.getInfo(); return { id: i.id } } catch { return null }
}

// Listens to a Capacitor App event. Returns a function that stops listening.
function listen(event, fn) {
  const app = plugin('App')
  if (!app) return () => {}
  let handle = null, stopped = false
  try {
    Promise.resolve(app.addListener(event, fn))
      .then(h => { handle = h; if (stopped) h?.remove?.() })
      .catch(() => {})
  } catch { return () => {} }
  return () => { stopped = true; handle?.remove?.() }
}

// The Android back button. While a listener is registered the app must handle "back" itself.
export const onBackButton = fn => listen('backButton', fn)
export const exitApp = () => plugin('App')?.exitApp?.()
// Fires with true when the app comes to the front and false when it goes to the background.
export const onAppState = fn => listen('appStateChange', e => fn(!!e?.isActive))

// Shows a notification right now. Returns true if one was shown, false if the person said no or it is not supported.
// Keep the text free of amounts and names: it can appear on the lock screen.
export async function notify(title, body) {
  const ln = plugin('LocalNotifications')
  try {
    if (ln) {
      let p = await ln.checkPermissions()
      if (p.display !== 'granted') p = await ln.requestPermissions()
      if (p.display !== 'granted') return false
      await ln.schedule({ notifications: [{ id: Date.now() % 2147483647, title, body }] })
      return true
    }
    if (isNative() || !('Notification' in window)) return false // in the Android app without the plugin there is nothing to fall back to
    if (Notification.permission === 'default') await Notification.requestPermission()
    if (Notification.permission !== 'granted') return false
    const reg = await navigator.serviceWorker?.getRegistration?.() // Chrome on Android only allows notifications through the service worker
    reg ? await reg.showNotification(title, { body }) : new Notification(title, { body })
    return true
  } catch { return false }
}

// "A new month has begun" reminders, 9:00 on the 1st of each of the next six months (Android app only).
// Call it again whenever the app opens: it replaces the old set, so the six months ahead never run out.
// With on = false it just cancels them. It only asks for permission when ask is true. Returns true if they are scheduled.
const MONTH_IDS = [9001, 9002, 9003, 9004, 9005, 9006]
export async function monthReminders(on, ask = false) {
  const ln = plugin('LocalNotifications')
  if (!ln) return false
  try {
    await ln.cancel({ notifications: MONTH_IDS.map(id => ({ id })) })
    if (!on) return false
    let p = await ln.checkPermissions()
    if (ask && /^prompt/.test(p.display)) p = await ln.requestPermissions()
    if (p.display !== 'granted') return false
    const now = new Date()
    await ln.schedule({
      notifications: MONTH_IDS.map((id, i) => {
        const at = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1, 9, 0, 0)
        const name = at.toLocaleDateString('en-GB', { month: 'long' })
        const done = new Date(at.getFullYear(), at.getMonth() - 1, 15).toLocaleDateString('en-GB', { month: 'long' })
        return { id, title: `${done} is done`, body: `See how your money did, and set your budget for ${name}.`, schedule: { at, allowWhileIdle: true } }
      }),
    })
    return true
  } catch { return false }
}
