// Encryption for synced data (not used by the app screens yet; the sync engine will build on it).
//
// Everything is encrypted on the device before it is uploaded, so the server only ever holds scrambled
// bytes. The design mirrors the PIN lock, but with its own, separate key:
//
//   - A random sync key encrypts every record.
//   - That key is stored in the cloud twice, wrapped by a key made from the sync passphrase and by one
//     made from a recovery code. Either one can open it, so a new phone only needs the passphrase, and
//     a forgotten passphrase can be recovered with the code.
//   - The PIN is only a screen lock. It never protects synced data.
//
// What the server can see: how many records exist, their random ids, which collection they belong to,
// and when they last changed (a merge needs those). It cannot read or alter the contents: each record
// is bound to its own id, collection and timestamp, so swapping or editing records is detected.

const ITER = 300000
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = b => { const u = new Uint8Array(b); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s) }
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const rnd = n => crypto.getRandomValues(new Uint8Array(n))
const normPass = s => String(s).normalize('NFKC')                           // case counts; look-alike characters are unified
const normCode = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '')    // recovery codes ignore case, spaces and dashes
const newCode = () => [...rnd(16)].map(b => ALPHA[b % 32]).join('').replace(/(.{4})(?=.)/g, '$1-')
const aad = (c, id, u) => enc.encode(`${c}|${id}|${u}`)

async function kdf(str, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(str), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
async function wrap(key, secret, norm) {
  const salt = rnd(16), iv = rnd(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await kdf(norm(secret), salt), await crypto.subtle.exportKey('raw', key))
  return { salt: b64(salt), iv: b64(iv), wrap: b64(ct) }
}
const importKey = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])

// Returns a message if the passphrase is too weak, otherwise ''.
export function passphraseProblem(p) {
  if (!p || String(p).length < 10) return 'Use at least 10 characters.'
  if (new Set(String(p)).size < 5) return 'Use a more varied passphrase.'
  return ''
}

// First time sync is turned on. `meta` is safe to store in the cloud; `key` stays in memory;
// `recoveryCode` is shown to the person once.
export async function createSyncKey(passphrase) {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const recoveryCode = newCode()
  return { key, recoveryCode, meta: { v: 1, pass: await wrap(key, passphrase, normPass), rec: await wrap(key, recoveryCode, normCode) } }
}

// Opens the sync key on a device with the passphrase (kind 'pass') or the recovery code (kind 'rec').
export async function openSyncKey(meta, secret, kind = 'pass') {
  try {
    const w = meta[kind]
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(w.iv) }, await kdf((kind === 'pass' ? normPass : normCode)(secret), unb64(w.salt)), unb64(w.wrap))
    return await importKey(raw)
  } catch { throw new Error(kind === 'pass' ? 'Wrong passphrase' : 'Wrong recovery code') }
}

export async function changePassphrase(meta, key, newPassphrase) {
  return { ...meta, pass: await wrap(key, newPassphrase, normPass) }
}

// A fresh recovery code; the old one stops working.
export async function newRecoveryCode(meta, key) {
  const code = newCode()
  return { code, meta: { ...meta, rec: await wrap(key, code, normCode) } }
}

// ---- Records ----------------------------------------------------------------------------------
// `c` is the collection ('txs', 'pockets', ...). The envelope keeps id, collection and time readable
// and encrypts everything else.

export async function sealRecord(key, c, rec) {
  const u = rec.updatedAt || '', iv = rnd(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(c, rec.id, u) }, key, enc.encode(JSON.stringify(rec)))
  return { c, id: rec.id, u, iv: b64(iv), ct: b64(ct) }
}

// Throws if the record was changed, moved to another id/collection, or encrypted with another key.
export async function openRecord(key, env) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: aad(env.c, env.id, env.u) }, key, unb64(env.ct))
  return JSON.parse(dec.decode(pt))
}

// A tombstone says "this record was deleted" and holds nothing secret.
export const sealTomb = t => ({ c: t.c, id: t.id, u: t.at, del: true })
export const openTomb = env => ({ c: env.c, id: env.id, at: env.u })

export const COLLECTIONS = ['pockets', 'txs', 'goals', 'cats', 'shop', 'recurring']

// All of a person's data as envelopes. data = { pockets, txs, goals, cats, shop, recurring, budgets, tombs }.
export async function sealAll(key, data) {
  const out = []
  for (const c of COLLECTIONS) for (const r of data[c] || []) out.push(await sealRecord(key, c, r))
  if (data.budgets) out.push(await sealRecord(key, 'budgets', { id: 'budgets', limits: data.budgets, updatedAt: data.budgetsUpdatedAt || '' }))
  for (const t of data.tombs || []) out.push(sealTomb(t))
  return out
}

// The reverse. Records that cannot be opened (tampered with, or from another key) are listed in `bad`
// instead of stopping everything.
export async function openAll(key, envelopes) {
  const data = { tombs: [] }, bad = []
  for (const c of COLLECTIONS) data[c] = []
  for (const env of envelopes) {
    if (env.del) { data.tombs.push(openTomb(env)); continue }
    try {
      const r = await openRecord(key, env)
      if (env.c === 'budgets') { data.budgets = r.limits; data.budgetsUpdatedAt = r.updatedAt || '' }
      else if (data[env.c]) data[env.c].push(r)
      else bad.push({ c: env.c, id: env.id, why: 'unknown collection' })
    } catch { bad.push({ c: env.c, id: env.id, why: 'could not be opened' }) }
  }
  return { data, bad }
}

// The sync key as text, so a signed-in device can keep it between app starts (it is saved with the rest of the
// app's data, so the PIN lock protects it the same way).
export const exportSyncKey = async key => b64(await crypto.subtle.exportKey('raw', key))
export const importSyncKey = s => importKey(unb64(s))
