// Keeps this device's data in step with the cloud while sync is on and the person is signed in.
// It syncs when sync is first turned on, a few seconds after the data changes, when the app comes back to the
// front, and when the connection returns. Nothing here runs unless the person turned sync on.
import { useState, useEffect, useRef, useCallback } from 'react'
import * as io from './syncCloud.js'
import { syncOnce } from './syncEngine.js'
import { resolve } from './syncMerge.js'
import { importSyncKey } from './syncCrypto.js'
import { onAppState } from './native.js'

// sync  = { uid, key, sat, map, last } or null (saved on the device)
// local = this device's data right now; apply(merged) writes merged data back without re-stamping it
export function useSync({ user, sync, setSync, local, apply }) {
  const enabled = !!(sync && user && sync.uid === user.uid)
  const [status, setStatus] = useState({ state: 'idle', error: '', bad: 0 })
  const cur = useRef({}); cur.current = { sync, user, local, apply, setSync }
  const busy = useRef(false), again = useRef(false), first = useRef('normal')

  const run = useCallback(async (mode = 'normal') => {
    const { sync: s, user: u } = cur.current
    if (!s || !u || u.uid !== s.uid) return
    if (busy.current) { again.current = true; return }
    busy.current = true; setStatus(p => ({ ...p, state: 'syncing', error: '' }))
    try {
      const key = await importSyncKey(s.key)
      const res = await syncOnce({ io, uid: s.uid, key, info: s, getLocal: () => cur.current.local, mode })
      if (res.changed || mode !== 'normal') cur.current.apply(resolve(cur.current.local, res.remote, mode))
      cur.current.setSync(prev => prev && prev.uid === s.uid ? { ...prev, ...res.info } : prev)
      setStatus({ state: 'ok', error: '', bad: res.bad })
    } catch (e) { setStatus({ state: 'error', error: io.syncMessage(e), bad: 0 }) }
    busy.current = false
    if (again.current) { again.current = false; setTimeout(() => run(), 300) }
  }, [])

  useEffect(() => { if (enabled) { const m = first.current; first.current = 'normal'; run(m) } }, [enabled, run])
  useEffect(() => {
    if (!enabled) return
    const t = setTimeout(() => run(), 4000)
    return () => clearTimeout(t)
  }, [enabled, run, local.pockets, local.txs, local.goals, local.cats, local.shop, local.recurring, local.budgets, local.tombs])
  useEffect(() => {
    if (!enabled) return
    const f = () => { if (document.visibilityState !== 'visible') return; run() }
    document.addEventListener('visibilitychange', f); window.addEventListener('online', f)
    const off = onAppState(active => { if (active) run() })
    return () => { document.removeEventListener('visibilitychange', f); window.removeEventListener('online', f); off() }
  }, [enabled, run])

  return { enabled, status, syncNow: () => run(), enable: (info, mode = 'normal') => { first.current = mode; setSync(info) } }
}
