import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { parseEventLogs, zeroAddress, type Hash } from 'viem'
import { useAccount, useBalance, usePublicClient, useReadContract, useReadContracts, useWriteContract } from 'wagmi'
import { curveAbi, factoryAbi, tokenAbi } from '../abis'
import { EXPLORER, FACTORY_ADDRESS, robinhoodTestnet } from '../chain'
import { friendlyError } from '../lib/errors'
import { fmtEth, fmtToken } from '../lib/format'
import { calcBuy, formatPrice, minTokensOut, parseEthInput } from '../lib/math'
import { phaseInfo, type TokenInfo } from '../lib/tokens'
import { TokenLogo } from './TokenLogo'

type Tx =
  | { s: 'idle' }
  | { s: 'wallet' }
  | { s: 'pending'; hash: Hash }
  | { s: 'success'; hash: Hash; tokensOut?: bigint; refund?: bigint }
  | { s: 'rejected' }
  | { s: 'failed'; message: string; hash?: Hash }

type Live = { quoteReserve: bigint; tokenReserve: bigint; feeBps: bigint; taxBps: bigint; phase: number; snipeBps: bigint }
type Res = { status: string; result?: unknown }

function parseLive(d: readonly Res[] | undefined): Live | undefined {
  if (!d) return undefined
  const [r, f, t, l, s] = d
  if (r?.status !== 'success' || f?.status !== 'success' || t?.status !== 'success' || l?.status !== 'success') return undefined
  const [quoteReserve, tokenReserve] = r.result as readonly [bigint, bigint]
  return {
    quoteReserve, tokenReserve,
    feeBps: f.result as bigint,
    taxBps: t.result as bigint,
    phase: Number((l.result as { phase: number }).phase),
    snipeBps: s?.status === 'success' ? (s.result as bigint) : 0n,
  }
}

const SLIPPAGE_PRESETS = [50, 100, 300, 500]
const AMOUNT_ERR: Record<string, string> = {
  invalid: 'Masukkan angka yang valid (contoh: 0.01).',
  zero: 'Jumlah harus lebih dari 0.',
  too_many_decimals: 'ETH maksimal 18 angka desimal.',
}

/** "1.5" -> 150 bps. Null bila tidak valid atau di luar 0,01%–50%. */
function parsePercentToBps(s: string): bigint | null {
  if (!/^\d+(\.\d{1,2})?$/.test(s.trim())) return null
  const [w, f = ''] = s.trim().split('.')
  const bps = BigInt(w) * 100n + BigInt(f.padEnd(2, '0'))
  return bps >= 1n && bps <= 5000n ? bps : null
}

export function BuyPanel({ token, onClose }: { token: TokenInfo; onClose: () => void }) {
  const { address, isConnected, chainId } = useAccount()
  const client = usePublicClient({ chainId: robinhoodTestnet.id })
  const qc = useQueryClient()
  const { writeContractAsync } = useWriteContract()

  const [amount, setAmount] = useState('')
  const [slipBps, setSlipBps] = useState(100n)
  const [customSlip, setCustomSlip] = useState('')
  const [tx, setTx] = useState<Tx>({ s: 'idle' })

  const ethBal = useBalance({ address, chainId: robinhoodTestnet.id })
  const tokBal = useReadContract({
    address: token.token, abi: tokenAbi, functionName: 'balanceOf', args: [address ?? zeroAddress],
    chainId: robinhoodTestnet.id, query: { enabled: !!address, refetchInterval: 15_000 },
  })
  const liveQ = useReadContracts({
    contracts: [
      { address: token.curve, abi: curveAbi, functionName: 'getReserves', chainId: robinhoodTestnet.id },
      { address: token.curve, abi: curveAbi, functionName: 'feeBps', chainId: robinhoodTestnet.id },
      { address: token.curve, abi: curveAbi, functionName: 'creatorTaxBps', chainId: robinhoodTestnet.id },
      { address: FACTORY_ADDRESS, abi: factoryAbi, functionName: 'getLaunchedToken', args: [token.token], chainId: robinhoodTestnet.id },
      { address: token.curve, abi: curveAbi, functionName: 'currentSnipeTaxBps', args: [address ?? zeroAddress], chainId: robinhoodTestnet.id },
    ],
    query: { refetchInterval: 8_000 },
  })

  const live: Live = parseLive(liveQ.data as readonly Res[] | undefined) ?? {
    quoteReserve: token.quoteReserve, tokenReserve: token.tokenReserve,
    feeBps: token.feeBps, taxBps: token.creatorTaxBps, phase: token.phase, snipeBps: 0n,
  }

  const wrongNetwork = isConnected && chainId !== robinhoodTestnet.id
  const parsed = parseEthInput(amount)
  const quote = parsed.ok ? calcBuy(parsed.value, live.feeBps, live.taxBps, live.quoteReserve, live.tokenReserve) : undefined
  const minOut = quote ? minTokensOut(quote.tokensOut, slipBps) : undefined
  const busy = tx.s === 'wallet' || tx.s === 'pending'
  const ph = phaseInfo(live.phase)

  let disabledReason: string | undefined
  if (!isConnected) disabledReason = 'Connect wallet terlebih dahulu'
  else if (wrongNetwork) disabledReason = 'Pindah ke Robinhood Chain Testnet'
  else if (live.phase !== 0) disabledReason = `Token tidak bisa dibeli di curve (${ph.label})`
  else if (!parsed.ok) disabledReason = parsed.reason === 'empty' ? 'Masukkan jumlah ETH' : AMOUNT_ERR[parsed.reason]
  else if (!ethBal.data) disabledReason = 'Memuat saldo…'
  else if (parsed.value > ethBal.data.value) disabledReason = 'Saldo ETH tidak cukup'
  else if (quote && quote.tokensOut === 0n) disabledReason = 'Jumlah terlalu kecil untuk mendapat token'
  const canBuy = !disabledReason && !busy

  async function onBuy() {
    if (!parsed.ok || !address || !client) return
    setTx({ s: 'wallet' })
    try {
      // ambil reserve terbaru tepat sebelum kirim agar minTokensOut akurat
      const fresh = parseLive((await liveQ.refetch()).data as readonly Res[] | undefined) ?? live
      if (fresh.phase !== 0) throw Object.assign(new Error('reverted'), { shortMessage: 'CurveGraduated' })
      const q = calcBuy(parsed.value, fresh.feeBps, fresh.taxBps, fresh.quoteReserve, fresh.tokenReserve)
      const args = [parsed.value, minTokensOut(q.tokensOut, slipBps), address] as const
      // simulasi dulu: error kontrak ter-decode (SlippageExceeded, CurveGraduated, ...) tanpa membuang gas
      await client.simulateContract({ account: address, address: token.curve, abi: curveAbi, functionName: 'buy', args, value: parsed.value })
      const hash = await writeContractAsync({
        address: token.curve, abi: curveAbi, functionName: 'buy', args, value: parsed.value, chainId: robinhoodTestnet.id,
      })
      setTx({ s: 'pending', hash })
      const receipt = await client.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        setTx({ s: 'failed', hash, message: 'Transaksi gagal (revert) di blockchain. Harga mungkin bergerak atau token sudah tidak bisa dibeli.' })
        return
      }
      const logs = parseEventLogs({ abi: curveAbi, logs: receipt.logs, eventName: ['CurveBuy', 'CurveBuyRefunded'] })
        .filter((l) => l.address.toLowerCase() === token.curve.toLowerCase())
      const buy = logs.find((l) => l.eventName === 'CurveBuy' && l.args.recipient.toLowerCase() === address.toLowerCase())
      const refund = logs.find((l) => l.eventName === 'CurveBuyRefunded')
      setTx({
        s: 'success', hash,
        tokensOut: buy && buy.eventName === 'CurveBuy' ? buy.args.tokensOut : undefined,
        refund: refund && refund.eventName === 'CurveBuyRefunded' ? refund.args.refund : undefined,
      })
      setAmount('')
      // Langkah 8: segarkan semua (daftar token, saldo ETH, saldo token, data curve) tanpa reload
      await qc.invalidateQueries()
    } catch (e) {
      const fe = friendlyError(e)
      setTx(fe.kind === 'rejected' ? { s: 'rejected' } : { s: 'failed', message: fe.message })
    }
  }

  const slipLabel = `${Number(slipBps) / 100}%`

  return (
    <section className="panel" aria-label={`Beli ${token.symbol}`}>
      <button className="btn close" onClick={onClose} aria-label="Tutup">✕</button>
      <div className="card-head">
        <TokenLogo logo={token.logo} symbol={token.symbol} size={40} />
        <div className="card-title"><h2>Beli {token.symbol}</h2><span>{token.name}</span></div>
      </div>
      <div className="kv"><span>Harga spot</span><span>{formatPrice(live.quoteReserve, live.tokenReserve)} ETH</span></div>
      <div className="kv"><span>Saldo token Anda</span><span>{!isConnected ? '—' : tokBal.data === undefined ? '…' : `${fmtToken(tokBal.data, token.decimals)} ${token.symbol}`}</span></div>
      <div className="kv"><span>Saldo ETH</span><span>{!isConnected ? '—' : ethBal.data ? `${fmtEth(ethBal.data.value)} ETH` : '…'}</span></div>

      {live.phase !== 0 && <div className="banner warn" style={{ marginTop: 12 }}>{ph.hint}. Pembelian dari curve dinonaktifkan.</div>}
      {live.snipeBps > 0n && (
        <div className="banner info" style={{ marginTop: 12 }}>
          Snipe tax {Number(live.snipeBps) / 100}% sedang aktif untuk wallet Anda. Estimasi di bawah belum memperhitungkannya; naikkan slippage bila transaksi gagal.
        </div>
      )}

      <div className="field">
        <label htmlFor="amt">Jumlah ETH yang dibelanjakan</label>
        <div className="input-wrap">
          <input id="amt" inputMode="decimal" autoComplete="off" placeholder="0.0" value={amount} disabled={busy}
            onChange={(e) => setAmount(e.target.value.replace(',', '.'))} />
          <span className="muted">ETH</span>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {['0.001', '0.005', '0.01'].map((v) => <button key={v} className="chip" disabled={busy} onClick={() => setAmount(v)}>{v}</button>)}
        </div>
        {amount !== '' && !parsed.ok && parsed.reason !== 'empty' && <div className="hint">{AMOUNT_ERR[parsed.reason]}</div>}
      </div>

      <div className="field">
        <label>Toleransi slippage</label>
        <div className="chips">
          {SLIPPAGE_PRESETS.map((b) => (
            <button key={b} className={`chip${slipBps === BigInt(b) && !customSlip ? ' active' : ''}`} disabled={busy}
              onClick={() => { setSlipBps(BigInt(b)); setCustomSlip('') }}>{b / 100}%</button>
          ))}
          <input className="chip" style={{ width: 90 }} placeholder="custom %" inputMode="decimal" value={customSlip} disabled={busy}
            onChange={(e) => {
              const v = e.target.value.replace(',', '.')
              setCustomSlip(v)
              const b = parsePercentToBps(v)
              if (b !== null) setSlipBps(b)
            }} />
        </div>
        {customSlip && parsePercentToBps(customSlip) === null && <div className="hint">Slippage harus 0.01% – 50%.</div>}
      </div>

      <div className="summary" aria-live="polite">
        <div className="kv" style={{ marginTop: 0 }}><span>Perkiraan token</span><span className="big">{quote ? `${fmtToken(quote.tokensOut, token.decimals)} ${token.symbol}` : '—'}</span></div>
        <div className="kv"><span>Minimum diterima ({slipLabel})</span><span>{minOut !== undefined ? `${fmtToken(minOut, token.decimals)} ${token.symbol}` : '—'}</span></div>
        <div className="kv"><span>Fee ({Number(live.feeBps) / 100}%)</span><span>{quote ? `${fmtEth(quote.fee)} ETH` : '—'}</span></div>
        <div className="kv"><span>Creator tax ({Number(live.taxBps) / 100}%)</span><span>{quote ? `${fmtEth(quote.creatorTax)} ETH` : '—'}</span></div>
      </div>

      <button className="btn primary" disabled={!canBuy} onClick={onBuy}>
        {tx.s === 'wallet' ? 'Konfirmasi di wallet' : tx.s === 'pending' ? 'Menunggu konfirmasi blok…' : `Beli ${token.symbol}`}
      </button>
      {disabledReason && !busy && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{disabledReason}</div>}

      <div aria-live="polite">
        {tx.s === 'wallet' && <div className="banner info" style={{ marginTop: 12 }}>Konfirmasi di wallet Anda…</div>}
        {tx.s === 'pending' && (
          <div className="banner info" style={{ marginTop: 12 }}>
            <span>⏳ Transaksi terkirim, menunggu masuk blok.</span>
            <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">Lihat di explorer</a>
          </div>
        )}
        {tx.s === 'success' && (
          <div className="banner ok" style={{ marginTop: 12 }}>
            <span>
              ✅ Pembelian berhasil.{' '}
              {tx.tokensOut !== undefined ? <>Anda mendapat <b>{fmtToken(tx.tokensOut, token.decimals)} {token.symbol}</b>.</> : 'Jumlah token tidak terbaca dari event.'}
              {tx.refund !== undefined && <> Sisa {fmtEth(tx.refund)} ETH dikembalikan (curve penuh).</>}
            </span>
            <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">Lihat di explorer</a>
          </div>
        )}
        {tx.s === 'rejected' && <div className="banner warn" style={{ marginTop: 12 }}>Transaksi dibatalkan di wallet. Anda bisa mencoba lagi.</div>}
        {tx.s === 'failed' && (
          <div className="banner err" style={{ marginTop: 12 }}>
            <span>❌ {tx.message}</span>
            {tx.hash && <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">Lihat di explorer</a>}
          </div>
        )}
      </div>
    </section>
  )
}
