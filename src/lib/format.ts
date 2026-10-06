import { formatSignificant } from './math'

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Saldo ETH: 18 desimal, ringkas dengan angka signifikan (tidak pernah "0.00" untuk nilai > 0). */
export const fmtEth = (wei: bigint) => formatSignificant(wei, 18, 6)

/** Jumlah token (18 desimal). */
export const fmtToken = (units: bigint, decimals = 18) => formatSignificant(units, decimals, 6)
