import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCheck, Clock, Info, Sparkles, XCircle } from 'lucide-react'
import { useSession } from '@/app/useSession'
import { useI18nStore, useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Badge, Button, Card, EmptyState, SectionHeader, Tabs } from '@/ui/primitives'
import { cx, relTime } from '@/core/utils/format'
import type { DictKey } from '@/core/i18n/uz'
import { NOTIFICATION_KINDS } from '@/core/domain/enums'

export default function NotificationsPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, member } = useSession()
  const markRead = useAppStore((s) => s.markNotificationsRead)
  const [kind, setKind] = useState<string>('ALL')
  const rows = useMemo(() => {
    if (!tenant || !member) return []
    // Role-relevant only (spec §33): audienceRoles OR direct-to-member.
    return tenant.notifications.filter((n) => (n.audienceRoles.includes(member.role) || n.audienceMemberId === member.id) && (kind === 'ALL' ? true : kind === 'UNREAD' ? !n.readByMemberIds.includes(member.id) : n.kind === kind))
  }, [tenant, member, kind])
  if (!tenant || !member) return null
  const unread = rows.filter((n) => !n.readByMemberIds.includes(member.id)).length
  const icon = (sev: string) => (sev === 'CRITICAL' ? <XCircle size={16} /> : sev === 'WARNING' ? <AlertTriangle size={16} /> : sev === 'SUCCESS' ? <CheckCheck size={16} /> : <Info size={16} />)
  const tone = (sev: string) => (sev === 'CRITICAL' ? 'bg-danger/12 text-danger' : sev === 'WARNING' ? 'bg-warning/14 text-warning' : sev === 'SUCCESS' ? 'bg-success/12 text-success' : 'bg-sky/12 text-sky')
  const kinds = NOTIFICATION_KINDS.filter((k) => tenant.notifications.some((n) => n.kind === k && (n.audienceRoles.includes(member.role) || n.audienceMemberId === member.id)))
  return (
    <div className="space-y-6">
      <SectionHeader title={t('notif.title')} sub={t('notif.roleFiltered')} actions={unread > 0 && <Button variant="secondary" size="sm" icon={<CheckCheck size={14} />} onClick={() => markRead(rows.map((n) => n.id))}>{t('notif.markAll')}</Button>} />
      <Tabs value={kind} onChange={setKind} tabs={[{ value: 'ALL', label: t('common.all') }, { value: 'UNREAD', label: t('notif.unread'), count: unread }, ...kinds.map((k) => ({ value: k, label: t(`notif.${k}` as DictKey) }))]} />
      {rows.length === 0 ? (
        <Card><EmptyState icon={<Bell size={22} />} title={t('notif.empty')} /></Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y">
            {rows.map((n) => {
              const read = n.readByMemberIds.includes(member.id)
              return (
                <li key={n.id} className={cx('flex gap-4 px-5 py-4 transition', !read && 'bg-brand/[0.03]')}>
                  <span className={cx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', n.kind === 'AI_INSIGHT' ? 'bg-brand/12 text-brand' : tone(n.severity))}>{n.kind === 'AI_INSIGHT' ? <Sparkles size={16} /> : icon(n.severity)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className={cx('text-sm', !read && 'font-semibold')}>{n.title}</p><Badge tone="muted" size="xs">{t(`notif.${n.kind}` as DictKey)}</Badge>{!read && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}</div>
                    <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-2xs text-faint"><span className="inline-flex items-center gap-1"><Clock size={10} /> {relTime(n.createdAt, lang)}</span>{n.link && <Link to={n.link} onClick={() => markRead([n.id])} className="text-brand hover:underline">{t('common.details')} →</Link>}{!read && <button onClick={() => markRead([n.id])} className="hover:text-ink">O‘qildi</button>}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
