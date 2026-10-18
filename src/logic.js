// Plain helpers with no React in them, kept separate so they are easy to test.

const pad = n => String(n).padStart(2, '0')
const DAY = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Local calendar day as yyyy-mm-dd
export const ymd = d => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }

// Calendar month (yyyy-mm) of a timestamp in local time. Reading the month straight off the UTC
// string puts entries made just after midnight (or just before it, west of UTC) in the wrong month.
export const monthKey = d => ymd(d).slice(0, 7)

// Turns a chosen day into a timestamp. Keeps the original time if the day is unchanged,
// uses the current time for today, and noon for any other day.
export const toISO = (day, orig) => {
  if (orig && ymd(orig) === day) return orig
  if (day === ymd(new Date())) return new Date().toISOString()
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12).toISOString()
}

// The days a recurring rule is due, from its start up to `upTo` (yyyy-mm-dd),
// leaving out anything already posted (on or before rule.last).
// rule = { freq: 'weekly' | 'monthly', day, start, last }. Weekly day is 0-6 (Sunday = 0).
// Monthly day is 1-31; short months use their last day.
export function dueDates(r, upTo) {
  const out = []
  if (!DAY.test(r.start || '')) return out
  const seen = ds => !r.last || ds > r.last
  if (r.freq === 'weekly') {
    const [y, m, d] = r.start.split('-').map(Number)
    const dt = new Date(y, m - 1, d, 12)
    const wd = Number.isInteger(r.day) && r.day >= 0 && r.day <= 6 ? r.day : dt.getDay()
    while (dt.getDay() !== wd) dt.setDate(dt.getDate() + 1)
    for (; ymd(dt) <= upTo && out.length < 400; dt.setDate(dt.getDate() + 7)) if (seen(ymd(dt))) out.push(ymd(dt))
  } else {
    let [y, m] = r.start.split('-').map(Number)
    const day = Number.isInteger(r.day) && r.day >= 1 && r.day <= 31 ? r.day : Number(r.start.slice(8))
    while (out.length < 400) {
      const ds = `${y}-${pad(m)}-${pad(Math.min(day, new Date(y, m, 0).getDate()))}`
      if (ds > upTo) break
      if (ds >= r.start && seen(ds)) out.push(ds)
      if (++m > 12) { m = 1; y++ }
    }
  }
  return out
}

const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
export const describeRule = r => r.freq === 'weekly' ? `every ${WEEKDAYS[r.day]}` : `monthly on the ${ordinal(r.day)}`

export const wrapBackup = data => ({ app: 'budgie', version: 1, exported: new Date().toISOString(), data })

// Returns '' if the data looks like a usable backup, otherwise a message for the user.
export function checkBackup(d) {
  if (!d || typeof d !== 'object') return "That doesn't look like a Budgie backup."
  if (!Array.isArray(d.pockets) || !d.pockets.length || d.pockets.some(p => !p || typeof p.name !== 'string' || typeof p.balance !== 'number')) return 'The accounts in this file look wrong.'
  if (!Array.isArray(d.txs) || d.txs.some(t => !t || typeof t.amount !== 'number' || typeof t.date !== 'string' || typeof t.pocket !== 'string')) return 'The transactions in this file look wrong.'
  if (d.budgets != null && (typeof d.budgets !== 'object' || Array.isArray(d.budgets))) return 'The budgets in this file look wrong.'
  for (const k of ['goals', 'cats', 'shop', 'recurring']) if (d[k] != null && !Array.isArray(d[k])) return `The ${k} in this file look wrong.`
  return ''
}
