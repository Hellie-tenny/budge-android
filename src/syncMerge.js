// Merging two copies of a person's data (no React, no network, easy to test).
// The rule for every record: the copy with the newer `updatedAt` wins. A deletion note (tombstone) beats a
// record that is not newer than it. Budgets are one block with their own timestamp.

import { COLLECTIONS } from './syncCrypto.js'

export const key = (c, id) => c + '|' + id
const ts = r => r.updatedAt || ''

export function mergeSync(local, remote) {
  const out = {}, tomb = new Map()
  for (const t of [...(local.tombs || []), ...(remote.tombs || [])]) { const k = key(t.c, t.id), o = tomb.get(k); if (!o || t.at > o.at) tomb.set(k, t) }
  const kept = new Set()
  for (const c of COLLECTIONS) {
    const m = new Map()
    for (const r of local[c] || []) m.set(r.id, r)
    for (const r of remote[c] || []) { const o = m.get(r.id); if (!o || ts(r) > ts(o)) m.set(r.id, r) }
    out[c] = [...m.values()].filter(r => { const t = tomb.get(key(c, r.id)); if (t && ts(r) <= t.at) return false; kept.add(key(c, r.id)); return true })
  }
  out.tombs = [...tomb.values()].filter(t => !kept.has(key(t.c, t.id))).sort((a, b) => a.at.localeCompare(b.at)).slice(-5000)
  const lu = local.budgetsUpdatedAt || '', ru = remote.budgets !== undefined ? remote.budgetsUpdatedAt || '' : null
  if (ru !== null && ru > lu) { out.budgets = remote.budgets; out.budgetsUpdatedAt = ru } else { out.budgets = local.budgets || {}; out.budgetsUpdatedAt = lu }
  return out
}

// First time on a device that has nothing worth keeping: take the synced data as it is.
export function adoptRemote(local, remote) {
  const out = { tombs: remote.tombs || [] }
  for (const c of COLLECTIONS) out[c] = remote[c]?.length ? remote[c] : local[c] || []
  out.budgets = remote.budgets !== undefined ? remote.budgets : local.budgets || {}
  out.budgetsUpdatedAt = remote.budgets !== undefined ? remote.budgetsUpdatedAt || '' : local.budgetsUpdatedAt || ''
  return out
}

// First time on a device that has its own data: keep both. Accounts are matched by name (transactions refer to
// them by name), so a starter "Cash" here and a synced "Cash" become one account instead of two.
export function combineFirst(local, remote) {
  const names = new Set((remote.pockets || []).map(p => p.name.trim().toLowerCase()))
  return mergeSync({ ...local, pockets: (local.pockets || []).filter(p => !names.has(p.name.trim().toLowerCase())) }, remote)
}

export const resolve = (local, remote, mode) => mode === 'replace' ? adoptRemote(local, remote) : mode === 'combine' ? combineFirst(local, remote) : mergeSync(local, remote)

// What still has to be uploaded: records whose version is not the one known to be in the cloud.
export function pendingUploads(data, map) {
  const out = []
  for (const c of COLLECTIONS) for (const r of data[c] || []) if (map[key(c, r.id)] !== ts(r)) out.push({ c, rec: r })
  if ((data.budgetsUpdatedAt || Object.keys(data.budgets || {}).length) && map[key('budgets', 'budgets')] !== (data.budgetsUpdatedAt || '')) out.push({ c: 'budgets', rec: { id: 'budgets', limits: data.budgets || {}, updatedAt: data.budgetsUpdatedAt || '' } })
  for (const t of data.tombs || []) if (map[key(t.c, t.id)] !== 'd' + t.at) out.push({ tomb: t })
  return out
}
export const sigOf = e => e.del ? 'd' + e.u : e.u || ''
