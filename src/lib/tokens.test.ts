import { describe, expect, it } from 'vitest'
import { chunkRanges } from './tokens'

describe('chunkRanges', () => {
  it('memotong rentang tanpa celah/tumpang tindih dan <= 50.000 blok', () => {
    const r = chunkRanges(129_157_568n, 129_157_568n + 400_000n)
    expect(r[0][0]).toBe(129_157_568n)
    expect(r[r.length - 1][1]).toBe(129_157_568n + 400_000n)
    for (let i = 0; i < r.length; i++) {
      expect(r[i][1] - r[i][0] + 1n).toBeLessThanOrEqual(50_000n)
      if (i > 0) expect(r[i][0]).toBe(r[i - 1][1] + 1n)
    }
  })
  it('satu blok saja', () => expect(chunkRanges(5n, 5n)).toEqual([[5n, 5n]]))
  it('from > to menghasilkan kosong', () => expect(chunkRanges(10n, 5n)).toEqual([]))
})
