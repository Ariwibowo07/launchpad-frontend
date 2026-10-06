import { describe, expect, it } from 'vitest'
import { friendlyError, messageForErrorName } from './errors'

describe('friendlyError', () => {
  it('mengenali penolakan user (code 4001)', () => {
    expect(friendlyError({ code: 4001, message: 'x' }).kind).toBe('rejected')
  })
  it('mengenali penolakan lewat teks', () => {
    expect(friendlyError(new Error('User rejected the request.')).kind).toBe('rejected')
  })
  it('saldo tidak cukup', () => {
    expect(friendlyError(new Error('insufficient funds for gas')).message).toMatch(/Saldo ETH/)
  })
  it('tidak pernah menampilkan hex mentah', () => {
    expect(friendlyError(new Error('execution reverted: 0xdeadbeef')).message).not.toMatch(/0x/)
  })
  it('mengenali nama error kontrak dari teks', () => {
    expect(friendlyError(new Error('The contract function reverted with SlippageExceeded(1, 2)')).message).toMatch(/slippage/i)
  })
  it('SlippageExceeded & CurveGraduated punya pesan khusus', () => {
    expect(messageForErrorName('SlippageExceeded')).toMatch(/slippage/i)
    expect(messageForErrorName('CurveGraduated')).toMatch(/graduate/i)
  })
})
