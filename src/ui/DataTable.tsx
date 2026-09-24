import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react'
import { cx } from '@/core/utils/format'
import { useT } from '@/core/i18n'
import { EmptyState, Input, Select, Skeleton } from './primitives'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
  sortValue?: (row: T) => string | number
  hideBelow?: 'sm' | 'md' | 'lg'
  className?: string
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  searchable?: (row: T) => string
  searchPlaceholder?: string
  pageSize?: number
  onRowClick?: (row: T) => void
  toolbar?: ReactNode
  emptyTitle?: string
  emptyBody?: string
  loading?: boolean
  dense?: boolean
  className?: string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  footer?: ReactNode
}

export function useDebounced<T>(value: T, ms = 220): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

export function DataTable<T>({ rows, columns, rowKey, searchable, searchPlaceholder, pageSize: initialPageSize = 12, onRowClick, toolbar, emptyTitle, emptyBody, loading, dense, className, initialSort, footer }: DataTableProps<T>) {
  const t = useT()
  const [q, setQ] = useState('')
  const dq = useDebounced(useDeferredValue(q))
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null)

  const filtered = useMemo(() => {
    const base = dq && searchable ? rows.filter((r) => searchable(r).toLowerCase().includes(dq.toLowerCase())) : rows
    if (!sort) return base
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return base
    const sv = col.sortValue
    return [...base].sort((a, b) => {
      const x = sv(a)
      const y = sv(b)
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.dir === 'asc' ? r : -r
    })
  }, [rows, dq, searchable, sort, columns])

  useEffect(() => setPage(0), [dq, rows.length, pageSize])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const slice = filtered.slice(page * pageSize, page * pageSize + pageSize)
  const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }

  return (
    <div className={cx('card overflow-hidden', className)}>
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {searchable ? (
            <div className="w-full sm:max-w-xs">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder ?? t('common.search')} left={<Search size={15} />} className="h-9" />
            </div>
          ) : (
            <span />
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-raised/40 text-2xs uppercase tracking-wider text-faint">
              {columns.map((c) => {
                const sortable = !!c.sortValue
                const active = sort?.key === c.key
                return (
                  <th key={c.key} style={{ width: c.width }} className={cx('px-4 py-2.5 font-medium whitespace-nowrap', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.hideBelow && hide[c.hideBelow], sortable && 'cursor-pointer select-none hover:text-ink')} onClick={() => sortable && setSort(active ? (sort.dir === 'asc' ? { key: c.key, dir: 'desc' } : null) : { key: c.key, dir: 'asc' })}>
                    <span className="inline-flex items-center gap-1">
                      {c.header}
                      {active && (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className={cx('px-4', dense ? 'py-2' : 'py-3', c.hideBelow && hide[c.hideBelow])}>
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : slice.map((r) => (
                  <tr key={rowKey(r)} onClick={() => onRowClick?.(r)} className={cx('border-b last:border-0 transition-colors', onRowClick && 'cursor-pointer hover:bg-line/5')}>
                    {columns.map((c) => (
                      <td key={c.key} className={cx('px-4 align-middle', dense ? 'py-2' : 'py-3', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.hideBelow && hide[c.hideBelow], c.className)}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && !slice.length && <EmptyState compact icon={<Inbox size={22} />} title={emptyTitle ?? t('common.noResults')} body={emptyBody} />}
      </div>
      {(filtered.length > pageSize || footer) && (
        <div className="flex flex-col gap-2 border-t px-4 py-2.5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span>
              {t('common.showing')} <b className="text-ink tnum">{filtered.length ? page * pageSize + 1 : 0}–{Math.min(filtered.length, (page + 1) * pageSize)}</b> / <span className="tnum">{filtered.length}</span>
            </span>
            {footer}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">{t('common.rowsPerPage')}</span>
            <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-7 w-[68px] py-0 text-xs">
              {[10, 12, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border p-1 disabled:opacity-40 hover:bg-line/8">
              <ChevronLeft size={14} />
            </button>
            <span className="tnum">
              {page + 1} / {pages}
            </span>
            <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded-lg border p-1 disabled:opacity-40 hover:bg-line/8">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
