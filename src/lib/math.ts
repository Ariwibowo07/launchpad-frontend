import { parseEther } from 'viem'

export const BPS = 10_000n

export type BuyQuote = {
  fee: bigint
  creatorTax: bigint
  net: bigint
  tokensOut: bigint
}

/** Rumus curve dari brief (Langkah 6). Semua pembagian dibulatkan ke bawah (bigint). */
export function calcBuy(
  quoteIn: bigint,
  feeBps: bigint,
  creatorTaxBps: bigint,
  quoteReserve: bigint,
  tokenReserve: bigint,
): BuyQuote {
  const fee = (quoteIn * feeBps) / BPS
  const creatorTax = (quoteIn * creatorTaxBps) / BPS
  const net = quoteIn - fee - creatorTax
  const denom = quoteReserve + net
  const tokensOut = denom === 0n || net <= 0n ? 0n : (net * tokenReserve) / denom
  return { fee, creatorTax, net, tokensOut }
}

export function minTokensOut(tokensOut: bigint, slippageBps: bigint): bigint {
  return (tokensOut * (BPS - slippageBps)) / BPS
}

/** Progres graduation dalam basis poin, dibatasi 0..10000. */
export function progressBps(realQuoteReserve: bigint, threshold: bigint): bigint {
  if (threshold <= 0n) return 0n
  const p = (realQuoteReserve * BPS) / threshold
  return p > BPS ? BPS : p
}

export function formatBps(bps: bigint): string {
  const whole = bps / 100n
  const frac = (bps % 100n).toString().padStart(2, '0')
  return `${whole}.${frac}%`
}

export type ParsedAmount =
  | { ok: true; value: bigint }
  | { ok: false; reason: 'empty' | 'invalid' | 'zero' | 'too_many_decimals' }

/** Parse input ETH secara ketat. Tidak pernah lewat Number. */
export function parseEthInput(raw: string): ParsedAmount {
  const s = raw.trim()
  if (s === '') return { ok: false, reason: 'empty' }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return { ok: false, reason: 'invalid' }
  const frac = s.includes('.') ? s.split('.')[1] : ''
  if (frac.length > 18) return { ok: false, reason: 'too_many_decimals' }
  const value = parseEther(s.startsWith('.') ? `0${s}` : s.endsWith('.') ? `${s}0` : s)
  if (value === 0n) return { ok: false, reason: 'zero' }
  return { ok: true, value }
}

const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
const toSubscript = (n: number) => String(n).split('').map((d) => SUB[+d]).join('')

/**
 * Format bigint desimal ke teks ringkas dengan angka signifikan.
 * Nilai kecil memakai notasi 0.0₅1234 (jumlah nol setelah titik di subscript).
 * Tidak pernah menghasilkan "0.00" untuk nilai > 0.
 */
export function formatSignificant(value: bigint, decimals: number, sig = 4): string {
  if (value === 0n) return '0'
  const s = value.toString().padStart(decimals + 1, '0')
  const intPart = s.slice(0, s.length - decimals)
  const fracPart = s.slice(s.length - decimals)
  if (intPart !== '0') {
    const group = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const keep = Math.max(0, sig - intPart.length)
    const f = fracPart.slice(0, keep).replace(/0+$/, '')
    return f ? `${group}.${f}` : group
  }
  const zeros = fracPart.match(/^0*/)![0].length
  const digits = fracPart.slice(zeros, zeros + sig).replace(/0+$/, '') || '0'
  if (zeros >= 4) return `0.0${toSubscript(zeros)}${digits}`
  return `0.${'0'.repeat(zeros)}${digits}`
}

/** Harga spot = quoteReserve / tokenReserve (ETH per token). Skala 1e36 agar presisi. */
export function spotPrice(quoteReserve: bigint, tokenReserve: bigint): bigint {
  if (tokenReserve === 0n) return 0n
  return (quoteReserve * 10n ** 36n) / tokenReserve // rasio dengan 36 desimal
}

export function formatPrice(quoteReserve: bigint, tokenReserve: bigint): string {
  return formatSignificant(spotPrice(quoteReserve, tokenReserve), 36, 4)
}
