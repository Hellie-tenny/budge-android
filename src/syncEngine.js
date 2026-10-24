// One round of syncing: download what changed, merge it with this device's data, upload what the cloud lacks.
// `io` supplies pull(uid, sat) and push(uid, envelopes); the real one talks to Firestore (syncCloud.js).
import { openAll, sealRecord, sealTomb } from './syncCrypto.js'
import { key as k, resolve, pendingUploads, sigOf } from './syncMerge.js'

// `mode` is 'normal', or 'replace' / 'combine' the first time a device joins existing synced data (see syncMerge.js).
export async function syncOnce({ io, uid, key, info, getLocal, mode = 'normal' }) {
  const map = { ...(info.map || {}) }
  const { envs, sat } = await io.pull(uid, info.sat)
  const fresh = envs.filter(e => map[k(e.c, e.id)] !== sigOf(e))
  const { data: remote, bad } = await openAll(key, fresh)
  const isBad = e => bad.some(b => b.c === e.c && b.id === e.id)
  for (const e of fresh) if (!isBad(e)) map[k(e.c, e.id)] = sigOf(e)
  const changed = fresh.some(e => !isBad(e))
  // Merged with the data as it is now, so edits made while this was running are not lost.
  const todo = pendingUploads(resolve(getLocal(), remote, mode), map)
  const up = []
  for (const t of todo) up.push(t.tomb ? sealTomb(t.tomb) : await sealRecord(key, t.c, t.rec))
  if (up.length) await io.push(uid, up)
  for (const e of up) map[k(e.c, e.id)] = sigOf(e)
  return { remote, changed, bad: bad.length, uploaded: up.length, info: { sat, map, last: new Date().toISOString() } }
}
