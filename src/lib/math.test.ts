import { describe, expect, it } from 'vitest'
import {
  calcBuy, formatBps, formatPrice, formatSignificant, minTokensOut, parseEthInput, progressBps,
} from './math'

const E = 10n ** 18n

describe('calcBuy', () => {
  it('mengikuti rumus brief dan membulatkan ke bawah', () => {
    const q = calcBuy(1n * E, 100n, 0n, 10n * E, 1_000_000n * E)
    expect(q.fee).toBe(E / 100n)
    expect(q.net).toBe(E - E / 100n)
    expect(q.tokensOut).toBe((q.net * 1_000_000n * E) / (10n * E + q.net))
  })
  it('memotong creator tax 10%', () => {
    const q = calcBuy(E, 100n, 1000n, 10n * E, 1_000_000n * E)
    expect(q.creatorTax).toBe(E / 10n)
    expect(q.net).toBe(E - E / 100n - E / 10n)
  })
  it('input 1 wei tidak menghasilkan token negatif', () => {
    expect(calcBuy(1n, 100n, 1000n, E, E).tokensOut).toBe(0n)
  })
})

describe('minTokensOut', () => {
  it('slippage 1%', () => expect(minTokensOut(10_000n, 100n)).toBe(9_900n))
})

describe('progressBps', () => {
  it('dibatasi 100%', () => expect(progressBps(2n * E, E)).toBe(10_000n))
  it('threshold 0 aman', () => expect(progressBps(E, 0n)).toBe(0n))
  it('format', () => expect(formatBps(1234n)).toBe('12.34%'))
})

describe('parseEthInput', () => {
  it('menerima desimal valid', () => {
    expect(parseEthInput('0.5')).toEqual({ ok: true, value: E / 2n })
    expect(parseEthInput('.5')).toEqual({ ok: true, value: E / 2n })
    expect(parseEthInput('1.')).toEqual({ ok: true, value: E })
  })
  it('menolak kosong, nol, tidak valid, dan >18 desimal', () => {
    expect(parseEthInput('')).toMatchObject({ ok: false, reason: 'empty' })
    expect(parseEthInput('0')).toMatchObject({ ok: false, reason: 'zero' })
    expect(parseEthInput('0.0')).toMatchObject({ ok: false, reason: 'zero' })
    expect(parseEthInput('abc')).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parseEthInput('-1')).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parseEthInput('1e5')).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parseEthInput('0.1234567890123456789')).toMatchObject({ ok: false, reason: 'too_many_decimals' })
  })
  it('presisi penuh 18 desimal', () => {
    expect(parseEthInput('0.000000000000000001')).toEqual({ ok: true, value: 1n })
  })
})

describe('formatPrice', () => {
  it('tidak pernah 0.00 untuk harga kecil', () => {
    const s = formatPrice(1n * E, 100_000_000_000n * E)
    expect(s).not.toBe('0')
    expect(s).toMatch(/^0\.0[₀-₉]+\d+$/)
  })
  it('notasi subscript', () => {
    expect(formatSignificant(1234n * 10n ** 13n, 36)).toBe('0.0₁₉1234')
  })
  it('nilai biasa', () => expect(formatSignificant(1_500n * E, 18)).toBe('1,500'))
})
