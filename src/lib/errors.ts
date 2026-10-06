import { BaseError, ContractFunctionRevertedError } from 'viem'

export type FriendlyError = { kind: 'rejected' | 'failed'; message: string }

const BY_NAME: Record<string, string> = {
  SlippageExceeded: 'Harga bergerak melebihi toleransi slippage. Naikkan toleransi atau coba lagi.',
  CurveGraduated: 'Token ini sudah tidak dijual di bonding curve (sudah graduate).',
  AlreadyGraduated: 'Token ini sudah graduate dan tidak bisa dibeli dari curve.',
  ZeroAmount: 'Jumlah pembelian tidak boleh nol.',
  InsufficientInputAmount: 'Jumlah ETH terlalu kecil untuk dibeli.',
  InsufficientOutputAmount: 'Jumlah token yang didapat terlalu kecil. Naikkan jumlah ETH.',
  InsufficientLiquidity: 'Likuiditas curve tidak cukup untuk pembelian ini. Coba jumlah lebih kecil.',
  MinimumOutputRequired: 'Batas minimum token (slippage) wajib diisi.',
  NativeValueMismatch: 'Nilai ETH yang dikirim tidak sesuai dengan jumlah pembelian.',
  UnexpectedNativeValue: 'Kontrak tidak menerima ETH untuk operasi ini.',
  TransferFailed: 'Transfer gagal di kontrak. Coba lagi beberapa saat.',
  NotWhitelisted: 'Alamat wallet ini belum diizinkan untuk launch token.',
  LaunchFeeNotPaid: 'Launch fee belum dibayar dengan jumlah yang tepat.',
  LaunchEconomicsMismatch: 'Konfigurasi ekonomi launch berubah. Muat ulang lalu coba lagi.',
  InvalidTokenParams: 'Parameter token tidak valid (cek nama/simbol).',
  NotReadyToGraduate: 'Token belum siap graduate.',
  WrongGraduationPhase: 'Token tidak berada di phase yang tepat untuk aksi ini.',
}

export const messageForErrorName = (name: string): string | undefined => BY_NAME[name]

/** Terjemahkan error viem/wallet menjadi pesan yang dipahami user (tanpa hex mentah). */
export function friendlyError(err: unknown): FriendlyError {
  const text = String((err as { shortMessage?: string; message?: string })?.shortMessage ?? (err as Error)?.message ?? err)
  const code = (err as { code?: number })?.code
  let name: string | undefined
  let cause: unknown = err
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) name = revert.data?.errorName
    cause = err.walk()
  }
  const causeCode = (cause as { code?: number })?.code

  if (code === 4001 || causeCode === 4001 || /user rejected|user denied|rejected the request/i.test(text)) {
    return { kind: 'rejected', message: 'Transaksi dibatalkan di wallet. Anda bisa mencoba lagi.' }
  }
  if (!name) name = Object.keys(BY_NAME).find((n) => text.includes(n))
  if (name && BY_NAME[name]) return { kind: 'failed', message: BY_NAME[name] }
  if (/insufficient funds/i.test(text)) {
    return { kind: 'failed', message: 'Saldo ETH tidak cukup untuk jumlah pembelian ditambah biaya gas.' }
  }
  if (/network|fetch|timeout|failed to fetch|http request/i.test(text)) {
    return { kind: 'failed', message: 'Koneksi ke jaringan bermasalah. Periksa koneksi/VPN lalu coba lagi.' }
  }
  if (/reverted|revert/i.test(text)) {
    return { kind: 'failed', message: 'Transaksi ditolak oleh kontrak. Harga mungkin bergerak atau token sudah tidak bisa dibeli.' }
  }
  return { kind: 'failed', message: 'Terjadi kesalahan saat memproses transaksi. Silakan coba lagi.' }
}
