// Loan screens: money you owe and money owed to you. Kept in its own file so App.jsx barely grows.
// Sheet, Save, Amount, Pick and mk are small copies of the ones in App.jsx (importing App.jsx from here would be a
// circular import). If the originals change, change these too.
import { useState } from 'react'
import { mask } from './security.jsx'
import { ymd, loanState, loanTotals } from './logic.js'

const mk = n => mask.on ? 'MK ••••' : (n < 0 ? '-MK ' : 'MK ') + Math.abs(Math.round(n)).toLocaleString()
const field = 'w-full rounded-2xl bg-paper px-4 py-3 outline-none focus:ring-2 focus:ring-azure/40'
const Sheet = ({ children, onClose }) => (
  <div className="fade-in fixed inset-0 z-30 flex items-end bg-black/50 lg:items-center lg:justify-center" onClick={onClose}>
    <div className="sheet-in mx-auto w-full max-w-md max-h-[92dvh] space-y-3 overflow-y-auto rounded-t-[2rem] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:mx-0 lg:max-w-lg lg:rounded-[2rem] lg:pb-6 lg:shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-mist lg:hidden" />{children}
    </div>
  </div>
)
const Save = ({ onClick, children, off }) => <button disabled={off} onClick={onClick} className="w-full rounded-2xl bg-azure py-3.5 text-lg font-semibold text-white disabled:opacity-40">{children}</button>
const Amount = ({ value, onChange }) => <input autoFocus type="number" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} placeholder="MK 0" className="w-full bg-transparent py-3 text-center text-4xl font-bold outline-none placeholder:text-mist" />
const Pick = ({ value, onChange, pockets, label }) => <label className="block text-xs text-slate-500">{label}<select value={value} onChange={e => onChange(e.target.value)} className={field + ' mt-1 text-base text-ink'}>{pockets.map(p => <option key={p.id}>{p.name}</option>)}</select></label>

const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const Bar = ({ pct, late }) => <div className="h-2 rounded-full bg-mist/40"><div className={'h-2 rounded-full ' + (late ? 'bg-down' : 'bg-azure')} style={{ width: pct + '%' }} /></div>
const Back = ({ onClick }) => <button onClick={onClick} className="text-sm font-semibold text-azure">‹ Back</button>
const Label = ({ text, children }) => <label className="block text-xs text-slate-500">{text}{children}</label>
const input = field + ' mt-1 text-base text-ink'

// A small summary for Home. Shows nothing until there is an open loan, so people who never use loans see no change.
export function LoanHomeCard({ loans, pays, onOpen }) {
  const t = loanTotals(loans, pays)
  if (!t.open) return null
  return (
    <button onClick={onOpen} className="w-full rounded-3xl border border-black/5 bg-surface p-4 text-left dark:border-white/5 lg:order-6 lg:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">Loans</h3>
        {t.overdue > 0 ? <span className="rounded-full bg-down/10 px-2.5 py-1 text-xs font-semibold text-down">{t.overdue} overdue</span> : <span className="text-sm font-semibold text-azure">Open</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-xs text-slate-500">You owe</p><p className={'font-semibold ' + (t.owe > 0 ? 'text-down' : '')}>{mk(t.owe)}</p></div>
        <div><p className="text-xs text-slate-500">Owed to you</p><p className={'font-semibold ' + (t.owed > 0 ? 'text-up' : '')}>{mk(t.owed)}</p></div>
      </div>
    </button>
  )
}

// Switch for "also record this in an account", with the account picker underneath when it is on.
function Link({ on, setOn, pocket, setPocket, pockets, text }) {
  return (
    <div className="space-y-2 rounded-2xl border border-black/5 p-3 dark:border-white/5">
      <button role="switch" aria-checked={on} disabled={!pockets.length} onClick={() => setOn(!on)} className="flex w-full items-center gap-3 text-left disabled:opacity-40">
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Also record in an account</span><span className="block text-xs text-slate-500">{pockets.length ? text : 'Add an account first to use this.'}</span></span>
        <span className={'h-6 w-11 shrink-0 rounded-full p-0.5 transition ' + (on ? 'bg-azure' : 'bg-mist')}><span className={'block h-5 w-5 rounded-full bg-white transition ' + (on ? 'translate-x-5' : '')} /></span>
      </button>
      {on && <Pick label="Account" value={pocket} onChange={setPocket} pockets={pockets} />}
    </div>
  )
}

function LoanForm({ pockets, onSave, onCancel }) {
  const today = ymd(new Date())
  const [dir, setDir] = useState('borrowed'), [who, setWho] = useState(''), [amount, setAmount] = useState(''), [total, setTotal] = useState('')
  const [date, setDate] = useState(today), [due, setDue] = useState(''), [note, setNote] = useState('')
  const [link, setLink] = useState(false), [pocket, setPocket] = useState(pockets[0]?.name || '')
  const amt = Number(amount), tot = total === '' ? amt : Number(total)
  const problem = !(amt > 0) ? '' : tot < amt ? "The total to pay back can't be less than the amount." : date > today ? 'Pick today or an earlier date.' : due && due < date ? "The due date can't be before the loan date." : ''
  const bad = !who.trim() || !(amt > 0) || !(tot > 0) || !!problem || !date || (link && !pocket)
  const b = dir === 'borrowed'
  return <>
    <div className="flex items-center justify-between"><Back onClick={onCancel} /><h3 className="font-semibold">New loan</h3><span className="w-10" /></div>
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-paper p-1">
      {[['borrowed', 'I borrowed'], ['lent', 'I lent']].map(([k, l]) => <button key={k} onClick={() => setDir(k)} className={'rounded-xl py-2 text-sm font-semibold ' + (dir === k ? 'bg-azure text-white' : 'text-slate-500')}>{l}</button>)}
    </div>
    <Amount value={amount} onChange={setAmount} />
    <input value={who} onChange={e => setWho(e.target.value)} placeholder={b ? 'Who lent you the money?' : 'Who did you lend to?'} className={field} />
    <Label text={b ? 'Total to pay back (optional, if more than you borrowed)' : 'Total to get back (optional, if more than you lent)'}><input type="number" inputMode="numeric" value={total} onChange={e => setTotal(e.target.value)} placeholder={amt > 0 ? 'MK ' + amt : 'MK 0'} className={input} /></Label>
    <div className="grid grid-cols-2 gap-2">
      <Label text="Date"><input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className={input} /></Label>
      <Label text="Due date (optional)"><input type="date" value={due} min={date} onChange={e => setDue(e.target.value)} className={input} /></Label>
    </div>
    <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className={field} />
    <Link on={link} setOn={setLink} pocket={pocket} setPocket={setPocket} pockets={pockets} text={b ? 'Adds the money to the account you choose.' : 'Takes the money out of the account you choose.'} />
    {problem && <p className="text-sm text-down">{problem}</p>}
    <Save off={bad} onClick={() => onSave({ dir, who: who.trim(), amount: amt, total: tot, date, due, note: note.trim() }, link ? pocket : null)}>Save loan</Save>
  </>
}

function PayForm({ loan, left, pockets, onSave, onCancel }) {
  const today = ymd(new Date())
  const [amount, setAmount] = useState(left > 0 ? String(left) : ''), [date, setDate] = useState(today), [note, setNote] = useState('')
  const [link, setLink] = useState(false), [pocket, setPocket] = useState(pockets[0]?.name || '')
  const b = loan.dir === 'borrowed', bad = !(Number(amount) > 0) || !date || date > today || (link && !pocket)
  return <>
    <div className="flex items-center justify-between"><Back onClick={onCancel} /><h3 className="font-semibold">{b ? 'Record a repayment' : 'Record money received'}</h3><span className="w-10" /></div>
    <p className="text-center text-sm text-slate-500">{b ? 'To ' : 'From '}{loan.who} · {mk(left)} left</p>
    <Amount value={amount} onChange={setAmount} />
    <Label text="Date"><input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className={input} /></Label>
    <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className={field} />
    <Link on={link} setOn={setLink} pocket={pocket} setPocket={setPocket} pockets={pockets} text={b ? 'Takes the money out of the account you choose.' : 'Adds the money to the account you choose.'} />
    {date > today && <p className="text-sm text-down">Pick today or an earlier date.</p>}
    <Save off={bad} onClick={() => onSave({ loanId: loan.id, amount: Number(amount), date, note: note.trim() }, link ? pocket : null)}>Save</Save>
  </>
}

// Only the details that are safe to change after the fact. The amount, date and direction stay as they were,
// because an account transaction may already have been made from them.
function EditForm({ loan, onSave, onCancel }) {
  const [who, setWho] = useState(loan.who), [total, setTotal] = useState(String(loan.total)), [due, setDue] = useState(loan.due || ''), [note, setNote] = useState(loan.note || '')
  const tot = Number(total), problem = tot > 0 && tot < loan.amount ? `The total can't be less than the ${mk(loan.amount)} ${loan.dir === 'borrowed' ? 'borrowed' : 'lent'}.` : due && due < loan.date ? "The due date can't be before the loan date." : ''
  return <>
    <div className="flex items-center justify-between"><Back onClick={onCancel} /><h3 className="font-semibold">Edit loan</h3><span className="w-10" /></div>
    <p className="text-center text-sm text-slate-500">{loan.dir === 'borrowed' ? 'Borrowed' : 'Lent'} {mk(loan.amount)} on {fmt(loan.date)}</p>
    <input value={who} onChange={e => setWho(e.target.value)} placeholder="Name" className={field} />
    <Label text="Total to pay back"><input type="number" inputMode="numeric" value={total} onChange={e => setTotal(e.target.value)} className={input} /></Label>
    <Label text="Due date (optional)"><input type="date" value={due} min={loan.date} onChange={e => setDue(e.target.value)} className={input} /></Label>
    <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className={field} />
    {problem && <p className="text-sm text-down">{problem}</p>}
    <Save off={!who.trim() || !(tot > 0) || !!problem} onClick={() => onSave({ ...loan, who: who.trim(), total: tot, due, note: note.trim() })}>Save changes</Save>
  </>
}

export function LoansSheet({ loans, pays, pockets, onAdd, onPay, onEdit, onDropPay, onDropLoan, onClose }) {
  const [view, setView] = useState({ k: 'list' }), [seg, setSeg] = useState('borrowed'), [showDone, setShowDone] = useState(false)
  const today = ymd(new Date())
  const loan = view.id ? loans.find(l => l.id === view.id) : null
  const v = view.id && !loan ? { k: 'list' } : view // the loan was removed (for example by sync) while it was open
  const list = () => setView({ k: 'list' }), detail = l => setView({ k: 'loan', id: l.id })
  const wrap = body => <Sheet onClose={onClose}>{body}</Sheet>

  if (v.k === 'new') return wrap(<LoanForm pockets={pockets} onCancel={list} onSave={(l, pocket) => { onAdd(l, pocket); setSeg(l.dir); list() }} />)
  if (v.k === 'edit') return wrap(<EditForm loan={loan} onCancel={() => detail(loan)} onSave={l => { onEdit(l); detail(l) }} />)
  if (v.k === 'pay') return wrap(<PayForm loan={loan} left={loanState(loan, pays, today).left} pockets={pockets} onCancel={() => detail(loan)} onSave={(p, pocket) => { onPay(p, pocket); detail(loan) }} />)

  if (v.k === 'loan') {
    const s = loanState(loan, pays, today), b = loan.dir === 'borrowed'
    const mine = pays.filter(p => p.loanId === loan.id).sort((a, c) => c.date.localeCompare(a.date))
    const linked = (loan.txId ? 1 : 0) + mine.filter(p => p.txId).length
    const dropPay = p => confirm(p.txId ? 'Delete this payment? The matching transaction is removed from your account too.' : 'Delete this payment?') && onDropPay(p)
    const dropLoan = () => {
      if (!confirm(`Delete this loan${mine.length ? ` and its ${mine.length} payment${mine.length > 1 ? 's' : ''}` : ''}?`)) return
      const undo = linked > 0 && confirm(`Also remove the ${linked} matching transaction${linked > 1 ? 's' : ''} from your accounts?\n\nOK removes them and your balances change back. Cancel keeps them.`)
      onDropLoan(loan, undo); list()
    }
    return wrap(<>
      <div className="flex items-center justify-between"><Back onClick={list} /><h3 className="truncate px-2 font-semibold">{loan.who}</h3><button onClick={() => setView({ k: 'edit', id: loan.id })} className="text-sm font-semibold text-azure">Edit</button></div>
      <div className="text-center">
        <p className="text-sm text-slate-500">{b ? 'You borrowed from ' : 'You lent to '}{loan.who}</p>
        <p className="text-4xl font-bold">{mk(s.left)}</p>
        <p className="text-sm text-slate-500">{s.settled ? 'Settled' : b ? 'left to pay' : 'left to get back'}</p>
      </div>
      <Bar pct={s.pct} late={s.overdue} />
      <div className="space-y-1.5 rounded-2xl bg-paper p-3 text-sm">
        {[[b ? 'Borrowed' : 'Lent', mk(loan.amount)], [b ? 'Total to pay back' : 'Total to get back', mk(loan.total)], [b ? 'Paid so far' : 'Received so far', mk(s.paid)], ['Date', fmt(loan.date)], ...(loan.due ? [['Due', fmt(loan.due) + (s.overdue ? ' (overdue)' : '')]] : [])].map(([l, x]) => <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span className={'font-medium ' + (l === 'Due' && s.overdue ? 'text-down' : '')}>{x}</span></div>)}
        {loan.note && <p className="border-t border-black/5 pt-1.5 text-slate-500 dark:border-white/5">{loan.note}</p>}
      </div>
      {!s.settled && <Save onClick={() => setView({ k: 'pay', id: loan.id })}>{b ? 'Record a repayment' : 'Record money received'}</Save>}
      <div>
        <h4 className="mb-1 text-sm font-semibold">{b ? 'Repayments' : 'Money received'}</h4>
        {mine.length === 0 ? <p className="text-sm text-slate-500">Nothing recorded yet.</p> : <div className="divide-y divide-black/5 dark:divide-white/5">{mine.map(p => (
          <div key={p.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1"><p className="font-medium">{mk(p.amount)}</p><p className="truncate text-xs text-slate-500">{fmt(p.date)}{p.note ? ' · ' + p.note : ''}{p.txId ? ' · in account' : ''}</p></div>
            <button onClick={() => dropPay(p)} className="text-xs text-down">Delete</button>
          </div>
        ))}</div>}
      </div>
      <button onClick={dropLoan} className="w-full py-1 text-sm font-semibold text-down">Delete loan</button>
    </>)
  }

  const t = loanTotals(loans, pays, today), mineSeg = loans.filter(l => l.dir === seg)
  const withS = mineSeg.map(l => ({ l, s: loanState(l, pays, today) }))
  const open = withS.filter(x => !x.s.settled).sort((a, c) => (a.l.due || '9999').localeCompare(c.l.due || '9999')), done = withS.filter(x => x.s.settled)
  const row = ({ l, s }) => (
    <button key={l.id} onClick={() => detail(l)} className="block w-full space-y-1.5 rounded-2xl border border-black/5 p-3 text-left active:bg-paper dark:border-white/5">
      <div className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold">{l.who}</span><span className="shrink-0 font-semibold">{s.settled ? 'Settled' : mk(s.left)}</span></div>
      <Bar pct={s.pct} late={s.overdue} />
      <div className="flex justify-between text-xs text-slate-500"><span>{mk(s.paid)} of {mk(l.total)}</span><span className={s.overdue ? 'font-semibold text-down' : ''}>{s.overdue ? 'Overdue since ' + fmt(l.due) : l.due && !s.settled ? 'Due ' + fmt(l.due) : fmt(l.date)}</span></div>
    </button>
  )
  return wrap(<>
    <h3 className="text-center font-semibold">Loans</h3>
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-paper p-1">
      {[['borrowed', 'I owe', t.owe], ['lent', 'Owed to me', t.owed]].map(([k, l, n]) => <button key={k} onClick={() => setSeg(k)} className={'rounded-xl py-2 text-sm font-semibold ' + (seg === k ? 'bg-azure text-white' : 'text-slate-500')}>{l}<span className="block text-xs font-normal opacity-90">{mk(n)}</span></button>)}
    </div>
    {open.length === 0 && done.length === 0 && <p className="py-4 text-center text-sm text-slate-500">{seg === 'borrowed' ? 'Money you borrow will show here.' : 'Money you lend will show here.'}</p>}
    {open.length === 0 && done.length > 0 && <p className="py-2 text-center text-sm text-slate-500">Nothing outstanding.</p>}
    <div className="space-y-2">{open.map(row)}</div>
    {done.length > 0 && <>
      <button onClick={() => setShowDone(!showDone)} className="w-full py-1 text-sm font-semibold text-azure">{showDone ? 'Hide' : 'Show'} settled ({done.length})</button>
      {showDone && <div className="space-y-2">{done.map(row)}</div>}
    </>}
    <Save onClick={() => setView({ k: 'new' })}>+ New loan</Save>
  </>)
}
