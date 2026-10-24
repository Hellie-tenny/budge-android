// Talks to Firestore. Everything stored is scrambled on the device first (syncCrypto.js), so the database only
// ever holds ciphertext plus ids, collection names and timestamps.
//   users/{uid}/meta/sync        the wrapped sync key (needs the passphrase or recovery code to open)
//   users/{uid}/records/{c}_{id} one encrypted record, or a deletion note
import { initializeFirestore, doc, getDoc, setDoc, collection, query, where, orderBy, getDocs, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore'
import { app } from './cloud.js'

const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
const metaRef = uid => doc(db, 'users', uid, 'meta', 'sync')
const recs = uid => collection(db, 'users', uid, 'records')
const CHUNK = 400

export async function getMeta(uid) { const s = await getDoc(metaRef(uid)); return s.exists() ? s.data() : null }
export const putMeta = (uid, meta) => setDoc(metaRef(uid), meta)

// Everything that changed on the server since `sat` (a few seconds of overlap is re-read on purpose; it is harmless).
export async function pull(uid, sat) {
  const q = sat ? query(recs(uid), where('sat', '>', new Timestamp(sat.s - 5, sat.n)), orderBy('sat')) : query(recs(uid), orderBy('sat'))
  const snap = await getDocs(q)
  let top = sat || null
  const envs = snap.docs.map(d => {
    const { sat: t, ...e } = d.data()
    if (t && (!top || t.seconds > top.s || (t.seconds === top.s && t.nanoseconds > top.n))) top = { s: t.seconds, n: t.nanoseconds }
    return e
  })
  return { envs, sat: top }
}

export async function push(uid, envs) {
  for (let i = 0; i < envs.length; i += CHUNK) {
    const b = writeBatch(db)
    for (const e of envs.slice(i, i + CHUNK)) b.set(doc(recs(uid), `${e.c}_${e.id}`), { ...e, sat: serverTimestamp() })
    await b.commit()
  }
}

// Removes everything stored in the cloud for this person.
export async function deleteCloudData(uid) {
  const snap = await getDocs(recs(uid))
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const b = writeBatch(db)
    snap.docs.slice(i, i + CHUNK).forEach(d => b.delete(d.ref))
    await b.commit()
  }
  const b = writeBatch(db)
  b.delete(metaRef(uid))
  await b.commit()
}

export function syncMessage(e) {
  const c = e?.code || ''
  if (c.includes('permission')) return 'The cloud storage is not set up to accept this yet. Please try again later.'
  if (c.includes('unavailable') || c.includes('deadline') || /network|offline/i.test(e?.message || '')) return 'No connection right now. Sprout will try again.'
  if (c) return 'Something went wrong while syncing. Please try again.'
  return e?.message || 'Something went wrong while syncing. Please try again.'
}
