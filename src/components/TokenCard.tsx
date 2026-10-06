import { fmtEth, shortAddr } from '../lib/format'
import { formatBps, formatPrice, progressBps } from '../lib/math'
import { phaseInfo, type TokenInfo } from '../lib/tokens'
import { TokenLogo } from './TokenLogo'

export function TokenCard({ t, selected, onSelect }: { t: TokenInfo; selected: boolean; onSelect: () => void }) {
  const ph = phaseInfo(t.phase)
  const bps = progressBps(t.realQuoteReserve, t.graduationThreshold)
  const priceText = t.partial && t.tokenReserve === 0n ? '—' : `${formatPrice(t.quoteReserve, t.tokenReserve)} ETH`
  return (
    <button className={`card${selected ? ' selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
      <div className="card-head">
        <TokenLogo logo={t.logo} symbol={t.symbol} />
        <div className="card-title">
          <b>{t.name || shortAddr(t.token)}</b>
          <span>{t.symbol || '—'}</span>
        </div>
        <span className={`badge ${ph.cls}`} title={ph.hint}>{ph.label}</span>
      </div>
      <div className="kv"><span>Harga</span><span title="Harga spot (quoteReserve / tokenReserve)">{priceText}</span></div>
      <div className="kv"><span>ETH terkumpul</span><span>{fmtEth(t.realQuoteReserve)} / {fmtEth(t.graduationThreshold)}</span></div>
      <div className="progress" role="progressbar" aria-valuenow={Number(bps) / 100} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${Number(bps) / 100}%` }} />
      </div>
      <div className="progress-label"><span>Progres graduation</span><span>{formatBps(bps)}</span></div>
      {t.partial && <div className="progress-label"><span>Sebagian data gagal dimuat</span></div>}
    </button>
  )
}
