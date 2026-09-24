import { useEffect, useRef, useState } from 'react'
import { Lock, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { useSession } from '@/app/useSession'
import { useT } from '@/core/i18n'
import { QUICK_PROMPTS, proactiveInsights } from '@/core/services/aiCfo'
import { Badge, Button, Card, EmptyState, SectionHeader } from '@/ui/primitives'
import { AiContextCard, ClaimTag, MessageBubble, useAiChat } from './AiCfoDock'
import { cx } from '@/core/utils/format'
import type { DictKey } from '@/core/i18n/uz'

export default function AiPage() {
  const t = useT()
  const { tenant, principal, ent, member } = useSession()
  const { messages, ask, busy, clear, convId, setConvId } = useAiChat()
  const [q, setQ] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, busy])
  const convs = tenant && member ? tenant.aiConversations.filter((c) => c.memberId === member.id) : []
  const insights = tenant && principal ? proactiveInsights(tenant, principal, ent) : []
  const left = ent.limits.aiQuestionsPerMonth === null ? null : Math.max(0, ent.limits.aiQuestionsPerMonth - (tenant?.aiQueriesThisMonth ?? 0))
  const KIND_EMOJI: Record<string, string> = { INSIGHT: '💡', RISK: '⚠️', OPPORTUNITY: '📈', ANALYSIS: '📊', RECOMMENDATION: '✅' }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('ai.title')}
        sub={t('ai.sub')}
        actions={
          <>
            {left !== null && (
              <Badge tone={left < 5 ? 'warning' : 'muted'}>
                {t('ai.usage.left')}: {left}
              </Badge>
            )}
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setConvId(null)}>
              {t('ai.newChat')}
            </Button>
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={clear}>
              {t('ai.clear')}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card padded={false} className="flex min-h-[560px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <EmptyState icon={<Sparkles size={24} />} title={t('ai.empty')} body={t('ai.disclaimer')} />
            ) : (
              messages.map((m) => <MessageBubble key={m.id} m={m} />)
            )}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-faint">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-brand border-t-transparent animate-spin" /> {t('ai.thinking')}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t p-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p) => {
                const locked = p.scope ? !principal?.permissions.has(p.scope) : false
                return (
                  <button key={p.key} onClick={() => ask(p.q)} title={locked ? t('access.scope.body') : undefined} className={cx('rounded-full border px-3 py-1 text-xs transition', locked ? 'text-faint hover:bg-danger/8' : 'text-muted hover:bg-brand/10 hover:text-brand')}>
                    {locked && <Lock size={10} className="mr-1 inline" />}
                    {t(p.key as DictKey)}
                  </button>
                )
              })}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask(q)
                setQ('')
              }}
              className="flex items-center gap-2"
            >
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ai.placeholder')} className="h-11 flex-1 rounded-xl border bg-raised/60 px-4 text-sm outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10" />
              <Button type="submit" disabled={!q.trim() || busy} icon={<Send size={15} />}>
                {t('ai.send')}
              </Button>
            </form>
            <p className="mt-2 text-2xs text-faint">{t('ai.disclaimer')}</p>
          </div>
        </Card>
        <div className="space-y-4">
          <AiContextCard />
          {insights.length > 0 && (
            <Card>
              <p className="text-sm font-semibold">{t('dash.alerts')}</p>
              <ul className="mt-3 space-y-2.5">
                {insights.map((i, k) => (
                  <li key={k} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {KIND_EMOJI[i.kind]} {i.title}
                      </span>
                      <ClaimTag type={i.claimType} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{i.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {convs.length > 0 && (
            <Card>
              <p className="text-sm font-semibold">{t('ai.history')}</p>
              <ul className="mt-2 space-y-1">
                {convs.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setConvId(c.id)} className={cx('w-full truncate rounded-lg px-2 py-1.5 text-left text-xs hover:bg-line/6', convId === c.id ? 'text-brand' : 'text-muted')}>
                      {c.title}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
