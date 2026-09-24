import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Clock, Lock, Plus, ShieldCheck, Wallet, X } from 'lucide-react'
import { useAction, useSession } from '@/app/useSession'
import { useI18nStore, useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Avatar, Badge, Button, Card, Drawer, Field, Input, Modal, SectionHeader, Select, StatusBadge, Tabs } from '@/ui/primitives'
import { DataTable, type Column } from '@/ui/DataTable'
import { AccessDenied, Can, LockedValue, PlanGate, ReadOnlyBanner } from '@/ui/gates'
import { cx, fmtDate, isoDate, money } from '@/core/utils/format'
import type { Employee, PayrollRun } from '@/core/domain/entities'
import { EMPLOYMENT_TYPES, type EmploymentType } from '@/core/domain/enums'
import type { DictKey } from '@/core/i18n/uz'

export default function HrPages() {
  return (
    <PlanGate feature="hr">
      <Routes>
        <Route index element={<Navigate to="employees" replace />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="payroll" element={<PayrollPage />} />
      </Routes>
    </PlanGate>
  )
}

function SubNav() {
  const t = useT()
  const nav = useNavigate()
  const { can, has } = useSession()
  const path = window.location.pathname.split('/').pop() as string
  const tabs = [can('employees.view') && { value: 'employees', label: t('hr.employees') }, can('attendance.view') && { value: 'attendance', label: t('hr.attendance') }, can('leave.view') && { value: 'leave', label: t('hr.leave') }, (can('payroll.view') || can('finance.salary.self.view')) && { value: 'payroll', label: t('hr.payroll'), locked: !has('payroll') }].filter(Boolean) as { value: string; label: string; locked?: boolean }[]
  return <Tabs value={path} onChange={(v) => nav(`/app/hr/${v}`)} tabs={tabs} />
}

/** Salary cell: own salary always visible (if granted), others' only with finance.salary.others.view. */
function SalaryCell({ e, children }: { e: Employee; children: React.ReactNode }) {
  const { can, member } = useSession()
  const own = e.memberId === member?.id
  if ((own && can('finance.salary.self.view')) || can('finance.salary.others.view')) return <>{children}</>
  return <LockedValue scope="finance.salary.others.view" compact />
}

function EmployeesPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const [sp] = useSearchParams()
  const { tenant, can, member } = useSession()
  const create = useAppStore((s) => s.createEmployee)
  const run = useAction()
  const [sel, setSel] = useState<Employee | null>(null)
  const [open, setOpen] = useState(sp.get('new') === '1')
  const [f, setF] = useState({ fullName: '', position: '', departmentId: '', baseSalary: 5_000_000, employmentType: 'FULL_TIME' as EmploymentType })
  if (!tenant) return null
  // A factory worker (attendance.create only) sees just their own card.
  const rows = can('employees.view') ? tenant.employees : tenant.employees.filter((e) => e.memberId === member?.id)
  if (!rows.length && !can('employees.view')) return <AccessDenied perm="employees.view" />
  const dept = (id: string | null) => tenant.departments.find((d) => d.id === id)?.name ?? '—'
  const cols: Column<Employee>[] = [
    { key: 'n', header: t('inv2.field.name'), cell: (e) => <div className="flex items-center gap-3"><Avatar name={e.fullName} size="sm" tone={tenant.members.find((m) => m.id === e.memberId)?.avatarTone ?? 'muted'} /><span className="min-w-0"><span className="block truncate font-medium">{e.fullName}</span><span className="text-2xs text-faint">{e.position}</span></span></div>, sortValue: (e) => e.fullName },
    { key: 'd', header: t('hr.field.department'), cell: (e) => <Badge tone="muted">{dept(e.departmentId)}</Badge>, sortValue: (e) => dept(e.departmentId), hideBelow: 'md' },
    { key: 'type', header: t('hr.field.employment'), cell: (e) => <span className="text-muted">{e.employmentType}</span>, hideBelow: 'lg' },
    { key: 'h', header: t('hr.field.hiredAt'), cell: (e) => <span className="text-muted">{fmtDate(e.hiredAt, lang)}</span>, sortValue: (e) => e.hiredAt, hideBelow: 'md' },
    { key: 'sal', header: t('hr.salary.base'), cell: (e) => <SalaryCell e={e}><span className="tnum">{money(e.baseSalary)}</span></SalaryCell>, align: 'right' },
    { key: 'role', header: t('set.members.role'), cell: (e) => { const m = tenant.members.find((x) => x.id === e.memberId); return m ? <Badge tone="brand" size="xs">{t(`role.${m.role}` as DictKey)}</Badge> : <span className="text-2xs text-faint">tizimga kirmaydi</span> }, hideBelow: 'lg' },
    { key: 's', header: t('common.status'), cell: (e) => <StatusBadge status={e.status === 'ACTIVE' ? 'ACTIVE' : e.status === 'ON_LEAVE' ? 'LEAVE' : 'CANCELLED'} label={e.status} />, align: 'right' },
  ]
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader title={t('hr.title')} sub={t('hr.sub')} actions={<Can perm="employees.create"><Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>{t('hr.newEmployee')}</Button></Can>} />
      <SubNav />
      {!can('finance.salary.others.view') && <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-xs text-muted"><ShieldCheck size={14} className="text-brand" />{t('hr.privacy')}</div>}
      <DataTable rows={rows} columns={cols} rowKey={(e) => e.id} searchable={(e) => `${e.fullName} ${e.position} ${dept(e.departmentId)}`} onRowClick={setSel} initialSort={{ key: 'n', dir: 'asc' }} emptyTitle={t('hr.empty')} />
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.fullName}>
        {sel && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3"><Avatar name={sel.fullName} size="lg" /><div><p className="font-semibold">{sel.position}</p><p className="text-xs text-muted">{dept(sel.departmentId)} · {tenant.branches.find((b) => b.id === sel.branchId)?.name}</p></div></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('hr.field.hiredAt')}</p><p className="font-medium">{fmtDate(sel.hiredAt, lang)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('hr.field.employment')}</p><p className="font-medium">{sel.employmentType}</p></div>
              <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('hr.salary.base')}</p><SalaryCell e={sel}><p className="font-medium tnum">{money(sel.baseSalary)}</p></SalaryCell></div>
              <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('onb.field.phone')}</p><p className="font-medium">{sel.phone || '—'}</p></div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{t('hr.attendance')} · 7 kun</p>
              <div className="flex gap-1">{tenant.attendance.filter((a) => a.employeeId === sel.id).slice(0, 7).reverse().map((a) => <span key={a.id} title={`${a.date} ${a.state}`} className={cx('h-7 flex-1 rounded-md', a.state === 'PRESENT' ? 'bg-success/60' : a.state === 'LATE' ? 'bg-warning/60' : a.state === 'LEAVE' || a.state === 'SICK' ? 'bg-sky/50' : 'bg-danger/60')} />)}</div>
            </div>
            <SalaryCell e={sel}>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{t('hr.payroll')}</p>
                <ul className="divide-y rounded-xl border">{tenant.payslips.filter((s) => s.employeeId === sel.id).slice(-4).reverse().map((s) => <li key={s.id} className="flex items-center justify-between px-3 py-2"><span className="font-mono text-xs">{s.periodLabel}</span><span className="tnum">{money(s.net)} <span className="text-2xs text-faint">/ {money(s.gross, { compact: true })}</span></span></li>)}</ul>
              </div>
            </SalaryCell>
          </div>
        )}
      </Drawer>
      <Modal open={open} onClose={() => setOpen(false)} title={t('hr.newEmployee')} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button disabled={!f.fullName || !f.position} onClick={() => { run(() => create({ ...f, departmentId: f.departmentId || null }), { title: t('common.saved') }); setOpen(false) }}>{t('common.create')}</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('onb.field.fullName')} required className="sm:col-span-2"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoFocus /></Field>
          <Field label={t('hr.field.position')} required><Input value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} /></Field>
          <Field label={t('hr.field.department')}><Select value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">—</option>{tenant.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label={t('hr.salary.base')}><Input type="number" value={f.baseSalary} onChange={(e) => setF({ ...f, baseSalary: Number(e.target.value) })} /></Field>
          <Field label={t('hr.field.employment')}><Select value={f.employmentType} onChange={(e) => setF({ ...f, employmentType: e.target.value as EmploymentType })}>{EMPLOYMENT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field>
        </div>
      </Modal>
    </div>
  )
}

function AttendancePage() {
  const t = useT()
  const { tenant, can, member } = useSession()
  const clockIn = useAppStore((s) => s.clockIn)
  const run = useAction()
  const [date, setDate] = useState(isoDate())
  if (!tenant || !can('attendance.view')) return <AccessDenied perm="attendance.view" />
  const me = tenant.employees.find((e) => e.memberId === member?.id)
  const rows = tenant.attendance.filter((a) => a.date === date)
  const counts = { PRESENT: 0, LATE: 0, LEAVE: 0, SICK: 0, ABSENT: 0 } as Record<string, number>
  for (const a of rows) counts[a.state] = (counts[a.state] ?? 0) + 1
  const mine = me ? rows.find((a) => a.employeeId === me.id) : null
  return (
    <div className="space-y-6">
      <SectionHeader title={t('hr.attendance')} sub={fmtDate(date)} actions={<><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />{me && date === isoDate() && can('attendance.create') && !mine && <Button icon={<Clock size={15} />} onClick={() => run(() => clockIn(me.id), { title: t('common.saved') })}>Kelganimni belgilash</Button>}</>} />
      <SubNav />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{(['PRESENT', 'LATE', 'LEAVE', 'SICK', 'ABSENT'] as const).map((s) => <Card key={s}><p className="text-2xs uppercase tracking-wider text-faint">{t(`hr.att.${s}` as DictKey)}</p><p className="mt-1 text-xl font-semibold tnum">{counts[s] ?? 0}</p></Card>)}</div>
      <Card padded={false}><table className="w-full text-sm"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="px-5 py-2 text-left font-medium">Xodim</th><th className="px-5 py-2 text-left font-medium">{t('hr.field.department')}</th><th className="px-5 py-2 text-right font-medium">Kelish</th><th className="px-5 py-2 text-right font-medium">Ketish</th><th className="px-5 py-2 text-right font-medium">{t('common.status')}</th></tr></thead><tbody>{tenant.employees.map((e) => { const a = rows.find((x) => x.employeeId === e.id); return <tr key={e.id} className={cx('border-b last:border-0', e.id === me?.id && 'bg-brand/5')}><td className="px-5 py-2 font-medium">{e.fullName}</td><td className="px-5 py-2 text-muted">{tenant.departments.find((d) => d.id === e.departmentId)?.name}</td><td className="px-5 py-2 text-right tnum">{a?.clockIn ?? '—'}</td><td className="px-5 py-2 text-right tnum">{a?.clockOut ?? '—'}</td><td className="px-5 py-2 text-right">{a ? <StatusBadge status={a.state} label={t(`hr.att.${a.state}` as DictKey)} /> : <span className="text-2xs text-faint">—</span>}</td></tr> })}</tbody></table></Card>
    </div>
  )
}

function LeavePage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const decide = useAppStore((s) => s.decideLeave)
  const run = useAction()
  if (!tenant || !can('leave.view')) return <AccessDenied perm="leave.view" />
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader title={t('hr.leave')} sub={`${tenant.leaves.filter((l) => l.status === 'PENDING').length} ta tasdiq kutmoqda`} />
      <SubNav />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tenant.leaves.map((l) => { const e = tenant.employees.find((x) => x.id === l.employeeId); return (
          <Card key={l.id}>
            <div className="flex items-start justify-between"><div className="flex items-center gap-3"><Avatar name={e?.fullName ?? '?'} size="sm" /><div><p className="font-medium">{e?.fullName}</p><p className="text-xs text-muted">{e?.position}</p></div></div><StatusBadge status={l.status} /></div>
            <div className="mt-3 flex items-center gap-2 text-sm"><Badge tone="muted">{l.type}</Badge><span className="text-muted">{fmtDate(l.startDate, lang)} — {fmtDate(l.endDate, lang)}</span><span className="ml-auto font-medium tnum">{l.days} kun</span></div>
            {l.note && <p className="mt-2 text-xs text-faint">{l.note}</p>}
            {l.status === 'PENDING' && can('leave.approve') && <div className="mt-3 flex gap-2"><Button size="sm" icon={<Check size={14} />} onClick={() => run(() => decide(l.id, true), { title: t('hr.leave.approve') })}>{t('hr.leave.approve')}</Button><Button size="sm" variant="danger" icon={<X size={14} />} onClick={() => run(() => decide(l.id, false), { title: t('hr.leave.reject') })}>{t('hr.leave.reject')}</Button></div>}
          </Card>
        ) })}
      </div>
    </div>
  )
}

function PayrollPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can, member } = useSession()
  const approve = useAppStore((s) => s.approvePayroll)
  const pay = useAppStore((s) => s.payPayroll)
  const run = useAction()
  const [sel, setSel] = useState<PayrollRun | null>(null)
  if (!tenant) return null
  const me = tenant.employees.find((e) => e.memberId === member?.id)
  // Employee without payroll.view: only own payslips (spec §28).
  if (!can('payroll.view')) {
    if (!can('finance.salary.self.view') || !me) return <AccessDenied perm="payroll.view" />
    const slips = tenant.payslips.filter((s) => s.employeeId === me.id).slice(-6).reverse()
    return (
      <div className="space-y-6">
        <SectionHeader title={t('hr.payroll.own')} sub={t('hr.payroll.locked')} />
        <SubNav />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{slips.map((s) => <Card key={s.id}><div className="flex items-center justify-between"><span className="font-mono text-sm">{s.periodLabel}</span><Wallet size={16} className="text-faint" /></div><p className="mt-3 text-2xl font-semibold tnum">{money(s.net)}</p><ul className="mt-3 space-y-1 text-xs">{s.lines.map((l, i) => <li key={i} className="flex justify-between"><span className="text-muted">{l.label}</span><span className={cx('tnum', l.kind === 'TAX' && 'text-danger')}>{l.kind === 'TAX' ? '−' : ''}{money(l.amount, { compact: true })}</span></li>)}</ul></Card>)}</div>
      </div>
    )
  }
  return (
    <PlanGate feature="payroll">
      <div className="space-y-6">
        <ReadOnlyBanner />
        <SectionHeader title={t('hr.payroll')} sub={t('hr.payroll.locked')} />
        <SubNav />
        {!can('finance.payroll.view') ? (
          <Card className="text-center text-sm text-muted"><Lock size={18} className="mx-auto mb-2 text-faint" />{t('access.scope.body')}</Card>
        ) : (
          <>
            <div className="grid gap-3">
              {[...tenant.payrollRuns].reverse().map((r) => (
                <Card key={r.id} className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[120px]"><p className="font-mono font-semibold">{r.periodLabel}</p><p className="text-2xs text-faint">{r.headcount} xodim · {r.number}</p></div>
                  <div className="grid flex-1 grid-cols-3 gap-3 text-sm"><div><p className="text-2xs text-faint">{t('hr.payroll.gross')}</p><p className="tnum font-medium">{money(r.grossTotal, { compact: true })}</p></div><div><p className="text-2xs text-faint">{t('hr.payroll.tax')}</p><p className="tnum">{money(r.taxTotal, { compact: true })}</p></div><div><p className="text-2xs text-faint">{t('hr.payroll.net')}</p><p className="tnum font-semibold text-brand">{money(r.netTotal, { compact: true })}</p></div></div>
                  <div className="flex items-center gap-2"><StatusBadge status={r.status === 'PAID' ? 'PAID' : r.status === 'APPROVED' ? 'APPROVED' : 'DRAFT'} label={r.status} />{r.status === 'DRAFT' && can('payroll.approve') && <Button size="xs" onClick={() => run(() => approve(r.id), { title: t('common.saved') })}>{t('hr.payroll.approve')}</Button>}{r.status === 'APPROVED' && can('payroll.approve') && <Button size="xs" onClick={() => run(() => pay(r.id), { title: t('common.saved') })}>{t('hr.payroll.pay')}</Button>}<Button size="xs" variant="ghost" onClick={() => setSel(r)}>{t('common.details')}</Button></div>
                  {r.paidAt && <span className="w-full text-2xs text-faint">{t('hr.payroll.pay')}: {fmtDate(r.paidAt, lang)}</span>}
                </Card>
              ))}
            </div>
            <Drawer open={!!sel} onClose={() => setSel(null)} title={`${t('hr.payroll')} · ${sel?.periodLabel}`}>
              {sel && <table className="w-full text-sm"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="py-2 text-left font-medium">Xodim</th><th className="py-2 text-right font-medium">{t('hr.payroll.gross')}</th><th className="py-2 text-right font-medium">{t('hr.payroll.tax')}</th><th className="py-2 text-right font-medium">{t('hr.payroll.net')}</th></tr></thead><tbody>{tenant.payslips.filter((s) => s.payrollRunId === sel.id).map((s) => { const e = tenant.employees.find((x) => x.id === s.employeeId); return <tr key={s.id} className="border-b last:border-0"><td className="py-2">{e?.fullName}<span className="block text-2xs text-faint">{e?.position}</span></td><td className="py-2 text-right tnum">{can('finance.salary.others.view') || e?.memberId === member?.id ? money(s.gross, { compact: true }) : '•••'}</td><td className="py-2 text-right tnum text-muted">{can('finance.salary.others.view') || e?.memberId === member?.id ? money(s.deductions, { compact: true }) : '•••'}</td><td className="py-2 text-right tnum font-medium">{can('finance.salary.others.view') || e?.memberId === member?.id ? money(s.net, { compact: true }) : '•••'}</td></tr> })}</tbody><tfoot><tr className="font-semibold"><td className="py-2">{t('common.total')}</td><td className="py-2 text-right tnum">{money(sel.grossTotal, { compact: true })}</td><td className="py-2 text-right tnum">{money(sel.taxTotal, { compact: true })}</td><td className="py-2 text-right tnum">{money(sel.netTotal, { compact: true })}</td></tr></tfoot></table>}
            </Drawer>
          </>
        )}
      </div>
    </PlanGate>
  )
}

