import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Eye, EyeOff, Lock, Maximize2, Send, Sparkles, X } from 'lucide-react'
import { useSession, useAction } from '@/app/useSession'
import { useAppStore } from '@/store/appStore'
import { answer, buildContext, QUICK_PROMPTS } from '@/core/services/aiCfo'
import { useT } from '@/core/i18n'
import { Badge, Button } from '@/ui/primitives'
import { cx } from '@/core/utils/format'
import type { AIMessage } from '@/core/domain/entities'
import type { DictKey } from '@/core/i18n/uz'

/* ---------------------------------------------------------- shared pieces */

export function ClaimTag({ type }: { type: 'FACT' | 'ESTIMATE' | 'RECOMMENDATION' | null }) {
  const t = useT()
  if (!type) return null
  const tone = type === 'FACT' ? 'brand' : type === 'ESTIMATE' ? 'sky' : 'gold'
  return (
    <Badge tone={tone} size="xs">
      {t(`ai.claim.${type}` as DictKey)}
    </Badge>
  )
}

const KIND_EMOJI: Record<string, string> = { INSIGHT: '💡', RISK: '⚠️', OPPORTUNITY: '📈', ANALYSIS: '📊', RECOMMENDATION: '✅' }

export function MessageBubble({ m, compact }: { m: AIMessage; compact?: boolean }) {
  const t = useT()
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-ink shadow-card">{m.content}</div>
      </div>
    )
  }
  const lines = m.content.split('\n\n')
  return (
    <div className="flex gap-3">
      <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
        <Sparkles size={14} />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-md border bg-raised/60 px-4 py-3 text-sm leading-relaxed text-ink">
          {lines.map((l, i) => {
            const m2 = l.match(/^(FAKT|BAHO|TAVSIYA) · (.*)$/s)
            if (m2) {
              const type = m2[1] === 'FAKT' ? 'FACT' : m2[1] === 'BAHO' ? 'ESTIMATE' : 'RECOMMENDATION'
              return (
                <p key={i} className={cx(i > 0 && 'mt-2.5', 'flex gap-2')}>
                  <span className="mt-0.5 shrink-0">
                    <ClaimTag type={type} />
                  </span>
                  <span>{m2[2]}</span>
                </p>
              )
            }
            return (
              <p key={i} className={cx(i > 0 && 'mt-2.5', m.deniedScopes.length && i === 0 && 'text-warning')}>
                {l}
              </p>
            )
          })}
        </div>
        {!compact && m.insights.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {m.insights.map((ins, i) => (
              <div key={i} className="rounded-xl border bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink">
                    {KIND_EMOJI[ins.kind]} {t(`ai.kind.${ins.kind}` as DictKey)} · {ins.title}
                  </span>
                  <ClaimTag type={ins.claimType} />
                </div>
                <p className="mt-1 text-xs text-muted">{ins.body}</p>
                {ins.metric && (
                  <p className="mt-1.5 text-xs text-faint">
                    {ins.metric.label}: <b className="text-ink tnum">{ins.metric.value}</b>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-2xs text-faint">
          {m.deniedScopes.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-1.5 py-0.5 text-danger">
              <Lock size={10} /> {m.deniedScopes.length} ko‘lam yopiq
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Eye size={10} /> {t('ai.usedScopes')}: {m.permissionsUsed.length}
          </span>
        </div>
      </div>
    </div>
  )
}

export function useAiChat() {
  const { tenant, principal, ent, member } = useSession()
  const append = useAppStore((s) => s.appendAIMessage)
  const clear = useAppStore((s) => s.clearAIHistory)
  const run = useAction()
  const [busy, setBusy] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)
  const messages = useMemo(() => {
    if (!tenant || !member) return []
    const mine = new Set(tenant.aiConversations.filter((c) => c.memberId === member.id).map((c) => c.id))
    const list = tenant.aiMessages.filter((m) => mine.has(m.conversationId))
    return convId ? list.filter((m) => m.conversationId === convId) : list.slice(-30)
  }, [tenant, member, convId])

  const ask = (q: string) => {
    if (!q.trim() || !tenant || !principal || busy) return
    setBusy(true)
    const id = run(() => append(convId, 'user', q.trim()))
    if (!id) {
      setBusy(false)
      return
    }
    setConvId(id)
    // simulate latency so the UI shows a thinking state (also a natural spot for a real API call)
    setTimeout(() => {
      const a = answer(tenant, principal, ent, q)
      append(id, 'assistant', a.content, { claimType: a.claimType, insights: a.insights, permissionsUsed: a.permissionsUsed, deniedScopes: a.deniedScopes })
      setBusy(false)
    }, 550 + Math.random() * 500)
  }
  return { messages, ask, busy, clear: () => { clear(); setConvId(null) }, convId, setConvId }
}

/* ------------------------------------------------------------------ Dock */

export function AiCfoDock() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { principal, ent, tenant } = useSession()
  const { messages, ask, busy } = useAiChat()
  const [q, setQ] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const ctx = useMemo(() => buildContext(principal), [principal])
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, busy, open])
  const left = ent.limits.aiQuestionsPerMonth === null ? null : Math.max(0, ent.limits.aiQuestionsPerMonth - (tenant?.aiQueriesThisMonth ?? 0))

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className={cx('fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 text-sm font-semibold shadow-glow transition-all hover:scale-[1.03] active:scale-95', open ? 'bg-surface text-ink border' : 'bg-brand text-brand-ink')} aria-label="AI CFO">
        <span className="relative grid h-7 w-7 place-items-center rounded-full bg-black/10">
          <Sparkles size={15} />
          {!open && <span className="absolute inset-0 rounded-full bg-brand animate-pulse-ring" />}
        </span>
        {open ? t('common.close') : t('ai.open')}
      </button>
      {open && (
        <div className="fixed bottom-20 right-4 z-[60] flex h-[min(620px,calc(100vh-120px))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl glass-strong shadow-lift animate-scale-in">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{t('ai.title')}</p>
              <p className="text-2xs text-faint">{ctx.visible.length} ko‘lam ochiq · {ctx.hidden.length} yopiq{left !== null ? ` · ${left} savol qoldi` : ''}</p>
            </div>
            <div className="flex items-center gap-1">
              <Link to="/app/ai" className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-line/8 hover:text-ink" title={t('ai.title')}>
                <Maximize2 size={15} />
              </Link>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-line/8 hover:text-ink">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed p-4 text-xs text-muted">
                <p className="text-ink font-medium mb-1">{t('ai.context')}</p>
                <p>{t('ai.context.body')}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ctx.visible.slice(0, 6).map((v) => (
                    <Badge key={v.key} tone="brand" size="xs">
                      {v.label}
                    </Badge>
                  ))}
                  {ctx.hidden.slice(0, 4).map((v) => (
                    <Badge key={v.key} tone="muted" size="xs">
                      <EyeOff size={9} /> {v.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {messages.slice(-12).map((m) => (
              <MessageBubble key={m.id} m={m} compact />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-faint">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-brand border-t-transparent animate-spin" /> {t('ai.thinking')}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t px-3 py-2">
            <div className="mb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              {QUICK_PROMPTS.slice(0, 5).map((p) => {
                const locked = p.scope ? !principal?.permissions.has(p.scope) : false
                return (
                  <button key={p.key} onClick={() => ask(p.q)} className={cx('shrink-0 rounded-full border px-2.5 py-1 text-2xs transition', locked ? 'text-faint hover:bg-danger/8' : 'text-muted hover:bg-brand/10 hover:text-brand')}>
                    {locked && <Lock size={9} className="mr-1 inline" />}
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
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ai.placeholder')} className="h-10 flex-1 rounded-xl border bg-raised/60 px-3 text-sm outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10" />
              <Button type="submit" size="sm" disabled={!q.trim() || busy} icon={<Send size={14} />} aria-label="send" />
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export function AiContextCard() {
  const { principal } = useSession()
  const t = useT()
  const ctx = useMemo(() => buildContext(principal), [principal])
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold">{t('ai.context')}</p>
      <p className="mt-1 text-xs text-muted">{t('ai.context.body')}</p>
      <p className="mt-4 text-2xs font-semibold uppercase tracking-wider text-brand">{t('ai.accessible')}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ctx.visible.length ? ctx.visible.map((v) => <Badge key={v.key} tone="brand">{v.label}</Badge>) : <span className="text-xs text-faint">—</span>}
      </div>
      <p className="mt-4 text-2xs font-semibold uppercase tracking-wider text-faint">{t('ai.hidden')}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ctx.hidden.length ? ctx.hidden.map((v) => <Badge key={v.key} tone="muted"><EyeOff size={10} /> {v.label}</Badge>) : <span className="text-xs text-faint">—</span>}
      </div>
      <Link to="/app/settings/permissions" className="mt-4 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        {t('nav.permissions')} <ArrowUpRight size={12} />
      </Link>
    </div>
  )
}
