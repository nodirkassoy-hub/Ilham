import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { BookOpen, Check, Link2, Lock, Plus, Trash2 } from 'lucide-react'
import { useAction, useSession } from '@/app/useSession'
import { useI18nStore, useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Ledger, accountLedger, trialBalance } from '@/core/services/accounting'
import { Badge, Button, Card, ConfirmModal, Drawer, Field, Input, Modal, SectionHeader, Select, StatusBadge, Tabs } from '@/ui/primitives'
import { DataTable, type Column } from '@/ui/DataTable'
import { AccessDenied, Can, PlanGate, ReadOnlyBanner, Scoped } from '@/ui/gates'
import { cx, fmtDate, isoDate, money, sum } from '@/core/utils/format'
import type { Account, JournalEntry } from '@/core/domain/entities'
import type { DictKey } from '@/core/i18n/uz'

export default function AccountingPages() {
  return (
    <PlanGate feature="accounting.full">
      <Routes>
        <Route index element={<Navigate to="journal" replace />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="coa" element={<CoaPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route path="taxes" element={<TaxesPage />} />
        <Route path="periods" element={<PeriodsPage />} />
      </Routes>
    </PlanGate>
  )
}

function SubNav() {
  const t = useT()
  const nav = useNavigate()
  const { can, has } = useSession()
  const path = window.location.pathname.split('/').pop() as string
  const tabs = [
    can('journal.view') && { value: 'journal', label: t('acc.journal') },
    can('chartofaccounts.view') && { value: 'coa', label: t('acc.coa') },
    can('ledger.view') && { value: 'ledger', label: t('acc.ledger') },
    can('reconciliation.view') && { value: 'reconciliation', label: t('acc.reconciliation'), locked: !has('bank.reconciliation') },
    can('taxes.view') && { value: 'taxes', label: t('acc.taxes') },
    can('periodclose.view') && { value: 'periods', label: t('acc.periods') },
  ].filter(Boolean) as { value: string; label: string; locked?: boolean }[]
  return <Tabs value={path} onChange={(v) => nav(`/app/accounting/${v}`)} tabs={tabs} />
}

/* --------------------------------------------------------------- Journal */

function JournalPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const [sel, setSel] = useState<JournalEntry | null>(null)
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('ALL')
  if (!tenant || !can('journal.view')) return <AccessDenied perm="journal.view" />
  const rows = [...tenant.journal].reverse().filter((e) => source === 'ALL' || e.source === source)
  const cols: Column<JournalEntry>[] = [
    { key: 'n', header: '№', cell: (e) => <span className="font-mono text-xs">{e.number}</span>, sortValue: (e) => e.number },
    { key: 'd', header: t('common.date'), cell: (e) => <span className="text-muted">{fmtDate(e.date, lang)}</span>, sortValue: (e) => e.date },
    { key: 'memo', header: t('acc.entry.memo'), cell: (e) => <span className="font-medium">{e.memo}</span> },
    { key: 'src', header: t('acc.entry.source'), cell: (e) => <Badge tone="muted">{e.source}</Badge>, hideBelow: 'md' },
    { key: 'lines', header: '', cell: (e) => <span className="text-2xs text-faint">{e.lines.length} qator</span>, hideBelow: 'lg' },
    { key: 'amt', header: t('common.amount'), cell: (e) => <span className="tnum font-medium">{money(e.totalDebit)}</span>, sortValue: (e) => e.totalDebit, align: 'right' },
    { key: 'bal', header: '', cell: (e) => Math.abs(e.totalDebit - e.totalCredit) < 2 ? <Badge tone="success" size="xs"><Check size={9} /> {t('acc.balanced')}</Badge> : <Badge tone="danger" size="xs">{t('acc.unbalanced')}</Badge>, align: 'right' },
  ]
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader title={t('acc.title')} sub={t('acc.sub')} actions={<Can perm="journal.create"><Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>{t('acc.newEntry')}</Button></Can>} />
      <SubNav />
      <DataTable rows={rows} columns={cols} rowKey={(e) => e.id} searchable={(e) => `${e.number} ${e.memo}`} onRowClick={setSel} pageSize={15} emptyTitle={t('acc.empty')}
        toolbar={<Select value={source} onChange={(e) => setSource(e.target.value)} className="h-9 w-44"><option value="ALL">{t('common.all')}</option>{['SALES', 'PURCHASES', 'BANK', 'PAYROLL', 'PRODUCTION', 'MANUAL', 'FIXED_ASSET', 'OPENING'].map((s) => <option key={s} value={s}>{s}</option>)}</Select>} />
      <EntryDrawer entry={sel} onClose={() => setSel(null)} />
      <ManualEntryModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function EntryDrawer({ entry, onClose }: { entry: JournalEntry | null; onClose: () => void }) {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant } = useSession()
  if (!entry || !tenant) return null
  const acc = (id: string) => tenant.accounts.find((a) => a.id === id)
  return (
    <Drawer open={!!entry} onClose={onClose} title={`${entry.number} · ${entry.memo}`}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2"><Badge tone="muted">{entry.source}</Badge><Badge tone="muted">{fmtDate(entry.date, lang, true)}</Badge><StatusBadge status={entry.status} /><span className="ml-auto text-xs text-faint">{tenant.members.find((m) => m.id === entry.createdByMemberId)?.fullName}</span></div>
        <table className="w-full">
          <thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="py-2 text-left font-medium">{t('acc.entry.account')}</th><th className="py-2 text-right font-medium">{t('acc.debit')}</th><th className="py-2 text-right font-medium">{t('acc.credit')}</th></tr></thead>
          <tbody>{entry.lines.map((l) => { const a = acc(l.accountId); return <tr key={l.id} className="border-b last:border-0"><td className="py-2"><span className="font-mono text-xs text-muted">{a?.code}</span> {a?.name}<span className="block text-2xs text-faint">{l.memo}</span></td><td className="py-2 text-right tnum text-brand">{l.debit ? money(l.debit, { currency: '' }) : ''}</td><td className="py-2 text-right tnum text-sky">{l.credit ? money(l.credit, { currency: '' }) : ''}</td></tr> })}</tbody>
          <tfoot><tr className="font-semibold"><td className="py-2">{t('common.total')}</td><td className="py-2 text-right tnum">{money(entry.totalDebit, { currency: '' })}</td><td className="py-2 text-right tnum">{money(entry.totalCredit, { currency: '' })}</td></tr></tfoot>
        </table>
      </div>
    </Drawer>
  )
}

function ManualEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { tenant } = useSession()
  const post = useAppStore((s) => s.postManualEntry)
  const run = useAction()
  const [date, setDate] = useState(isoDate())
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }])
  if (!tenant) return null
  const d = sum(lines, (l) => l.debit)
  const c = sum(lines, (l) => l.credit)
  const ok = memo && d > 0 && Math.abs(d - c) < 1 && lines.every((l) => l.accountId)
  return (
    <Modal open={open} onClose={onClose} title={t('acc.newEntry')} size="lg" footer={<><span className={cx('mr-auto text-sm', Math.abs(d - c) < 1 && d > 0 ? 'text-success' : 'text-warning')}>{t('acc.debit')} {money(d, { compact: true })} · {t('acc.credit')} {money(c, { compact: true })} {Math.abs(d - c) < 1 && d > 0 ? `✓ ${t('acc.balanced')}` : ''}</span><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!ok} onClick={() => { run(() => post({ date, memo, lines }), { title: t('acc.posted') }); onClose(); setLines([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }]); setMemo('') }}>{t('acc.post')}</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-[160px_1fr] gap-3"><Field label={t('acc.entry.date')}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label={t('acc.entry.memo')} required><Input value={memo} onChange={(e) => setMemo(e.target.value)} /></Field></div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_130px_130px_auto] items-end gap-2">
            <Field label={i === 0 ? t('acc.entry.account') : undefined}><Select value={l.accountId} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, accountId: e.target.value } : x)))}><option value="">—</option>{tenant.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</Select></Field>
            <Field label={i === 0 ? t('acc.debit') : undefined}><Input type="number" value={l.debit || ''} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, debit: Number(e.target.value), credit: 0 } : x)))} /></Field>
            <Field label={i === 0 ? t('acc.credit') : undefined}><Input type="number" value={l.credit || ''} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, credit: Number(e.target.value), debit: 0 } : x)))} /></Field>
            <Button variant="ghost" size="sm" onClick={() => setLines(lines.length > 2 ? lines.filter((_, k) => k !== i) : lines)}><Trash2 size={14} /></Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setLines([...lines, { accountId: '', debit: 0, credit: 0 }])}>{t('common.add')}</Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------- COA */

function CoaPage() {
  const t = useT()
  const { tenant, can } = useSession()
  const tb = useMemo(() => (tenant ? trialBalance(new Ledger(tenant.accounts), tenant.journal) : []), [tenant])
  if (!tenant || !can('chartofaccounts.view')) return <AccessDenied perm="chartofaccounts.view" />
  const groups: Account['type'][] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'OTHER_INCOME', 'COGS', 'EXPENSE']
  const labels: Record<Account['type'], string> = { ASSET: 'Aktivlar', LIABILITY: 'Majburiyatlar', EQUITY: 'Kapital', REVENUE: 'Daromadlar', OTHER_INCOME: 'Boshqa daromadlar', COGS: 'Tannarx', EXPENSE: 'Xarajatlar' }
  const sensitive: Partial<Record<Account['type'], 'finance.revenue.view' | 'finance.expense.view' | 'finance.cash.view'>> = { REVENUE: 'finance.revenue.view', OTHER_INCOME: 'finance.revenue.view', COGS: 'finance.expense.view', EXPENSE: 'finance.expense.view' }
  return (
    <div className="space-y-6">
      <SectionHeader title={t('acc.coa')} sub="O‘zbekiston milliy hisoblar rejasi (NSBU 21) asosida." />
      <SubNav />
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => {
          const accs = tenant.accounts.filter((a) => a.type === g)
          if (!accs.length) return null
          return (
            <Card key={g} padded={false}>
              <div className="flex items-center justify-between border-b px-5 py-3"><p className="text-sm font-semibold">{labels[g]}</p><Badge tone="muted">{accs.length}</Badge></div>
              <ul className="divide-y">{accs.map((a) => { const b = tb.find((x) => x.account.id === a.id); const scope = sensitive[g] ?? (a.systemKey === 'CASH' ? 'finance.cash.view' : a.systemKey === 'BANK_MAIN' ? 'finance.bank.view' : null); return (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm"><span className="flex items-center gap-3"><span className="font-mono text-xs text-muted">{a.code}</span><span>{a.name}</span>{a.isSystem && <Lock size={10} className="text-faint" />}</span>{scope ? <Scoped scope={scope} compact><span className="tnum text-muted">{money(b?.balance ?? 0, { compact: true })}</span></Scoped> : <span className="tnum text-muted">{money(b?.balance ?? 0, { compact: true })}</span>}</li>
              ) })}</ul>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Ledger */

function LedgerPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const [accId, setAccId] = useState('')
  const rows = useMemo(() => (tenant && accId ? accountLedger(tenant.journal, accId).reverse() : []), [tenant, accId])
  if (!tenant || !can('ledger.view')) return <AccessDenied perm="ledger.view" />
  const acc = tenant.accounts.find((a) => a.id === accId)
  const scope = acc ? (acc.type === 'REVENUE' || acc.type === 'OTHER_INCOME' ? 'finance.revenue.view' : acc.type === 'EXPENSE' || acc.type === 'COGS' ? 'finance.expense.view' : acc.systemKey === 'CASH' ? 'finance.cash.view' : acc.systemKey === 'BANK_MAIN' ? 'finance.bank.view' : null) : null
  return (
    <div className="space-y-6">
      <SectionHeader title={t('acc.ledger')} sub="Hisob bo‘yicha barcha o‘tkazmalar va yig‘ma qoldiq." />
      <SubNav />
      <Card padded={false}>
        <div className="border-b p-3"><Select value={accId} onChange={(e) => setAccId(e.target.value)} className="h-9 max-w-md"><option value="">{t('acc.entry.account')}…</option>{tenant.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</Select></div>
        {acc && scope && !can(scope) ? (
          <div className="p-10 text-center text-sm text-muted"><Lock size={18} className="mx-auto mb-2 text-faint" />{t('access.scope.body')}</div>
        ) : (
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-2xs uppercase text-faint"><tr className="border-b"><th className="px-4 py-2 text-left font-medium">{t('common.date')}</th><th className="px-4 py-2 text-left font-medium">№ / {t('acc.entry.memo')}</th><th className="px-4 py-2 text-right font-medium">{t('acc.debit')}</th><th className="px-4 py-2 text-right font-medium">{t('acc.credit')}</th><th className="px-4 py-2 text-right font-medium">Qoldiq</th></tr></thead>
              <tbody>{rows.slice(0, 300).map((r) => <tr key={r.line.id} className="border-b last:border-0"><td className="px-4 py-2 text-muted">{fmtDate(r.entry.date, lang)}</td><td className="px-4 py-2"><span className="font-mono text-xs text-muted">{r.entry.number}</span> {r.line.memo}</td><td className="px-4 py-2 text-right tnum text-brand">{r.line.debit ? money(r.line.debit, { currency: '' }) : ''}</td><td className="px-4 py-2 text-right tnum text-sky">{r.line.credit ? money(r.line.credit, { currency: '' }) : ''}</td><td className="px-4 py-2 text-right tnum font-medium">{money(r.running, { currency: '' })}</td></tr>)}{!rows.length && <tr><td colSpan={5} className="p-10 text-center text-faint">{accId ? t('common.empty') : 'Hisobni tanlang'}</td></tr>}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

/* -------------------------------------------------------- Reconciliation */

function ReconciliationPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const match = useAppStore((s) => s.matchBankLine)
  const run = useAction()
  const [pick, setPick] = useState<string | null>(null)
  if (!tenant || !can('reconciliation.view')) return <AccessDenied perm="reconciliation.view" />
  const bank = tenant.bankAccounts[0]
  const unmatched = tenant.bankLines.filter((l) => !l.matched)
  const candidates = tenant.payments.filter((p) => p.bankAccountId === bank?.id && p.status !== 'RECONCILED')
  return (
    <PlanGate feature="bank.reconciliation">
      <div className="space-y-6">
        <ReadOnlyBanner />
        <SectionHeader title={t('acc.reconciliation')} sub={t('acc.recon.feed')} />
        <SubNav />
        <div className="grid gap-4 lg:grid-cols-3">
          {tenant.bankAccounts.map((b) => <Card key={b.id}><div className="flex items-center justify-between"><p className="text-sm font-semibold">{b.name}</p><Badge tone={b.feedConnected ? 'success' : 'muted'}>{b.feedConnected ? t('set.integrations.status.ready') : t('set.integrations.status.none')}</Badge></div><p className="mt-1 font-mono text-xs text-faint">{b.bankName} · {b.accountNumber}</p><Scoped scope="finance.bank.view"><p className="mt-3 text-xl font-semibold tnum">{b.currency === 'UZS' ? money(trialBalance(new Ledger(tenant.accounts), tenant.journal).find((x) => x.account.id === b.accountId)?.balance ?? 0) : `${b.balance.toLocaleString()} ${b.currency}`}</p></Scoped></Card>)}
          <Card><p className="text-sm font-semibold">{t('acc.recon.unmatched')}</p><p className={cx('mt-3 text-3xl font-semibold tnum', unmatched.length && 'text-warning')}>{unmatched.length}</p><p className="text-xs text-muted">{tenant.bankLines.length} qatordan</p></Card>
        </div>
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="px-4 py-2 text-left font-medium">{t('common.date')}</th><th className="px-4 py-2 text-left font-medium">Bank yozuvi</th><th className="px-4 py-2 text-right font-medium">{t('common.amount')}</th><th className="px-4 py-2 text-left font-medium">{t('nav.payments')}</th><th className="px-4 py-2 text-right font-medium">{t('common.status')}</th></tr></thead>
            <tbody>{tenant.bankLines.map((l) => { const p = tenant.payments.find((x) => x.id === l.matchedPaymentId); return (
              <tr key={l.id} className="border-b last:border-0"><td className="px-4 py-2 text-muted">{fmtDate(l.date, lang)}</td><td className="px-4 py-2">{l.description}</td><td className={cx('px-4 py-2 text-right tnum font-medium', l.amount < 0 && 'text-warning')}><Scoped scope="finance.bank.view" compact>{money(l.amount)}</Scoped></td><td className="px-4 py-2">{p ? <span className="font-mono text-xs">{p.number}</span> : can('reconciliation.edit') ? <Button size="xs" variant="secondary" icon={<Link2 size={12} />} onClick={() => setPick(l.id)}>{t('acc.recon.match')}</Button> : <span className="text-faint">—</span>}</td><td className="px-4 py-2 text-right">{l.matched ? <Badge tone="success" dot>OK</Badge> : <Badge tone="warning" dot>{t('acc.recon.unmatched')}</Badge>}</td></tr>
            ) })}</tbody>
          </table>
        </Card>
        <Modal open={!!pick} onClose={() => setPick(null)} title={t('acc.recon.match')} size="sm">
          <ul className="max-h-80 space-y-1 overflow-y-auto">{candidates.map((p) => <li key={p.id}><button onClick={() => { run(() => match(pick!, p.id), { title: t('common.saved') }); setPick(null) }} className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm hover:bg-line/6"><span><span className="font-mono text-xs">{p.number}</span> <span className="text-xs text-faint">{fmtDate(p.paidAt, lang)}</span></span><span className="tnum">{p.direction === 'OUT' ? '−' : '+'}{money(p.amount, { compact: true })}</span></button></li>)}{!candidates.length && <li className="text-sm text-faint">{t('common.empty')}</li>}</ul>
        </Modal>
      </div>
    </PlanGate>
  )
}

/* ----------------------------------------------------------------- Taxes */

function TaxesPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const file = useAppStore((s) => s.fileTax)
  const run = useAction()
  if (!tenant || !can('taxes.view')) return <AccessDenied perm="taxes.view" />
  return (
    <div className="space-y-6">
      <SectionHeader title={t('acc.taxes')} sub={t('acc.tax.disclaimer')} />
      <SubNav />
      <Scoped scope="finance.tax.view" fallback={<Card className="text-center text-sm text-muted"><Lock size={18} className="mx-auto mb-2 text-faint" />{t('access.scope.body')}</Card>}>
        <div className="grid gap-4 md:grid-cols-3">
          {tenant.taxes.map((x) => (
            <Card key={x.id}>
              <div className="flex items-center justify-between"><p className="text-sm font-semibold">{t(`acc.tax.${x.taxType}` as DictKey)}</p><StatusBadge status={x.status} /></div>
              <p className="text-xs text-faint">{x.periodLabel} · {x.rate}%</p>
              <p className="mt-3 text-2xl font-semibold tnum">{money(x.amount)}</p>
              <p className="text-xs text-muted">Baza: {money(x.base, { compact: true })}</p>
              <div className="mt-3 flex items-center justify-between text-xs"><span className={cx(x.dueDate < isoDate() && x.status === 'DRAFT' ? 'text-danger' : 'text-muted')}>{t('acc.tax.due')}: {fmtDate(x.dueDate, lang)}</span>{x.status === 'DRAFT' && can('taxes.create') && <Button size="xs" variant="secondary" onClick={() => run(() => file(x.id), { title: t('common.saved') })}>{t('acc.tax.file')}</Button>}</div>
            </Card>
          ))}
        </div>
        <Card className="border-dashed text-xs text-muted">{t('acc.tax.disclaimer')} QQS: chiqish QQS (6411) − kirish QQS (4410) joriy davr o‘tkazmalaridan hisoblanadi.</Card>
      </Scoped>
    </div>
  )
}

/* --------------------------------------------------------------- Periods */

function PeriodsPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const close = useAppStore((s) => s.closePeriod)
  const run = useAction()
  const [confirm, setConfirm] = useState<string | null>(null)
  if (!tenant || !can('periodclose.view')) return <AccessDenied perm="periodclose.view" />
  const rows = [...tenant.periods].sort((a, b) => b.label.localeCompare(a.label))
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader title={t('acc.periods')} sub={t('acc.period.closeWarn')} />
      <SubNav />
      <Card padded={false}>
        <ul className="divide-y">{rows.map((p) => { const n = tenant.journal.filter((e) => e.periodId === p.id).length; return (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"><BookOpen size={16} className="text-faint" /><span className="font-mono font-medium">{p.label}</span><span className="text-xs text-muted">{fmtDate(p.startDate, lang)} — {fmtDate(p.endDate, lang)}</span><span className="text-xs text-faint">{n} o‘tkazma</span><span className="ml-auto flex items-center gap-2"><StatusBadge status={p.status} label={p.status === 'OPEN' ? t('acc.period.open') : p.status === 'SOFT_CLOSE' ? t('acc.period.soft') : t('acc.period.closed')} />{p.status !== 'CLOSED' && can('periodclose.approve') && p.endDate < isoDate() && <Button size="xs" variant="secondary" onClick={() => setConfirm(p.id)}>{t('acc.period.close')}</Button>}</span>{p.closedAt && <span className="w-full text-2xs text-faint sm:w-auto">{t('acc.period.closed')}: {fmtDate(p.closedAt, lang)} · {tenant.members.find((m) => m.id === p.closedByMemberId)?.fullName}</span>}</li>
        ) })}</ul>
      </Card>
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} title={t('acc.period.close')} body={t('acc.period.closeWarn')} danger onConfirm={() => { run(() => close(confirm!), { title: t('common.saved') }); setConfirm(null) }} />
    </div>
  )
}
