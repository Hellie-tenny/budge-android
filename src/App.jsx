import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { mask, hasPin, enablePin, changePin, disablePin, newRecovery, vaultGet, vaultPut, lock, PinPad, PinCheck, LockScreen, PIN_LEN, LOCK_AFTER_MS, REVEAL_MS, REVEAL_ON_UNLOCK, sealBackup, openBackup } from './security.jsx'
import { ymd, toISO, dueDates, describeRule, wrapBackup, checkBackup } from './logic.js'

// Categories are saved data (budgie.cats). Transactions store the category id, so renaming never breaks history.
// Starter ids equal their old names, so existing data keeps working. kind: 'out' | 'in' | 'both'.
const DEFAULT_CATS = [
  { id: 'Food', name: 'Food', color: '#e8590c', kind: 'out' },
  { id: 'Transport', name: 'Transport', color: '#1c7ed6', kind: 'out' },
  { id: 'Airtime', name: 'Airtime', color: '#9c36b5', kind: 'out' },
  { id: 'Bills', name: 'Bills', color: '#e03131', kind: 'out' },
  { id: 'Shopping', name: 'Shopping', color: '#d6336c', kind: 'out' },
  { id: 'Health', name: 'Health', color: '#2f9e44', kind: 'out' },
  { id: 'Other', name: 'Other', color: '#868e96', kind: 'both' },
  { id: 'Salary', name: 'Salary', color: '#42a542', kind: 'in' },
  { id: 'Business', name: 'Business', color: '#0ca678', kind: 'in' },
  { id: 'Gift', name: 'Gift', color: '#f59f00', kind: 'in' },
]
const SYSTEM = { Savings: { id: 'Savings', name: 'Savings', color: '#f59f00' }, Transfer: { id: 'Transfer', name: 'Transfer', color: '#3d7ddd' } }
const EMO = { Food: '🍲', Transport: '🚌', Airtime: '📱', Bills: '💡', Shopping: '🛍️', Health: '💊', Other: '🧾', Salary: '💼', Business: '🏪', Gift: '🎁', Savings: '🎯', Transfer: '🔁' }
const PALETTE = ['#e8590c', '#1c7ed6', '#9c36b5', '#e03131', '#d6336c', '#2f9e44', '#f59f00', '#0ca678', '#7048e8', '#868e96']
const QUICK_EMOJI = ['🍲', '🚌', '📱', '💡', '🛍️', '💊', '🎓', '🏠', '🐾', '🎮', '☕', '🧴']
const KIND = { out: 'Expense', in: 'Income', both: 'Both' }
const CatCtx = createContext(null)
const useCats = () => useContext(CatCtx)
const PC = ['#3d7ddd', '#42a542', '#8f8fe0', '#f59f00', '#e8590c']
const mk = n => mask.on ? 'MK ••••' : (n < 0 ? '-MK ' : 'MK ') + Math.abs(Math.round(n)).toLocaleString()
const uid = () => Math.random().toString(36).slice(2, 9)
const month = d => d.slice(0, 7)
const mKey = (off = 0) => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - off); return d.toISOString().slice(0, 7) }
const thisMonth = () => mKey(0)
const net = t => (t.type === 'in' ? t.amount : t.type === 'out' || t.type === 'sv' ? -t.amount : 0)
const tint = (t, c) => (t.type === 'out' ? c.color : t.type === 'in' ? '#42a542' : t.type === 'sv' ? '#f59f00' : '#3d7ddd')
const dayLabel = iso => {
  const d = new Date(iso), n = new Date(), y = new Date(); y.setDate(n.getDate() - 1)
  return d.toDateString() === n.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function useStore(key, init) {
  const [v, setV] = useState(() => vaultGet(key, init))
  useEffect(() => { vaultPut(key, v) }, [key, v])
  return [v, setV]
}

const Card = ({ children, className = '' }) => <div className={'rounded-3xl border border-black/5 bg-surface p-4 dark:border-white/5 ' + className}>{children}</div>
const CI = {
  Food: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7',
  Transport: 'M5 3h14a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2zM3 12h18M8 7h.01M16 7h.01M7 19v2M17 19v2',
  Airtime: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
  Bills: 'M13 2L3 14h9l-1 8 10-12h-9z',
  Shopping: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  Health: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  Other: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  Salary: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  Business: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  Gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  Savings: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  Transfer: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
}
const Chip = ({ id, color }) => {
  const c = useCats().get(id), col = color || c.color
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: col + '26', color: col }}>
      {c.emoji ? <span className="text-xl leading-none">{c.emoji}</span> : CI[c.id] ? <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={CI[c.id]} /></svg> : <b>{c.name[0]?.toUpperCase()}</b>}
    </span>
  )
}
const field = 'w-full rounded-2xl bg-paper px-4 py-3 outline-none focus:ring-2 focus:ring-azure/40'

function TxRow({ t, onDelete, onEdit }) {
  const c = useCats().get(t.category)
  const title = t.type === 'tr' ? 'Transfer' : t.note || c.name
  const sub = t.type === 'tr' ? `${t.pocket} to ${t.to}` : `${c.name} · ${t.pocket}`
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Chip id={t.category} color={tint(t, c)} />
      <div className="min-w-0 flex-1"><p className="truncate font-medium">{title}</p><p className="truncate text-xs text-slate-500">{sub}</p></div>
      <div className="text-right">
        <p className={'font-semibold ' + (t.type === 'in' ? 'text-up' : t.type === 'out' ? '' : 'text-azure')}>{t.type === 'in' ? '+' : t.type === 'out' ? '-' : ''}{mk(t.amount)}</p>
        {(onDelete || onEdit) && <div className="flex justify-end gap-3 text-xs">
          {onEdit && t.type !== 'sv' && <button className="text-azure" onClick={() => onEdit(t)}>Edit</button>}
          {onDelete && <button className="text-down" onClick={() => confirm('Delete this transaction?') && onDelete(t)}>Delete</button>}
        </div>}
      </div>
    </div>
  )
}

function Donut({ data }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  let acc = 0
  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0 -rotate-90">
      <circle cx="50" cy="50" r="38" fill="none" stroke="#d7d7dd" opacity=".4" strokeWidth="14" />
      {data.map(d => { const len = (d.value / total) * 238.76; const el = <circle key={d.id} cx="50" cy="50" r="38" fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${len} 238.76`} strokeDashoffset={-acc} />; acc += len; return el })}
    </svg>
  )
}

function Home({ pockets, txs, budgets, setTab, onAccount }) {
  const { get } = useCats()
  const total = pockets.reduce((a, p) => a + p.balance, 0)
  const m = txs.filter(t => month(t.date) === thisMonth())
  const inc = m.filter(t => t.type === 'in').reduce((a, t) => a + t.amount, 0)
  const spent = m.filter(t => t.type === 'out')
  const out = spent.reduce((a, t) => a + t.amount, 0)
  const byCat = [...new Set(spent.map(t => t.category))].map(id => ({ id, name: get(id).name, color: get(id).color, value: spent.filter(t => t.category === id).reduce((a, t) => a + t.amount, 0) })).filter(d => d.value > 0).sort((a, b) => b.value - a.value)
  const lastOut = txs.filter(t => t.type === 'out' && month(t.date) === mKey(1)).reduce((a, t) => a + t.amount, 0)
  const over = Object.entries(budgets).filter(([c, l]) => l > 0 && (byCat.find(d => d.id === c)?.value || 0) > l).map(([c]) => c)
  const limit = Object.values(budgets).reduce((a, b) => a + b, 0)
  const used = Object.entries(budgets).filter(([, l]) => l > 0).reduce((a, [c]) => a + (byCat.find(d => d.id === c)?.value || 0), 0)
  const now = new Date(), left = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
  return (
    <div className="space-y-4">
      <section className="pt-1">
        <p className="text-sm text-slate-500">Total balance</p>
        <p className="text-5xl font-bold leading-tight tracking-tight">{mk(total)}</p>
        <p className="mt-1 text-sm text-slate-500"><span className="font-semibold text-up">+{mk(inc)}</span> in · <span className="font-semibold">-{mk(out)}</span> out this month</p>
        {limit > 0 && <p className="mt-3 inline-block rounded-full bg-azure/10 px-3 py-1.5 text-sm font-medium text-azure">{used >= limit ? 'Budget used up for this month' : `${mk((limit - used) / left)} a day to stay on budget`}</p>}
      </section>
      <Card className="py-2">
        {pockets.map((p, i) => <div key={p.id} className="flex items-center gap-3 py-3"><span className="h-3 w-3 rounded-full" style={{ background: PC[i % 5] }} /><span className="flex-1">{p.name}</span><span className="font-semibold">{mk(p.balance)}</span></div>)}
        <button onClick={onAccount} className="w-full border-t border-black/5 pt-3 text-left text-sm font-semibold text-azure dark:border-white/5">+ Add account</button>
      </Card>
      {over.length > 0 && <div className="rounded-2xl bg-down/10 p-3 text-sm text-down">Over budget: {over.map(c => get(c).name).join(', ')}</div>}
      <Card>
        <h3 className="mb-3 font-semibold">Where your money went</h3>
        {byCat.length === 0 ? <p className="text-sm text-slate-500">No spending yet this month. Tap + to add an expense.</p> : (
          <div className="flex items-center gap-4">
            <Donut data={byCat} />
            <ul className="flex-1 space-y-1.5 text-sm">{byCat.map(d => <li key={d.id} className="flex justify-between"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span><span>{mk(d.value)}</span></li>)}</ul>
          </div>
        )}
        {lastOut > 0 && <p className="mt-3 text-sm text-slate-500">{out <= lastOut ? `${mk(lastOut - out)} less` : `${mk(out - lastOut)} more`} than last month.</p>}
      </Card>
      {txs.length > 0 && <Card>
        <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold">Recent</h3><button onClick={() => setTab('activity')} className="text-sm font-semibold text-azure">See all</button></div>
        <div className="divide-y divide-black/5 dark:divide-white/5">{txs.slice(0, 4).map(t => <TxRow key={t.id} t={t} />)}</div>
      </Card>}
    </div>
  )
}

function Activity({ txs, onDelete, onEdit }) {
  const { get } = useCats()
  const [q, setQ] = useState(''), [f, setF] = useState('all')
  const list = txs.filter(t => (f === 'all' || t.type === f) && ((t.note || '') + get(t.category).name + t.pocket + (t.to || '')).toLowerCase().includes(q.toLowerCase()))
  let last = ''
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search transactions" className={field + ' bg-surface'} />
      <div className="my-3 flex gap-2">{[['all', 'All'], ['in', 'Income'], ['out', 'Expenses']].map(([k, l]) => <button key={k} onClick={() => setF(k)} className={'rounded-full px-4 py-1.5 text-sm font-medium ' + (f === k ? 'bg-azure text-white' : 'bg-surface text-slate-500')}>{l}</button>)}</div>
      {!list.length && <p className="mt-10 text-center text-slate-500">{txs.length ? 'Nothing matches.' : 'No transactions yet. Tap + to add one.'}</p>}
      {list.map(t => { const l = dayLabel(t.date), head = l !== last; last = l; return <div key={t.id}>{head && <p className="mb-1 mt-4 text-sm font-semibold text-slate-500">{l}</p>}<Card className="py-0.5! mb-2"><TxRow t={t} onDelete={onDelete} onEdit={onEdit} /></Card></div> })}
    </div>
  )
}

function Insights({ txs, pockets }) {
  const [which, setWhich] = useState(0)
  const { get } = useCats()
  const months = [5, 4, 3, 2, 1, 0].map(o => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - o); return { key: d.toISOString().slice(0, 7), label: d.toLocaleString('en', { month: 'short' }) } })
  if (!txs.length) return <p className="mt-10 text-center text-slate-500">Add a few transactions and your charts will show up here.</p>
  const sum = (key, type) => txs.filter(t => month(t.date) === key && t.type === type).reduce((a, t) => a + t.amount, 0)
  const data = months.map(m => ({ ...m, inc: sum(m.key, 'in'), out: sum(m.key, 'out') }))
  const max = Math.max(1, ...data.flatMap(d => [d.inc, d.out]))
  const total = pockets.reduce((a, p) => a + p.balance, 0)
  const bal = months.map(m => total - txs.filter(t => month(t.date) > m.key).reduce((a, t) => a + net(t), 0))
  const lo = Math.min(...bal), hi = Math.max(...bal)
  const pts = bal.map((v, i) => [30 + i * 48, 100 - ((v - lo) / (hi - lo || 1)) * 80])
  const inMonth = txs.filter(t => t.type === 'out' && month(t.date) === mKey(which))
  const cats = [...new Set(inMonth.map(t => t.category))].map(c => ({ c, v: inMonth.filter(t => t.category === c).reduce((a, t) => a + t.amount, 0) })).filter(d => d.v > 0).sort((a, b) => b.v - a.v)
  const lab = { fontSize: 10, fill: '#868e96' }
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">Income and spending</h3>
        <svg viewBox="0 0 300 140" className="mt-2 w-full">
          {data.map((d, i) => <g key={d.key}>
            <rect x={14 + i * 48} y={110 - (d.inc / max) * 100} width="14" height={(d.inc / max) * 100} rx="4" fill="#42a542" />
            <rect x={30 + i * 48} y={110 - (d.out / max) * 100} width="14" height={(d.out / max) * 100} rx="4" fill="#ec4c4c" />
            <text x={30 + i * 48} y="130" textAnchor="middle" {...lab}>{d.label}</text>
          </g>)}
        </svg>
        <p className="flex gap-4 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-up" />Income</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-down" />Spending</span></p>
      </Card>
      <Card>
        <h3 className="font-semibold">Balance over time</h3>
        <svg viewBox="0 0 300 130" className="mt-2 w-full">
          <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="#3d7ddd" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="4" fill="#3d7ddd" /><text x={p[0]} y="125" textAnchor="middle" {...lab}>{months[i].label}</text></g>)}
        </svg>
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">By category</h3>
          <div className="flex gap-1 rounded-xl bg-paper p-1 text-xs font-semibold">{['This month', 'Last month'].map((l, i) => <button key={l} onClick={() => setWhich(i)} className={'rounded-lg px-2.5 py-1 ' + (which === i ? 'bg-azure text-white' : 'text-slate-500')}>{l}</button>)}</div>
        </div>
        {!cats.length && <p className="text-sm text-slate-500">No spending in this month.</p>}
        <div className="space-y-3">{cats.map(d => <div key={d.c}>
          <div className="flex justify-between text-sm"><span>{get(d.c).emoji || EMO[d.c]} {get(d.c).name}</span><span>{mk(d.v)}</span></div>
          <div className="mt-1 h-2.5 rounded-full bg-mist/40"><div className="h-2.5 rounded-full" style={{ width: (d.v / cats[0].v) * 100 + '%', background: get(d.c).color }} /></div>
        </div>)}</div>
      </Card>
    </div>
  )
}

function Budgets({ budgets, setBudgets, txs, onManage }) {
  const { active } = useCats()
  const spent = c => txs.filter(t => t.type === 'out' && t.category === c && month(t.date) === thisMonth()).reduce((a, t) => a + t.amount, 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Set a monthly limit for each category. Leave it empty for no limit.</p>
        <button onClick={onManage} className="shrink-0 text-sm font-semibold text-azure">Edit categories</button>
      </div>
      {active('out').map(({ id: c, name, color }) => {
        const lim = budgets[c] || 0, s = spent(c), pct = lim ? Math.min(100, (s / lim) * 100) : 0, bad = lim && s > lim
        return (
          <Card key={c}>
            <div className="flex items-center gap-3">
              <Chip id={c} /><span className="flex-1 font-medium">{name}</span>
              <input type="number" inputMode="numeric" value={mask.on ? '' : lim || ''} placeholder={mask.on ? '••••' : 'No limit'} disabled={mask.on} onChange={e => setBudgets({ ...budgets, [c]: Number(e.target.value) })} className="w-28 rounded-xl bg-paper px-3 py-1.5 text-right outline-none focus:ring-2 focus:ring-azure/40" />
            </div>
            <div className="mt-3 h-2 rounded-full bg-mist/40"><div className="h-2 rounded-full" style={{ width: pct + '%', background: bad ? '#ec4c4c' : color }} /></div>
            <p className={'mt-1 text-xs ' + (bad ? 'text-down' : 'text-slate-500')}>{mk(s)} spent{lim ? ` of ${mk(lim)}` : ''}</p>
          </Card>
        )
      })}
    </div>
  )
}

function Goals({ goals, setGoals, onFund }) {
  const [name, setName] = useState(''), [target, setTarget] = useState('')
  const add = () => { if (!name || !Number(target)) return; setGoals([...goals, { id: uid(), name, target: Number(target), saved: 0 }]); setName(''); setTarget('') }
  return (
    <div className="space-y-3">
      <Card className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Goal, e.g. Laptop" className={field + ' min-w-0 flex-1 py-2!'} />
        <input value={target} type="number" inputMode="numeric" onChange={e => setTarget(e.target.value)} placeholder="Target" className={field + ' w-24! py-2!'} />
        <button onClick={add} className="rounded-2xl bg-azure px-4 font-semibold text-white">Add</button>
      </Card>
      {goals.length === 0 && <p className="mt-6 text-center text-slate-500">Add something you're saving for.</p>}
      {goals.map(g => {
        const pct = Math.min(100, (g.saved / g.target) * 100)
        return (
          <Card key={g.id}>
            <div className="flex justify-between"><span className="font-semibold">🎯 {g.name}</span><span className="text-sm font-semibold text-azure">{Math.round(pct)}%</span></div>
            <div className="my-3 h-3 rounded-full bg-mist/40"><div className="h-3 rounded-full bg-azure" style={{ width: pct + '%' }} /></div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{mk(g.saved)} of {mk(g.target)}</span>
              <span className="flex gap-4"><button className="font-semibold text-azure" onClick={() => onFund(g)}>Add funds</button><button className="text-down" onClick={() => confirm('Delete goal?') && setGoals(goals.filter(x => x.id !== g.id))}>Delete</button></span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

const Sheet = ({ children, onClose }) => (
  <div className="fade-in fixed inset-0 z-30 flex items-end bg-black/50" onClick={onClose}>
    <div className="sheet-in mx-auto w-full max-w-md max-h-[92dvh] space-y-3 overflow-y-auto rounded-t-[2rem] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
      <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-mist" />{children}
    </div>
  </div>
)
const Save = ({ onClick, children, off }) => <button disabled={off} onClick={onClick} className="w-full rounded-2xl bg-azure py-3.5 text-lg font-semibold text-white disabled:opacity-40">{children}</button>
const Amount = ({ value, onChange }) => <input autoFocus type="number" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} placeholder="MK 0" className="w-full bg-transparent py-3 text-center text-4xl font-bold outline-none placeholder:text-mist" />
const Pick = ({ value, onChange, pockets, label }) => <label className="block text-xs text-slate-500">{label}<select value={value} onChange={e => onChange(e.target.value)} className={field + ' mt-1 text-base text-ink'}>{pockets.map(p => <option key={p.id}>{p.name}</option>)}</select></label>

function AddSheet({ pockets, txs, edit, onSave, onNewCat, onClose }) {
  const { pick, get } = useCats()
  const [type, setType] = useState(edit?.type || 'out'), [amount, setAmount] = useState(edit ? String(edit.amount) : ''), [pocket, setPocket] = useState(edit?.pocket || pockets[0].name), [to, setTo] = useState(edit?.to || (pockets[1] || pockets[0]).name)
  const [category, setCategory] = useState(() => (edit && edit.type !== 'tr' ? edit.category : pick('out')[0]?.id || 'Other')), [note, setNote] = useState(edit?.note || ''), [adding, setAdding] = useState(false), [day, setDay] = useState(ymd(edit?.date || new Date()))
  const today = ymd(new Date())
  const bad = !(Number(amount) > 0) || (type === 'tr' && pocket === to) || !day || day > today
  const save = () => onSave({ ...(edit || {}), id: edit?.id || uid(), type, amount: Number(amount), pocket, ...(type === 'tr' ? { to, category: 'Transfer' } : { category, note }), date: toISO(day, edit?.date) })
  const notes = [...new Set(txs.filter(t => t.type === type && t.note && t.note !== 'Opening balance').map(t => t.note))].slice(0, 20)
  const opts = pick(type), shown = type !== 'tr' && !opts.some(c => c.id === category) ? [get(category), ...opts] : opts // keep a hidden category visible while editing its transaction
  if (adding) return <Sheet onClose={() => setAdding(false)}><CatForm init={{ kind: type }} fixedKind onCancel={() => setAdding(false)} onSave={c => { onNewCat(c); setCategory(c.id); setAdding(false) }} /></Sheet>
  return (
    <Sheet onClose={onClose}>
      {edit ? <h3 className="text-center font-semibold">Edit {type === 'out' ? 'expense' : type === 'in' ? 'income' : 'transfer'}</h3> : <div className="grid grid-cols-3 gap-1 rounded-2xl bg-paper p-1">
        {[['out', 'Expense'], ['in', 'Income'], ['tr', 'Transfer']].map(([k, l]) => <button key={k} onClick={() => { setType(k); setCategory(pick(k === 'in' ? 'in' : 'out')[0]?.id || 'Other') }} className={'rounded-xl py-2 text-sm font-semibold ' + (type === k ? 'bg-azure text-white' : 'text-slate-500')}>{l}</button>)}
      </div>}
      <Amount value={amount} onChange={setAmount} />
      {type !== 'tr' && <div className="flex flex-wrap gap-2">
        {shown.map(c => <button key={c.id} onClick={() => setCategory(c.id)} className={'rounded-full px-3 py-1.5 text-sm ' + (category === c.id ? 'bg-azure text-white' : 'bg-paper')}>{c.emoji || EMO[c.id]} {c.name}</button>)}
        <button onClick={() => setAdding(true)} className="rounded-full border border-dashed border-azure px-3 py-1.5 text-sm font-semibold text-azure">+ New</button>
      </div>}
      <div className="grid grid-cols-2 gap-2">
        <Pick label={type === 'tr' ? 'From' : 'Account'} value={pocket} onChange={setPocket} pockets={pockets} />
        {type === 'tr' && <Pick label="To" value={to} onChange={setTo} pockets={pockets} />}
        <label className={'block text-xs text-slate-500 ' + (type === 'tr' ? 'col-span-2' : '')}>Date<input type="date" value={day} max={today} onChange={e => setDay(e.target.value)} className={field + ' mt-1 text-base text-ink'} /></label>
      </div>
      {type !== 'tr' && <>
        <input list="recent-notes" value={note} onChange={e => setNote(e.target.value)} placeholder={type === 'out' ? 'What was it? e.g. Lunch at Shoprite' : 'Where is it from? e.g. March salary'} className={field} />
        <datalist id="recent-notes">{notes.map(n => <option key={n} value={n} />)}</datalist>
      </>}
      {type === 'tr' && pocket === to && <p className="text-sm text-down">Pick two different accounts.</p>}
      {day > today && <p className="text-sm text-down">Pick today or an earlier date.</p>}
      <Save off={bad} onClick={save}>{edit ? 'Save changes' : type === 'out' ? 'Save expense' : type === 'in' ? 'Save income' : 'Transfer'}</Save>
    </Sheet>
  )
}

const firstChar = s => { s = s.trim(); if (!s) return ''; return typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter().segment(s)][0].segment : Array.from(s)[0] }

// Create or edit one category. onDelete is optional (shown as a red button with deleteLabel).
function CatForm({ init, fixedKind, onSave, onDelete, deleteLabel, onCancel }) {
  const { list } = useCats()
  const [name, setName] = useState(init.name || ''), [emoji, setEmoji] = useState(init.emoji || ''), [color, setColor] = useState(init.color || PALETTE[list.length % PALETTE.length]), [kind, setKind] = useState(init.kind || 'out')
  const clean = name.trim()
  const dup = list.some(c => c.id !== init.id && !c.archived && c.name.toLowerCase() === clean.toLowerCase() && (c.kind === kind || c.kind === 'both' || kind === 'both'))
  return (
    <div className="space-y-3">
      <h3 className="text-center font-semibold">{init.id ? 'Edit category' : 'New category'}</h3>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Name, e.g. School fees" className={field} />
      <div className="flex flex-wrap items-center gap-1.5">
        <input value={emoji} onChange={e => setEmoji(firstChar(e.target.value))} placeholder="Icon" aria-label="Icon (emoji)" className="w-16 rounded-xl bg-paper px-2 py-2 text-center text-xl outline-none focus:ring-2 focus:ring-azure/40" />
        {QUICK_EMOJI.map(e => <button key={e} onClick={() => setEmoji(e)} className="rounded-lg bg-paper px-1.5 py-1 text-lg">{e}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map(c => <button key={c} onClick={() => setColor(c)} aria-label={'Color ' + c} className={'h-8 w-8 rounded-full ' + (color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : '')} style={{ background: c }} />)}
      </div>
      {!fixedKind && <div className="grid grid-cols-3 gap-1 rounded-2xl bg-paper p-1">
        {Object.entries(KIND).map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={'rounded-xl py-2 text-sm font-semibold ' + (kind === k ? 'bg-azure text-white' : 'text-slate-500')}>{l}</button>)}
      </div>}
      {dup && <p className="text-sm text-down">You already have a category with that name.</p>}
      <Save off={!clean || dup} onClick={() => onSave({ ...init, id: init.id || uid(), name: clean, color, kind, emoji: emoji || undefined })}>Save</Save>
      {onDelete && <button onClick={onDelete} className="w-full py-1 font-semibold text-down">{deleteLabel}</button>}
      <button onClick={onCancel} className="w-full py-1 text-sm font-semibold text-azure">Cancel</button>
    </div>
  )
}

function ManageCats({ onAdd, onEdit, onDrop, onClose }) {
  const { list, uses } = useCats()
  const [editing, setEditing] = useState(null) // null = the list, {} = new, a category = edit it
  if (editing) {
    const c = editing, n = c.id ? uses(c.id) : 0
    return (
      <Sheet onClose={onClose}>
        <CatForm init={c} onCancel={() => setEditing(null)} onSave={x => { (c.id ? onEdit : onAdd)(x); setEditing(null) }}
          deleteLabel={n ? 'Hide category' : 'Delete category'}
          onDelete={c.id && c.id !== 'Other' ? () => {
            const ok = confirm(n ? `"${c.name}" is used by ${n} transaction${n > 1 ? 's' : ''}. It will be hidden from the pickers, but your history stays. Hide it?` : `Delete "${c.name}"?`)
            if (ok) { onDrop(c.id); setEditing(null) }
          } : null} />
      </Sheet>
    )
  }
  const hidden = list.filter(c => c.archived)
  return (
    <Sheet onClose={onClose}>
      <h3 className="text-center font-semibold">Categories</h3>
      <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
        {list.filter(c => !c.archived).map(c => <button key={c.id} onClick={() => setEditing(c)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-paper"><Chip id={c.id} /><span className="flex-1 font-medium">{c.name}</span><span className="text-xs text-slate-500">{KIND[c.kind]}</span></button>)}
        {hidden.length > 0 && <>
          <p className="px-2 pt-3 text-xs font-semibold uppercase text-slate-500">Hidden</p>
          {hidden.map(c => <div key={c.id} className="flex items-center gap-3 p-2"><Chip id={c.id} /><span className="flex-1 text-slate-500">{c.name}</span><button onClick={() => onEdit({ ...c, archived: false })} className="text-sm font-semibold text-azure">Restore</button></div>)}
        </>}
      </div>
      <Save onClick={() => setEditing({ kind: 'out' })}>New category</Save>
    </Sheet>
  )
}

function FundSheet({ goal, pockets, onSave, onClose }) {
  const [amount, setAmount] = useState(''), [pocket, setPocket] = useState(pockets[0].name)
  return (
    <Sheet onClose={onClose}>
      <h3 className="text-center font-semibold">Add funds to {goal.name}</h3>
      <Amount value={amount} onChange={setAmount} />
      <Pick label="Take from" value={pocket} onChange={setPocket} pockets={pockets} />
      <Save off={!(Number(amount) > 0)} onClick={() => onSave({ id: uid(), type: 'sv', amount: Number(amount), pocket, goalId: goal.id, note: goal.name, category: 'Savings', date: new Date().toISOString() })}>Add to goal</Save>
    </Sheet>
  )
}

function AccountSheet({ onSave, onClose }) {
  const [name, setName] = useState(''), [bal, setBal] = useState('')
  return (
    <Sheet onClose={onClose}>
      <h3 className="text-center font-semibold">New account</h3>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Name, e.g. Savings box" className={field} />
      <input type="number" inputMode="numeric" value={bal} onChange={e => setBal(e.target.value)} placeholder="Current balance (MK)" className={field} />
      <Save off={!name.trim()} onClick={() => onSave(name.trim(), Number(bal) || 0)}>Add account</Save>
    </Sheet>
  )
}

function SecuritySheet({ onClose, onChange }) {
  const [mode, setMode] = useState(hasPin() ? 'menu' : 'new'), [first, setFirst] = useState(''), [code, setCode] = useState('')
  const done = () => { onChange(); onClose() }
  return (
    <Sheet onClose={mode === 'code' ? () => {} : onClose}>
      {mode === 'menu' && <>
        <h3 className="text-center font-semibold">App lock</h3>
        <p className="text-center text-sm text-slate-500">PIN lock is on and your data is encrypted. Amounts stay hidden until you enter your PIN.</p>
        <Save onClick={() => setMode('verify-change')}>Change PIN</Save>
        <button onClick={() => setMode('verify-code')} className="w-full py-2 font-semibold text-azure">New recovery code</button>
        <button onClick={() => setMode('verify-remove')} className="w-full py-2 font-semibold text-down">Remove PIN</button>
      </>}
      {mode === 'verify-change' && <PinCheck hint="Enter your current PIN" onOk={() => setMode('new')} />}
      {mode === 'verify-code' && <PinCheck hint="Enter your PIN" onOk={async () => { setCode(await newRecovery()); setMode('code') }} />}
      {mode === 'verify-remove' && <PinCheck hint="Enter your PIN to turn off the lock" onOk={async () => { await disablePin(); done() }} />}
      {mode === 'new' && <PinPad title="Choose a PIN" hint={`${PIN_LEN} digits`} onDone={async p => { setFirst(p); setMode('confirm') }} />}
      {mode === 'confirm' && <>
        <PinPad title="Confirm your PIN" hint="Enter it again" onDone={async p => {
          if (p !== first) return 'PINs do not match'
          if (hasPin()) { await changePin(p); done() } else { setCode(await enablePin(p)); onChange(); setMode('code') }
        }} />
        <button onClick={() => setMode('new')} className="w-full text-sm font-semibold text-azure">Start over</button>
      </>}
      {mode === 'code' && <>
        <h3 className="text-center font-semibold">Save your recovery code</h3>
        <p className="text-center text-sm text-slate-500">If you forget your PIN, this code is the only way to get your data back. Write it down or take a screenshot. You won't see it again.</p>
        <p className="select-all rounded-2xl bg-paper py-4 text-center font-mono text-xl font-bold tracking-wider">{code}</p>
        <button onClick={() => navigator.clipboard?.writeText(code)} className="w-full py-1 text-sm font-semibold text-azure">Copy</button>
        <Save onClick={onClose}>I've saved it</Save>
      </>}
    </Sheet>
  )
}

function Plan({ shop, setShop, goals, setGoals, budgets, txs, pockets, onFund, onBuy, onUnbuy }) {
  const [seg, setSeg] = useState('shop')
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
        {[['shop', 'Shopping'], ['goals', 'Goals']].map(([k, l]) => <button key={k} onClick={() => setSeg(k)} className={'rounded-xl py-2 text-sm font-semibold ' + (seg === k ? 'bg-azure text-white' : 'text-slate-500')}>{l}</button>)}
      </div>
      {seg === 'shop' ? <Shopping shop={shop} setShop={setShop} budgets={budgets} txs={txs} pockets={pockets} onBuy={onBuy} onUnbuy={onUnbuy} /> : <Goals goals={goals} setGoals={setGoals} onFund={onFund} />}
    </div>
  )
}

// A shopping list is a plan: nothing changes in your balances until you tick an item as bought.
function Shopping({ shop, setShop, budgets, txs, pockets, onBuy, onUnbuy }) {
  const { active, get } = useCats()
  const [name, setName] = useState(''), [est, setEst] = useState(''), [cat, setCat] = useState('')
  const cats = active('out'), catId = cats.some(c => c.id === cat) ? cat : (cats.find(c => c.id === 'Shopping') || cats[0])?.id || 'Other'
  const add = () => { if (!name.trim()) return; setShop([...shop, { id: uid(), name: name.trim(), est: Number(est) || 0, category: catId, done: false }]); setName(''); setEst('') }
  const todo = shop.filter(i => !i.done), bought = shop.filter(i => i.done)
  const planned = todo.reduce((a, i) => a + i.est, 0), total = pockets.reduce((a, p) => a + p.balance, 0)
  const spentIn = id => txs.filter(t => t.type === 'out' && t.category === id && month(t.date) === thisMonth()).reduce((a, t) => a + t.amount, 0)
  const need = {}
  todo.forEach(i => { need[i.category] = (need[i.category] || 0) + i.est })
  const warn = Object.entries(need).filter(([id, n]) => budgets[id] > 0 && n > budgets[id] - spentIn(id)).map(([id, n]) => `${get(id).name}: this list needs ${mk(n)}, but only ${mk(Math.max(0, budgets[id] - spentIn(id)))} is left in that budget.`)
  const paid = i => txs.find(t => t.id === i.txId)?.amount ?? i.est
  const row = i => (
    <div key={i.id} className="flex items-center gap-3 py-2.5">
      <button aria-label={i.done ? 'Undo purchase' : 'Mark as bought'} onClick={() => (i.done ? onUnbuy(i) : onBuy(i))} className={'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm ' + (i.done ? 'border-up bg-up text-white' : 'border-azure')}>{i.done && '✓'}</button>
      <div className="min-w-0 flex-1">
        <p className={'truncate font-medium ' + (i.done ? 'text-slate-400 line-through' : '')}>{i.name}</p>
        <p className="truncate text-xs text-slate-500">{get(i.category).name}</p>
      </div>
      <p className="text-sm font-semibold">{i.done ? mk(paid(i)) : i.est ? mk(i.est) : ''}</p>
      <button aria-label="Remove item" onClick={() => setShop(shop.filter(x => x.id !== i.id))} className="px-1 text-slate-400">✕</button>
    </div>
  )
  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Item, e.g. Maize flour" className={field + ' min-w-0 flex-1 py-2!'} />
          <input value={est} type="number" inputMode="numeric" onChange={e => setEst(e.target.value)} placeholder="Price" className={field + ' w-24! py-2!'} />
          <button onClick={add} className="rounded-2xl bg-azure px-4 font-semibold text-white">Add</button>
        </div>
        <select aria-label="Category" value={catId} onChange={e => setCat(e.target.value)} className={field + ' py-2! text-base text-ink'}>{cats.map(c => <option key={c.id} value={c.id}>{c.emoji || EMO[c.id] || ''} {c.name}</option>)}</select>
      </Card>
      {planned > 0 && <Card>
        <p className="text-sm text-slate-500">Planned</p>
        <p className="text-3xl font-bold">{mk(planned)}</p>
        <p className={'mt-1 text-sm ' + (planned > total ? 'text-down' : 'text-slate-500')}>{planned > total ? `${mk(planned - total)} more than your total balance` : `${mk(total - planned)} left of your ${mk(total)} after this list`}</p>
        {warn.map(w => <p key={w} className="mt-1 text-sm text-down">{w}</p>)}
      </Card>}
      {shop.length === 0 && <p className="mt-6 text-center text-slate-500">Plan what you're going to buy. Tick items as you buy them and the money comes off your balance.</p>}
      {todo.length > 0 && <Card className="divide-y divide-black/5 py-1 dark:divide-white/5">{todo.map(row)}</Card>}
      {bought.length > 0 && <>
        <div className="flex items-center justify-between px-1"><p className="text-sm font-semibold text-slate-500">Bought</p><button onClick={() => setShop(shop.filter(i => !i.done))} className="text-sm font-semibold text-azure">Clear bought</button></div>
        <Card className="divide-y divide-black/5 py-1 dark:divide-white/5">{bought.map(row)}</Card>
      </>}
    </div>
  )
}

function BuySheet({ item, pockets, onSave, onClose }) {
  const { get } = useCats()
  const [amount, setAmount] = useState(item.est ? String(item.est) : ''), [pocket, setPocket] = useState(pockets[0].name)
  return (
    <Sheet onClose={onClose}>
      <h3 className="text-center font-semibold">Bought {item.name}?</h3>
      <p className="text-center text-sm text-slate-500">{get(item.category).name} · comes off your balance</p>
      <Amount value={amount} onChange={setAmount} />
      <Pick label="Paid from" value={pocket} onChange={setPocket} pockets={pockets} />
      <Save off={!(Number(amount) > 0)} onClick={() => onSave({ id: uid(), type: 'out', amount: Number(amount), pocket, category: item.category, note: item.name, shopId: item.id, date: new Date().toISOString() })}>Save purchase</Save>
    </Sheet>
  )
}

const niceDate = ds => new Date(ds + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function MoreSheet({ lastBackup, onPick, onClose }) {
  const rows = [
    ['backup', '💾', 'Backup and restore', lastBackup ? 'Last backup ' + new Date(lastBackup).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No backup yet'],
    ['recurring', '🔁', 'Recurring transactions', 'Rent, salary, regular top-ups'],
    ['cats', '🏷️', 'Categories', 'Add, rename or hide'],
  ]
  return (
    <Sheet onClose={onClose}>
      <h3 className="text-center font-semibold">More</h3>
      {rows.map(([k, e, l, sub]) => <button key={k} onClick={() => onPick(k)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-paper"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-paper text-xl">{e}</span><span className="min-w-0 flex-1"><span className="block font-medium">{l}</span><span className="block text-xs text-slate-500">{sub}</span></span><span className="text-slate-400">›</span></button>)}
    </Sheet>
  )
}

const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f) })
const download = (name, text) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function BackupSheet({ data, onBackedUp, onRestore, onClose }) {
  const [mode, setMode] = useState('menu'), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [env, setEnv] = useState(null), [found, setFound] = useState(null)
  const backup = async () => {
    setBusy(true); setErr('')
    try {
      let text = JSON.stringify(wrapBackup(data))
      if (pw) text = JSON.stringify(await sealBackup(text, pw))
      download(`budgie-backup-${ymd(new Date())}${pw ? '.budgie' : '.json'}`, text)
      onBackedUp(new Date().toISOString()); setMode('done')
    } catch { setErr('Could not create the backup.') }
    setBusy(false)
  }
  const load = obj => { const bad = checkBackup(obj?.data); bad ? setErr(bad) : setFound(obj) }
  const choose = async f => {
    setErr(''); setFound(null); setEnv(null); setPw('')
    if (!f) return
    try { const obj = JSON.parse(await readText(f)); if (obj?.app !== 'budgie') throw new Error('x'); obj.enc ? setEnv(obj) : load(obj) } catch { setErr("That doesn't look like a Budgie backup.") }
  }
  const openFile = async () => { setBusy(true); setErr(''); try { load(JSON.parse(await openBackup(env, pw))) } catch { setErr('Wrong password.') } setBusy(false) }
  const back = <button onClick={() => { setMode('menu'); setErr(''); setPw(''); setEnv(null); setFound(null) }} className="w-full py-1 text-sm font-semibold text-azure">Back</button>
  return (
    <Sheet onClose={onClose}>
      <h3 className="text-center font-semibold">Backup and restore</h3>
      {mode === 'menu' && <>
        <p className="text-center text-sm text-slate-500">Your data is stored only on this device. If you clear the browser or lose the phone, it's gone. Back up now and then, and keep the file somewhere safe, like your email.</p>
        <Save onClick={() => setMode('export')}>Back up now</Save>
        <button onClick={() => setMode('import')} className="w-full py-2 font-semibold text-azure">Restore from a file</button>
      </>}
      {mode === 'export' && <>
        <p className="text-sm text-slate-500">Add a password to lock the file. Without one, anyone who gets the file can read all your finances.</p>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password (optional, recommended)" autoComplete="new-password" className={field} />
        {pw && pw.length < 6 && <p className="text-sm text-down">Use at least 6 characters.</p>}
        {pw && <p className="text-xs text-slate-500">If you forget this password, the backup can't be opened. There is no way to recover it.</p>}
        {err && <p className="text-sm text-down">{err}</p>}
        <Save off={busy || (!!pw && pw.length < 6)} onClick={backup}>Download backup</Save>
        {back}
      </>}
      {mode === 'done' && <>
        <p className="text-center text-sm text-slate-500">Backup saved to your downloads. Keep it somewhere safe.</p>
        <Save onClick={onClose}>Done</Save>
      </>}
      {mode === 'import' && <>
        {!found && !env && <>
          <p className="text-sm text-slate-500">Choose a Budgie backup file (.json or .budgie).</p>
          <input type="file" accept=".json,.budgie,application/json" onChange={e => choose(e.target.files[0])} className="w-full text-sm" />
        </>}
        {env && !found && <>
          <p className="text-sm text-slate-500">This backup is password protected.</p>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" autoComplete="off" className={field} />
          <Save off={busy || !pw} onClick={openFile}>Unlock backup</Save>
        </>}
        {found && <>
          <p className="rounded-2xl bg-paper p-3 text-sm">Backup from {new Date(found.exported).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}: {found.data.txs.length} transactions, {found.data.pockets.length} accounts.</p>
          <p className="text-sm text-down">Restoring replaces everything currently in the app.</p>
          <Save onClick={() => confirm(`Replace everything in the app with this backup (${found.data.txs.length} transactions, ${found.data.pockets.length} accounts)?`) && onRestore(found.data)}>Replace my data</Save>
        </>}
        {err && <p className="text-sm text-down">{err}</p>}
        {back}
      </>}
    </Sheet>
  )
}

function RecurForm({ init, pockets, onSave, onDelete, onCancel }) {
  const { pick, get } = useCats()
  const [type, setType] = useState(init.type || 'out'), [amount, setAmount] = useState(init.amount ? String(init.amount) : ''), [pocket, setPocket] = useState(init.pocket || pockets[0].name)
  const [category, setCategory] = useState(init.category || (() => pick(init.type || 'out')[0]?.id || 'Other')), [note, setNote] = useState(init.note || ''), [freq, setFreq] = useState(init.freq || 'monthly'), [start, setStart] = useState(init.start || ymd(new Date()))
  const opts = pick(type), shown = opts.some(c => c.id === category) ? opts : [get(category), ...opts]
  const day = freq === 'weekly' ? new Date(start + 'T12:00:00').getDay() : Number(start.slice(8))
  const rule = { ...init, id: init.id || uid(), type, amount: Number(amount), pocket, category, note: note.trim(), freq, day, start, last: init.last || null }
  const backlog = dueDates({ ...rule, last: init.last || null }, ymd(new Date())).length
  const bad = !(Number(amount) > 0) || !start
  const save = () => { if (backlog > 12 && !init.id && !confirm(`The first date is in the past, so this adds ${backlog} transactions right now. Continue?`)) return; onSave(rule) }
  return (
    <div className="space-y-3">
      <h3 className="text-center font-semibold">{init.id ? 'Edit recurring' : 'New recurring'}</h3>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-paper p-1">
        {[['out', 'Expense'], ['in', 'Income']].map(([k, l]) => <button key={k} onClick={() => { setType(k); setCategory(pick(k)[0]?.id || 'Other') }} className={'rounded-xl py-2 text-sm font-semibold ' + (type === k ? 'bg-azure text-white' : 'text-slate-500')}>{l}</button>)}
      </div>
      <Amount value={amount} onChange={setAmount} />
      <div className="flex flex-wrap gap-2">{shown.map(c => <button key={c.id} onClick={() => setCategory(c.id)} className={'rounded-full px-3 py-1.5 text-sm ' + (category === c.id ? 'bg-azure text-white' : 'bg-paper')}>{c.emoji || EMO[c.id]} {c.name}</button>)}</div>
      <Pick label="Account" value={pocket} onChange={setPocket} pockets={pockets} />
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Name, e.g. Rent" className={field} />
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-paper p-1">
        {[['weekly', 'Every week'], ['monthly', 'Every month']].map(([k, l]) => <button key={k} onClick={() => setFreq(k)} className={'rounded-xl py-2 text-sm font-semibold ' + (freq === k ? 'bg-azure text-white' : 'text-slate-500')}>{l}</button>)}
      </div>
      <label className="block text-xs text-slate-500">First date<input type="date" value={start} onChange={e => setStart(e.target.value)} className={field + ' mt-1 text-base text-ink'} /></label>
      {start && <p className="text-center text-sm text-slate-500">Repeats {describeRule(rule)}, starting {niceDate(start)}.</p>}
      <Save off={bad} onClick={save}>Save</Save>
      {onDelete && <button onClick={onDelete} className="w-full py-1 font-semibold text-down">Delete recurring</button>}
      <button onClick={onCancel} className="w-full py-1 text-sm font-semibold text-azure">Cancel</button>
    </div>
  )
}

function RecurSheet({ rules, pockets, onSave, onDelete, onNeedPin, onClose }) {
  const { get } = useCats()
  const [editing, setEditing] = useState(null)
  if (editing) return (
    <Sheet onClose={onClose}>
      <RecurForm init={editing} pockets={pockets} onCancel={() => setEditing(null)} onSave={r => { onSave(r); setEditing(null) }}
        onDelete={editing.id ? () => { if (confirm('Delete this recurring entry? Transactions already added stay in your history.')) { onDelete(editing.id); setEditing(null) } } : null} />
    </Sheet>
  )
  return (
    <Sheet onClose={onClose}>
      <h3 className="text-center font-semibold">Recurring</h3>
      <p className="text-center text-sm text-slate-500">These are added to your transactions automatically on their due dates.</p>
      <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
        {rules.length === 0 && <p className="py-4 text-center text-slate-500">Nothing yet. Add rent, salary or regular top-ups.</p>}
        {rules.map(r => {
          const next = dueDates(r, ymd(Date.now() + 400 * 864e5))[0]
          return (
            <button key={r.id} onClick={() => (mask.on ? onNeedPin() : setEditing(r))} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-paper">
              <Chip id={r.category} color={r.type === 'in' ? '#42a542' : undefined} />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.note || get(r.category).name}</span><span className="block truncate text-xs text-slate-500">{describeRule(r)}{next ? ' · next ' + niceDate(next) : ''}</span></span>
              <span className="text-sm font-semibold">{r.type === 'in' ? '+' : '-'}{mk(r.amount)}</span>
            </button>
          )
        })}
      </div>
      <Save onClick={() => setEditing({ type: 'out' })}>New recurring</Save>
    </Sheet>
  )
}

const TABS = [['home', 'Home'], ['activity', 'Activity'], ['insights', 'Insights'], ['budgets', 'Budgets'], ['plan', 'Plan']]
const ICONS = { home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', activity: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', insights: 'M18 20V10M12 20V4M6 20v-6', budgets: 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z', plan: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', more: 'M5 12h.01M12 12h.01M19 12h.01', eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', eyeOff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22', lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4' }
const Icon = ({ k }) => <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[k]} /></svg>

function Budgie({ onLock }) {
  const [tab, setTab] = useState('home'), [sheet, setSheet] = useState(null)
  const [pinSet, setPinSet] = useState(hasPin), [revealed, setRevealed] = useState(REVEAL_ON_UNLOCK)
  mask.on = pinSet && !revealed
  useEffect(() => {
    let away = 0
    const f = () => {
      if (document.hidden) away = Date.now()
      else if (pinSet && away && Date.now() - away > LOCK_AFTER_MS) onLock()
    }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [pinSet])
  useEffect(() => {
    if (!revealed) return
    let last = Date.now()
    const touch = () => { last = Date.now() }
    const check = () => { if (Date.now() - last > REVEAL_MS) setRevealed(false) }
    const evs = ['pointerdown', 'keydown', 'scroll']
    evs.forEach(e => window.addEventListener(e, touch, true))
    const t = setInterval(check, 5000)
    document.addEventListener('visibilitychange', check)
    return () => { evs.forEach(e => window.removeEventListener(e, touch, true)); clearInterval(t); document.removeEventListener('visibilitychange', check) }
  }, [revealed])
  const [pockets, setPockets] = useStore('budgie.pockets', ['Cash', 'Bank', 'Airtel Money', 'Mpamba'].map(name => ({ id: uid(), name, balance: 0 })))
  const [txs, setTxs] = useStore('budgie.txs', [])
  const [budgets, setBudgets] = useStore('budgie.budgets', {})
  const [goals, setGoals] = useStore('budgie.goals', [])
  const [cats, setCats] = useStore('budgie.cats', DEFAULT_CATS)
  const [shop, setShop] = useStore('budgie.shop', [])
  const [recurring, setRecurring] = useStore('budgie.recurring', [])
  const [lastBackup, setLastBackup] = useStore('budgie.lastBackup', null)
  const [notice, setNotice] = useState('')
  const recRef = useRef(recurring)
  recRef.current = recurring
  const runRef = useRef(null)
  const uses = {}
  txs.forEach(t => { uses[t.category] = (uses[t.category] || 0) + 1 })
  const byId = new Map(cats.map(c => [c.id, c]))
  const active = kind => cats.filter(c => !c.archived && (c.kind === kind || c.kind === 'both'))
  const catApi = { list: cats, active, pick: kind => active(kind).sort((a, b) => (uses[b.id] || 0) - (uses[a.id] || 0)), uses: id => uses[id] || 0, get: id => byId.get(id) || SYSTEM[id] || { id, name: id, color: '#868e96' } }
  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date)) // newest first, even when backdated
  const addCat = c => setCats(cs => [...cs, c])
  const editCat = c => setCats(cs => cs.map(x => x.id === c.id ? c : x))
  const dropCat = id => { // used categories are hidden (history keeps working), unused ones are deleted
    const used = txs.some(t => t.category === id)
    setCats(cs => used ? cs.map(c => c.id === id ? { ...c, archived: true } : c) : cs.filter(c => c.id !== id))
    setBudgets(b => { const n = { ...b }; delete n[id]; return n })
  }
  const apply = (t, s) => setPockets(ps => ps.map(p => { let d = 0; if (p.name === t.pocket) d += t.type === 'in' ? t.amount : -t.amount; if (t.type === 'tr' && p.name === t.to) d += t.amount; return d ? { ...p, balance: p.balance + s * d } : p }))
  const save = t => { apply(t, 1); setTxs(x => [t, ...x]); setSheet(null) }
  const del = t => { apply(t, -1); setTxs(x => x.filter(y => y.id !== t.id)); if (t.shopId) setShop(items => items.map(i => i.id === t.shopId ? { ...i, done: false, txId: undefined } : i)); if (t.type === 'sv') setGoals(gs => gs.map(g => g.id === t.goalId ? { ...g, saved: Math.max(0, g.saved - t.amount) } : g)) }
  const update = (o, t) => { apply(o, -1); apply(t, 1); setTxs(x => x.map(y => y.id === o.id ? t : y)); setSheet(null) }
  const needPin = next => setSheet(mask.on ? { pin: next } : next) // sheets that show real amounts ask for the PIN first while amounts are hidden
  const buy = t => { save(t); setShop(items => items.map(i => i.id === t.shopId ? { ...i, done: true, txId: t.id } : i)) }
  const unbuy = i => {
    const t = txs.find(x => x.id === i.txId)
    if (!confirm(t ? `Undo this purchase? The ${mk(t.amount)} expense will be removed and the money returned to ${t.pocket}.` : 'Mark this item as not bought?')) return
    if (t) del(t); else setShop(items => items.map(x => x.id === i.id ? { ...x, done: false, txId: undefined } : x))
  }
  const fund = t => { save(t); setGoals(gs => gs.map(g => g.id === t.goalId ? { ...g, saved: g.saved + t.amount } : g)) }
  const addAccount = (name, bal) => {
    setPockets(ps => [...ps, { id: uid(), name, balance: 0 }])
    if (bal) save({ id: uid(), type: 'in', amount: bal, pocket: name, category: 'Other', note: 'Opening balance', date: new Date().toISOString() })
    setSheet(null)
  }
  // Recurring: posts every occurrence that has come due. recRef is updated at once, so running it twice never double-posts.
  const runRec = () => {
    const today = ymd(new Date()), posts = [], names = []
    const next = recRef.current.map(r => {
      const ds = dueDates(r, today)
      if (!ds.length) return r
      ds.forEach(d => posts.push({ id: uid(), type: r.type, amount: r.amount, pocket: r.pocket, category: r.category, note: r.note, recurId: r.id, date: toISO(d) }))
      names.push(r.note || catApi.get(r.category).name)
      return { ...r, last: ds[ds.length - 1] }
    })
    if (!posts.length) return
    recRef.current = next; setRecurring(next)
    posts.forEach(t => apply(t, 1))
    setTxs(x => [...posts, ...x])
    setNotice(`Added ${posts.length} recurring transaction${posts.length > 1 ? 's' : ''}: ${[...new Set(names)].join(', ')}`)
  }
  runRef.current = runRec
  useEffect(() => {
    runRef.current()
    const f = () => { if (!document.hidden) runRef.current() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])
  const saveRule = r => {
    recRef.current = recRef.current.some(x => x.id === r.id) ? recRef.current.map(x => x.id === r.id ? r : x) : [...recRef.current, r]
    setRecurring(recRef.current); runRec()
  }
  const deleteRule = id => { recRef.current = recRef.current.filter(x => x.id !== id); setRecurring(recRef.current) }
  const restore = d => {
    setPockets(d.pockets); setTxs(d.txs); setBudgets(d.budgets || {}); setGoals(d.goals || []); setCats(d.cats?.length ? d.cats : DEFAULT_CATS); setShop(d.shop || [])
    recRef.current = d.recurring || []; setRecurring(recRef.current)
    setSheet(null); setNotice('Backup restored.'); runRec()
  }
  const backupData = { pockets, txs, budgets, goals, cats, shop, recurring }
  const h = new Date().getHours(), greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <CatCtx.Provider value={catApi}>
    <div className="mx-auto flex h-full max-w-md flex-col">
      <header className="flex items-end justify-between px-5 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div>
          <p className="text-sm text-slate-500">{tab === 'home' ? greet : 'Budgie'}</p>
          <h1 className="text-2xl font-bold text-navy">{tab === 'home' ? 'Your money' : TABS.find(t => t[0] === tab)[1]}</h1>
        </div>
        <div className="flex gap-2 text-slate-500">
          {pinSet && <button onClick={() => revealed ? setRevealed(false) : setSheet('reveal')} aria-label={revealed ? 'Hide amounts' : 'Show amounts'} className="grid h-10 w-10 place-items-center rounded-full bg-surface"><Icon k={revealed ? 'eye' : 'eyeOff'} /></button>}
          <button onClick={() => setSheet('security')} aria-label="App lock" className="grid h-10 w-10 place-items-center rounded-full bg-surface"><Icon k="lock" /></button>
          <button onClick={() => setSheet('more')} aria-label="More" className="grid h-10 w-10 place-items-center rounded-full bg-surface"><Icon k="more" /></button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 pb-36">
        {notice && <button onClick={() => setNotice('')} className="mb-3 w-full rounded-2xl bg-azure/10 p-3 text-left text-sm text-azure">{notice} <span className="float-right font-semibold">Dismiss</span></button>}
        {tab === 'home' && <Home pockets={pockets} txs={sorted} budgets={budgets} setTab={setTab} onAccount={() => setSheet('account')} />}
        {tab === 'activity' && <Activity txs={sorted} onDelete={del} onEdit={t => needPin({ edit: t })} />}
        {tab === 'insights' && <Insights txs={txs} pockets={pockets} />}
        {tab === 'budgets' && <Budgets budgets={budgets} setBudgets={setBudgets} txs={txs} onManage={() => setSheet('cats')} />}
        {tab === 'plan' && <Plan shop={shop} setShop={setShop} goals={goals} setGoals={setGoals} budgets={budgets} txs={txs} pockets={pockets} onFund={g => setSheet({ fund: g })} onBuy={i => needPin({ buy: i })} onUnbuy={unbuy} />}
      </main>
      <button onClick={() => setSheet('add')} aria-label="Add transaction" className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-10 grid h-14 w-14 place-items-center rounded-full bg-azure text-3xl text-white shadow-lg shadow-azure/40 active:scale-95">+</button>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md justify-around border-t border-black/5 bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/5">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ' + (tab === k ? 'text-azure' : 'text-slate-400')}><span className={'rounded-full px-4 py-1 ' + (tab === k ? 'bg-azure/15' : '')}><Icon k={k} /></span>{l}</button>)}
      </nav>
      {sheet === 'add' && <AddSheet pockets={pockets} txs={txs} onSave={save} onNewCat={addCat} onClose={() => setSheet(null)} />}
      {sheet?.edit && <AddSheet edit={sheet.edit} pockets={pockets} txs={txs} onSave={t => update(sheet.edit, t)} onNewCat={addCat} onClose={() => setSheet(null)} />}
      {sheet?.buy && <BuySheet item={sheet.buy} pockets={pockets} onSave={buy} onClose={() => setSheet(null)} />}
      {sheet === 'more' && <MoreSheet lastBackup={lastBackup} onPick={k => (k === 'backup' ? needPin(k) : setSheet(k))} onClose={() => setSheet(null)} />}
      {sheet === 'backup' && <BackupSheet data={backupData} onBackedUp={setLastBackup} onRestore={restore} onClose={() => setSheet(null)} />}
      {sheet === 'recurring' && <RecurSheet rules={recurring} pockets={pockets} onSave={saveRule} onDelete={deleteRule} onNeedPin={() => setSheet({ pin: 'recurring' })} onClose={() => setSheet(null)} />}
      {sheet === 'cats' && <ManageCats onAdd={addCat} onEdit={editCat} onDrop={dropCat} onClose={() => setSheet(null)} />}
      {sheet === 'account' && <AccountSheet onSave={addAccount} onClose={() => setSheet(null)} />}
      {sheet?.pin !== undefined && <Sheet onClose={() => setSheet(null)}><PinCheck hint="to show amounts" onOk={() => { setRevealed(true); setSheet(sheet.pin) }} /></Sheet>}
      {sheet === 'reveal' && <Sheet onClose={() => setSheet(null)}><PinCheck hint="to show amounts" onOk={() => { setRevealed(true); setSheet(null) }} /></Sheet>}
      {sheet === 'security' && <SecuritySheet onClose={() => setSheet(null)} onChange={() => setPinSet(hasPin())} />}
      {sheet?.fund && <FundSheet goal={sheet.fund} pockets={pockets} onSave={fund} onClose={() => setSheet(null)} />}
    </div>
    </CatCtx.Provider>
  )
}

export default function App() {
  const [locked, setLocked] = useState(hasPin)
  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />
  return <Budgie onLock={() => { lock(); setLocked(true) }} />
}
