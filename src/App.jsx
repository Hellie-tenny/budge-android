import { useState, useEffect } from 'react'

const CATS = { Food: '#e8590c', Transport: '#1c7ed6', Airtime: '#9c36b5', Bills: '#e03131', Shopping: '#d6336c', Health: '#2f9e44', Other: '#868e96' }
const EMO = { Food: '🍲', Transport: '🚌', Airtime: '📱', Bills: '💡', Shopping: '🛍️', Health: '💊', Other: '🧾', Salary: '💼', Business: '🏪', Gift: '🎁', Savings: '🎯', Transfer: '🔁' }
const INCOME = ['Salary', 'Business', 'Gift', 'Other']
const PC = ['#3d7ddd', '#42a542', '#8f8fe0', '#f59f00', '#e8590c']
const mk = n => (n < 0 ? '-MK ' : 'MK ') + Math.abs(Math.round(n)).toLocaleString()
const uid = () => Math.random().toString(36).slice(2, 9)
const month = d => d.slice(0, 7)
const mKey = (off = 0) => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - off); return d.toISOString().slice(0, 7) }
const thisMonth = () => mKey(0)
const net = t => (t.type === 'in' ? t.amount : t.type === 'out' || t.type === 'sv' ? -t.amount : 0)
const tint = t => (t.type === 'out' ? CATS[t.category] || '#868e96' : t.type === 'in' ? '#42a542' : t.type === 'sv' ? '#f59f00' : '#3d7ddd')
const dayLabel = iso => {
  const d = new Date(iso), n = new Date(), y = new Date(); y.setDate(n.getDate() - 1)
  return d.toDateString() === n.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function useStore(key, init) {
  const [v, setV] = useState(() => { try { return JSON.parse(localStorage.getItem(key)) ?? init } catch { return init } })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(v)) }, [key, v])
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
const Chip = ({ name, color }) => <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: color + '26', color }}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={CI[name] || CI.Other} /></svg></span>
const field = 'w-full rounded-2xl bg-paper px-4 py-3 outline-none focus:ring-2 focus:ring-azure/40'

function TxRow({ t, onDelete }) {
  const title = t.type === 'tr' ? 'Transfer' : t.note || t.category
  const sub = t.type === 'tr' ? `${t.pocket} to ${t.to}` : `${t.category} · ${t.pocket}`
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Chip name={t.category} color={tint(t)} />
      <div className="min-w-0 flex-1"><p className="truncate font-medium">{title}</p><p className="truncate text-xs text-slate-500">{sub}</p></div>
      <div className="text-right">
        <p className={'font-semibold ' + (t.type === 'in' ? 'text-up' : t.type === 'out' ? '' : 'text-azure')}>{t.type === 'in' ? '+' : t.type === 'out' ? '-' : ''}{mk(t.amount)}</p>
        {onDelete && <button className="text-xs text-down" onClick={() => confirm('Delete this transaction?') && onDelete(t)}>Delete</button>}
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
      {data.map(d => { const len = (d.value / total) * 238.76; const el = <circle key={d.name} cx="50" cy="50" r="38" fill="none" stroke={CATS[d.name]} strokeWidth="14" strokeDasharray={`${len} 238.76`} strokeDashoffset={-acc} />; acc += len; return el })}
    </svg>
  )
}

function Home({ pockets, txs, budgets, setTab, onAccount }) {
  const total = pockets.reduce((a, p) => a + p.balance, 0)
  const m = txs.filter(t => month(t.date) === thisMonth())
  const inc = m.filter(t => t.type === 'in').reduce((a, t) => a + t.amount, 0)
  const spent = m.filter(t => t.type === 'out')
  const out = spent.reduce((a, t) => a + t.amount, 0)
  const byCat = Object.keys(CATS).map(name => ({ name, value: spent.filter(t => t.category === name).reduce((a, t) => a + t.amount, 0) })).filter(d => d.value > 0).sort((a, b) => b.value - a.value)
  const lastOut = txs.filter(t => t.type === 'out' && month(t.date) === mKey(1)).reduce((a, t) => a + t.amount, 0)
  const over = Object.entries(budgets).filter(([c, l]) => l > 0 && (byCat.find(d => d.name === c)?.value || 0) > l).map(([c]) => c)
  const limit = Object.values(budgets).reduce((a, b) => a + b, 0)
  const used = Object.entries(budgets).filter(([, l]) => l > 0).reduce((a, [c]) => a + (byCat.find(d => d.name === c)?.value || 0), 0)
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
      {over.length > 0 && <div className="rounded-2xl bg-down/10 p-3 text-sm text-down">Over budget: {over.join(', ')}</div>}
      <Card>
        <h3 className="mb-3 font-semibold">Where your money went</h3>
        {byCat.length === 0 ? <p className="text-sm text-slate-500">No spending yet this month. Tap + to add an expense.</p> : (
          <div className="flex items-center gap-4">
            <Donut data={byCat} />
            <ul className="flex-1 space-y-1.5 text-sm">{byCat.map(d => <li key={d.name} className="flex justify-between"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: CATS[d.name] }} />{d.name}</span><span>{mk(d.value)}</span></li>)}</ul>
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

function Activity({ txs, onDelete }) {
  const [q, setQ] = useState(''), [f, setF] = useState('all')
  const list = txs.filter(t => (f === 'all' || t.type === f) && ((t.note || '') + t.category + t.pocket + (t.to || '')).toLowerCase().includes(q.toLowerCase()))
  let last = ''
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search transactions" className={field + ' bg-surface'} />
      <div className="my-3 flex gap-2">{[['all', 'All'], ['in', 'Income'], ['out', 'Expenses']].map(([k, l]) => <button key={k} onClick={() => setF(k)} className={'rounded-full px-4 py-1.5 text-sm font-medium ' + (f === k ? 'bg-azure text-white' : 'bg-surface text-slate-500')}>{l}</button>)}</div>
      {!list.length && <p className="mt-10 text-center text-slate-500">{txs.length ? 'Nothing matches.' : 'No transactions yet. Tap + to add one.'}</p>}
      {list.map(t => { const l = dayLabel(t.date), head = l !== last; last = l; return <div key={t.id}>{head && <p className="mb-1 mt-4 text-sm font-semibold text-slate-500">{l}</p>}<Card className="py-0.5! mb-2"><TxRow t={t} onDelete={onDelete} /></Card></div> })}
    </div>
  )
}

function Insights({ txs, pockets }) {
  const [which, setWhich] = useState(0)
  const months = [5, 4, 3, 2, 1, 0].map(o => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - o); return { key: d.toISOString().slice(0, 7), label: d.toLocaleString('en', { month: 'short' }) } })
  if (!txs.length) return <p className="mt-10 text-center text-slate-500">Add a few transactions and your charts will show up here.</p>
  const sum = (key, type) => txs.filter(t => month(t.date) === key && t.type === type).reduce((a, t) => a + t.amount, 0)
  const data = months.map(m => ({ ...m, inc: sum(m.key, 'in'), out: sum(m.key, 'out') }))
  const max = Math.max(1, ...data.flatMap(d => [d.inc, d.out]))
  const total = pockets.reduce((a, p) => a + p.balance, 0)
  const bal = months.map(m => total - txs.filter(t => month(t.date) > m.key).reduce((a, t) => a + net(t), 0))
  const lo = Math.min(...bal), hi = Math.max(...bal)
  const pts = bal.map((v, i) => [30 + i * 48, 100 - ((v - lo) / (hi - lo || 1)) * 80])
  const cats = Object.keys(CATS).map(c => ({ c, v: txs.filter(t => t.type === 'out' && t.category === c && month(t.date) === mKey(which)).reduce((a, t) => a + t.amount, 0) })).filter(d => d.v > 0).sort((a, b) => b.v - a.v)
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
          <div className="flex justify-between text-sm"><span>{EMO[d.c]} {d.c}</span><span>{mk(d.v)}</span></div>
          <div className="mt-1 h-2.5 rounded-full bg-mist/40"><div className="h-2.5 rounded-full" style={{ width: (d.v / cats[0].v) * 100 + '%', background: CATS[d.c] }} /></div>
        </div>)}</div>
      </Card>
    </div>
  )
}

function Budgets({ budgets, setBudgets, txs }) {
  const spent = c => txs.filter(t => t.type === 'out' && t.category === c && month(t.date) === thisMonth()).reduce((a, t) => a + t.amount, 0)
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Set a monthly limit for each category. Leave it empty for no limit.</p>
      {Object.keys(CATS).map(c => {
        const lim = budgets[c] || 0, s = spent(c), pct = lim ? Math.min(100, (s / lim) * 100) : 0, bad = lim && s > lim
        return (
          <Card key={c}>
            <div className="flex items-center gap-3">
              <Chip name={c} color={CATS[c]} /><span className="flex-1 font-medium">{c}</span>
              <input type="number" inputMode="numeric" value={lim || ''} placeholder="No limit" onChange={e => setBudgets({ ...budgets, [c]: Number(e.target.value) })} className="w-28 rounded-xl bg-paper px-3 py-1.5 text-right outline-none focus:ring-2 focus:ring-azure/40" />
            </div>
            <div className="mt-3 h-2 rounded-full bg-mist/40"><div className="h-2 rounded-full" style={{ width: pct + '%', background: bad ? '#ec4c4c' : CATS[c] }} /></div>
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
    <div className="sheet-in mx-auto w-full max-w-md space-y-3 rounded-t-[2rem] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
      <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-mist" />{children}
    </div>
  </div>
)
const Save = ({ onClick, children, off }) => <button disabled={off} onClick={onClick} className="w-full rounded-2xl bg-azure py-3.5 text-lg font-semibold text-white disabled:opacity-40">{children}</button>
const Amount = ({ value, onChange }) => <input autoFocus type="number" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} placeholder="MK 0" className="w-full bg-transparent py-3 text-center text-4xl font-bold outline-none placeholder:text-mist" />
const Pick = ({ value, onChange, pockets, label }) => <label className="block text-xs text-slate-500">{label}<select value={value} onChange={e => onChange(e.target.value)} className={field + ' mt-1 text-base text-ink'}>{pockets.map(p => <option key={p.id}>{p.name}</option>)}</select></label>

function AddSheet({ pockets, onSave, onClose }) {
  const [type, setType] = useState('out'), [amount, setAmount] = useState(''), [pocket, setPocket] = useState(pockets[0].name), [to, setTo] = useState((pockets[1] || pockets[0]).name), [category, setCategory] = useState('Food'), [note, setNote] = useState('')
  const bad = !(Number(amount) > 0) || (type === 'tr' && pocket === to)
  const save = () => onSave({ id: uid(), type, amount: Number(amount), pocket, ...(type === 'tr' ? { to, category: 'Transfer' } : { category, note }), date: new Date().toISOString() })
  return (
    <Sheet onClose={onClose}>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-paper p-1">
        {[['out', 'Expense'], ['in', 'Income'], ['tr', 'Transfer']].map(([k, l]) => <button key={k} onClick={() => { setType(k); setCategory(k === 'in' ? 'Salary' : 'Food') }} className={'rounded-xl py-2 text-sm font-semibold ' + (type === k ? 'bg-azure text-white' : 'text-slate-500')}>{l}</button>)}
      </div>
      <Amount value={amount} onChange={setAmount} />
      {type !== 'tr' && <div className="flex flex-wrap gap-2">{(type === 'out' ? Object.keys(CATS) : INCOME).map(c => <button key={c} onClick={() => setCategory(c)} className={'rounded-full px-3 py-1.5 text-sm ' + (category === c ? 'bg-azure text-white' : 'bg-paper')}>{EMO[c]} {c}</button>)}</div>}
      <div className="grid grid-cols-2 gap-2">
        <Pick label={type === 'tr' ? 'From' : 'Account'} value={pocket} onChange={setPocket} pockets={pockets} />
        {type === 'tr' && <Pick label="To" value={to} onChange={setTo} pockets={pockets} />}
      </div>
      {type !== 'tr' && <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className={field} />}
      {type === 'tr' && pocket === to && <p className="text-sm text-down">Pick two different accounts.</p>}
      <Save off={bad} onClick={save}>{type === 'out' ? 'Save expense' : type === 'in' ? 'Save income' : 'Transfer'}</Save>
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

const TABS = [['home', 'Home'], ['activity', 'Activity'], ['insights', 'Insights'], ['budgets', 'Budgets'], ['goals', 'Goals']]
const ICONS = { home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', activity: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', insights: 'M18 20V10M12 20V4M6 20v-6', budgets: 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z', goals: 'M4 22V4M4 4h14l-3 5 3 5H4' }
const Icon = ({ k }) => <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[k]} /></svg>

export default function App() {
  const [tab, setTab] = useState('home'), [sheet, setSheet] = useState(null)
  const [pockets, setPockets] = useStore('budgie.pockets', ['Cash', 'Bank', 'Airtel Money', 'Mpamba'].map(name => ({ id: uid(), name, balance: 0 })))
  const [txs, setTxs] = useStore('budgie.txs', [])
  const [budgets, setBudgets] = useStore('budgie.budgets', {})
  const [goals, setGoals] = useStore('budgie.goals', [])
  const apply = (t, s) => setPockets(ps => ps.map(p => { let d = 0; if (p.name === t.pocket) d += t.type === 'in' ? t.amount : -t.amount; if (t.type === 'tr' && p.name === t.to) d += t.amount; return d ? { ...p, balance: p.balance + s * d } : p }))
  const save = t => { apply(t, 1); setTxs(x => [t, ...x]); setSheet(null) }
  const del = t => { apply(t, -1); setTxs(x => x.filter(y => y.id !== t.id)); if (t.type === 'sv') setGoals(gs => gs.map(g => g.id === t.goalId ? { ...g, saved: Math.max(0, g.saved - t.amount) } : g)) }
  const fund = t => { save(t); setGoals(gs => gs.map(g => g.id === t.goalId ? { ...g, saved: g.saved + t.amount } : g)) }
  const addAccount = (name, bal) => {
    setPockets(ps => [...ps, { id: uid(), name, balance: 0 }])
    if (bal) save({ id: uid(), type: 'in', amount: bal, pocket: name, category: 'Other', note: 'Opening balance', date: new Date().toISOString() })
    setSheet(null)
  }
  const h = new Date().getHours(), greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <header className="px-5 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        <p className="text-sm text-slate-500">{tab === 'home' ? greet : 'Budgie'}</p>
        <h1 className="text-2xl font-bold text-navy">{tab === 'home' ? 'Your money' : TABS.find(t => t[0] === tab)[1]}</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 pb-36">
        {tab === 'home' && <Home pockets={pockets} txs={txs} budgets={budgets} setTab={setTab} onAccount={() => setSheet('account')} />}
        {tab === 'activity' && <Activity txs={txs} onDelete={del} />}
        {tab === 'insights' && <Insights txs={txs} pockets={pockets} />}
        {tab === 'budgets' && <Budgets budgets={budgets} setBudgets={setBudgets} txs={txs} />}
        {tab === 'goals' && <Goals goals={goals} setGoals={setGoals} onFund={g => setSheet({ fund: g })} />}
      </main>
      <button onClick={() => setSheet('add')} aria-label="Add transaction" className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-10 grid h-14 w-14 place-items-center rounded-full bg-azure text-3xl text-white shadow-lg shadow-azure/40 active:scale-95">+</button>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md justify-around border-t border-black/5 bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/5">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ' + (tab === k ? 'text-azure' : 'text-slate-400')}><span className={'rounded-full px-4 py-1 ' + (tab === k ? 'bg-azure/15' : '')}><Icon k={k} /></span>{l}</button>)}
      </nav>
      {sheet === 'add' && <AddSheet pockets={pockets} onSave={save} onClose={() => setSheet(null)} />}
      {sheet === 'account' && <AccountSheet onSave={addAccount} onClose={() => setSheet(null)} />}
      {sheet?.fund && <FundSheet goal={sheet.fund} pockets={pockets} onSave={fund} onClose={() => setSheet(null)} />}
    </div>
  )
}
