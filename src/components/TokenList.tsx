import { useMemo, useState } from 'react'
import { progressBps } from '../lib/math'
import type { TokenInfo } from '../lib/tokens'
import { TokenCard } from './TokenCard'

type Props = {
  tokens: TokenInfo[] | undefined
  hiddenNonEth: number
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  onRetry: () => void
  selected?: string
  onSelect: (t: TokenInfo) => void
}

export function TokenList({ tokens, hiddenNonEth, isLoading, isError, isFetching, onRetry, selected, onSelect }: Props) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'newest' | 'progress'>('newest')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const f = (tokens ?? []).filter(
      (t) => !needle || t.name.toLowerCase().includes(needle) || t.symbol.toLowerCase().includes(needle) || t.token.toLowerCase() === needle,
    )
    if (sort === 'progress') {
      return [...f].sort((a, b) => {
        const pa = progressBps(a.realQuoteReserve, a.graduationThreshold)
        const pb = progressBps(b.realQuoteReserve, b.graduationThreshold)
        return pa === pb ? 0 : pa < pb ? 1 : -1
      })
    }
    return f // sudah terurut terbaru
  }, [tokens, q, sort])

  if (isLoading) {
    return (
      <div className="grid" aria-busy="true" aria-label="Memuat daftar token">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" />)}
      </div>
    )
  }
  if (isError) {
    return (
      <div className="state" role="alert">
        <h3>Gagal memuat daftar token</h3>
        <p className="muted">RPC tidak merespons atau koneksi bermasalah. Coba lagi.</p>
        <button className="btn primary" onClick={onRetry}>Coba lagi</button>
      </div>
    )
  }
  if (!tokens || tokens.length === 0) {
    return (
      <div className="state">
        <h3>Belum ada token</h3>
        <p className="muted">Belum ada token yang di-launch. Muat ulang untuk memeriksa lagi.</p>
        <button className="btn" onClick={onRetry}>Muat ulang</button>
      </div>
    )
  }
  return (
    <>
      <div className="toolbar">
        <input placeholder="Cari nama, simbol, atau alamat token" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari token" />
        <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'progress')} aria-label="Urutkan">
          <option value="newest">Terbaru</option>
          <option value="progress">Progres tertinggi</option>
        </select>
        <button className="btn" onClick={onRetry} disabled={isFetching}>{isFetching ? 'Memuat…' : 'Refresh'}</button>
      </div>
      {hiddenNonEth > 0 && (
        <div className="banner info">{hiddenNonEth} token dipasangkan dengan aset non-ETH disembunyikan (belum didukung).</div>
      )}
      {shown.length === 0 ? (
        <div className="state"><h3>Tidak ada hasil</h3><p className="muted">Tidak ada token yang cocok dengan pencarian.</p></div>
      ) : (
        <div className="grid">
          {shown.map((t) => (
            <TokenCard key={t.token} t={t} selected={selected === t.token} onSelect={() => onSelect(t)} />
          ))}
        </div>
      )}
    </>
  )
}
