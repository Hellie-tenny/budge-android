import { useState, useEffect, useCallback } from 'react'

export const PIN_LEN = 4              // 6 makes offline guessing far harder
export const LOCK_AFTER_MS = 30000    // lock after being away this long (0 = immediately)
export const REVEAL_MS = 60000        // amounts hide again this long after a reveal
export const REVEAL_ON_UNLOCK = false // true = opening the app with the PIN also shows amounts

// mk() in App.jsx reads this flag. Budgie sets it on every render.
export const mask = { on: false }

// How it works: all budgie.* data is encrypted (AES-GCM) with a random data key.
// That key is stored twice, wrapped by a key made from the PIN and by one made from a
// recovery code. Either one can open it, so forgetting the PIN no longer means losing data.
const META = 'budgie.vault', FAIL = 'budgie.pinFail', ITER = 300000
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = b => { const u = new Uint8Array(b); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s) }
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const rnd = n => crypto.getRandomValues(new Uint8Array(n))
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const readMeta = () => { const m = read(META, null); return m?.v === 2 ? m : null }
const writeMeta = m => localStorage.setItem(META, JSON.stringify(m))
const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '')
const newCode = () => [...rnd(16)].map(b => ALPHA[b % 32]).join('').replace(/(.{4})(?=.)/g, '$1-')
const dataKeys = () => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(k => k.startsWith('budgie.') && k !== META && k !== FAIL)
try { localStorage.removeItem('budgie.pin') } catch { /* first-version PIN record, data was never encrypted */ }

export const hasPin = () => !!readMeta()

let dek = null, chain = Promise.resolve()
const cache = new Map()

async function kek(secret, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(norm(secret)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
async function wrap(key, secret) {
  const salt = rnd(16), iv = rnd(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await kek(secret, salt), await crypto.subtle.exportKey('raw', key))
  return { salt: b64(salt), iv: b64(iv), wrap: b64(ct) }
}
async function seal(text, key) {
  const iv = rnd(12)
  return 'enc:' + b64(iv) + ':' + b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)))
}
async function unseal(s, key = dek) {
  const [, iv, ct] = s.split(':')
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct)))
}

// Tries a PIN or recovery code. 5 wrong tries in a row = 30s lockout, growing each round.
async function attempt(secret, kind) {
  if (!crypto.subtle) throw new Error('Needs HTTPS')
  const f = read(FAIL, { n: 0, until: 0 })
  const wait = Math.ceil((f.until - Date.now()) / 1000)
  if (wait > 0) return { error: `Too many tries. Wait ${wait}s.` }
  try {
    const w = readMeta()[kind]
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(w.iv) }, await kek(secret, unb64(w.salt)), unb64(w.wrap))
    localStorage.removeItem(FAIL)
    return { raw }
  } catch {
    const n = f.n + 1, lock = n % 5 === 0 ? 30 * (n / 5) : 0
    localStorage.setItem(FAIL, JSON.stringify({ n, until: lock ? Date.now() + lock * 1000 : 0 }))
    return { error: lock ? `Too many tries. Wait ${lock}s.` : kind === 'pin' ? 'Wrong PIN' : 'Wrong recovery code' }
  }
}

export async function checkPin(pin) {
  const r = await attempt(pin, 'pin')
  return r.raw ? { ok: true } : { ok: false, error: r.error }
}

// Opens the vault (kind 'pin' or 'rec') and decrypts everything into memory.
export async function unlock(secret, kind = 'pin') {
  const r = await attempt(secret, kind)
  if (!r.raw) return { ok: false, error: r.error }
  dek = await crypto.subtle.importKey('raw', r.raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
  await chain
  cache.clear()
  for (const k of dataKeys()) {
    const raw = localStorage.getItem(k)
    try { cache.set(k, JSON.parse(raw.startsWith('enc:') ? await unseal(raw) : raw)) } catch { /* unreadable, skip */ }
  }
  return { ok: true }
}

export function lock() { dek = null; cache.clear() }

// Turn the lock on: creates the data key, encrypts existing data, returns the recovery code (show it once).
export async function enablePin(pin) {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const code = newCode()
  await chain
  writeMeta({ v: 2, pin: await wrap(key, pin), rec: await wrap(key, code) }) // key is safe on disk before any data is touched
  dek = key
  for (const k of dataKeys()) {
    const raw = localStorage.getItem(k)
    if (!raw.startsWith('enc:')) localStorage.setItem(k, await seal(raw, key))
  }
  return code
}

export async function changePin(pin) {
  writeMeta({ ...readMeta(), pin: await wrap(dek, pin) })
}

export async function newRecovery() {
  const code = newCode()
  writeMeta({ ...readMeta(), rec: await wrap(dek, code) })
  return code
}

// Turn the lock off: decrypts everything back to plain storage.
export async function disablePin() {
  await chain
  for (const k of dataKeys()) {
    const raw = localStorage.getItem(k)
    if (raw.startsWith('enc:')) localStorage.setItem(k, await unseal(raw))
  }
  localStorage.removeItem(META); localStorage.removeItem(FAIL)
  lock()
}

// Storage used by useStore in App.jsx
export function vaultGet(key, init) {
  if (cache.has(key)) return cache.get(key)
  const raw = localStorage.getItem(key)
  if (raw && !raw.startsWith('enc:')) { try { return JSON.parse(raw) ?? init } catch { /* fall through */ } }
  return init
}

export function vaultPut(key, value) {
  const text = JSON.stringify(value)
  if (!readMeta()) { localStorage.setItem(key, text); return }
  if (!dek) return // locked: never write over encrypted data
  const k = dek
  chain = chain.then(() => seal(text, k)).then(s => localStorage.setItem(key, s)).catch(() => {})
}

// onDone(pin) -> Promise of an error message, or nothing on success
export function PinPad({ title, hint, onDone }) {
  const [pin, setPin] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const press = useCallback(d => { if (!busy) setPin(p => (p.length < PIN_LEN ? p + d : p)) }, [busy])
  useEffect(() => {
    const k = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') setPin(p => p.slice(0, -1)) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [press])
  useEffect(() => {
    if (pin.length !== PIN_LEN) return
    setBusy(true)
    onDone(pin).catch(() => 'Something went wrong').then(msg => { setErr(msg || ''); setPin(''); setBusy(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])
  return (
    <div className="w-full text-center">
      <h3 className="font-semibold">{title}</h3>
      <p className={'mt-1 h-5 text-sm ' + (err ? 'text-down' : 'text-slate-500')}>{err || hint}</p>
      <div className="my-5 flex justify-center gap-4">
        {Array.from({ length: PIN_LEN }, (_, i) => <span key={i} className={'h-3.5 w-3.5 rounded-full border-2 border-azure ' + (i < pin.length ? 'bg-azure' : '')} />)}
      </div>
      <div className="mx-auto grid max-w-64 grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === '' ? <span key={i} /> :
          <button key={k} onClick={() => k === '⌫' ? setPin(p => p.slice(0, -1)) : press(k)} className="h-14 rounded-full bg-paper text-xl font-semibold active:scale-95">{k}</button>)}
      </div>
    </div>
  )
}

// A PinPad that checks the saved PIN. With `open`, it also unlocks and loads the data.
export const PinCheck = ({ title = 'Enter your PIN', hint, onOk, open }) =>
  <PinPad title={title} hint={hint} onDone={async pin => { const r = await (open ? unlock(pin) : checkPin(pin)); if (r.ok) await onOk(); return r.error }} />

export function LockScreen({ onUnlock }) {
  const [mode, setMode] = useState('pin'), [code, setCode] = useState(''), [first, setFirst] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const recover = async () => {
    setBusy(true)
    const r = await unlock(code, 'rec').catch(() => ({ error: 'Something went wrong' }))
    setBusy(false)
    if (r.ok) { setErr(''); setMode('new') } else setErr(r.error)
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-paper px-6">
      <div className="w-full max-w-xs">
        <p className="mb-8 text-center text-3xl font-bold text-navy">Budgie</p>
        {mode === 'pin' && <>
          <PinCheck open hint="to open the app" onOk={onUnlock} />
          <button onClick={() => setMode('rec')} className="mt-6 w-full text-sm font-semibold text-azure">Forgot PIN?</button>
        </>}
        {mode === 'rec' && <div className="space-y-3 text-center">
          <h3 className="font-semibold">Recovery code</h3>
          <p className={'text-sm ' + (err ? 'text-down' : 'text-slate-500')}>{err || 'Enter the code you saved when you set your PIN.'}</p>
          <input autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters" className="w-full rounded-2xl bg-surface px-4 py-3 text-center font-mono tracking-wider outline-none focus:ring-2 focus:ring-azure/40" />
          <button disabled={busy || norm(code).length < 16} onClick={recover} className="w-full rounded-2xl bg-azure py-3.5 text-lg font-semibold text-white disabled:opacity-40">Continue</button>
          <button onClick={() => { setMode('pin'); setErr('') }} className="text-sm font-semibold text-azure">Back</button>
        </div>}
        {mode === 'new' && <PinPad title="Choose a new PIN" hint={`${PIN_LEN} digits`} onDone={async p => { setFirst(p); setMode('confirm') }} />}
        {mode === 'confirm' && <PinPad title="Confirm new PIN" hint="Enter it again" onDone={async p => { if (p !== first) return 'PINs do not match'; await changePin(p); onUnlock() }} />}
      </div>
    </div>
  )
}
