import type { Address, PublicClient } from 'viem'
import { zeroAddress } from 'viem'
import { curveAbi, factoryAbi, tokenAbi, tokenLaunchedEvent } from '../abis'
import { FACTORY_ADDRESS, FACTORY_DEPLOY_BLOCK, LOG_CHUNK_SIZE } from '../chain'

export type Launch = {
  token: Address
  curve: Address
  deployer: Address
  pairToken: Address
  launchConfigId: bigint
  graduationThreshold: bigint
  blockNumber: bigint
}

export type TokenInfo = Launch & {
  name: string
  symbol: string
  logo: string
  decimals: number
  quoteReserve: bigint
  tokenReserve: bigint
  realQuoteReserve: bigint
  feeBps: bigint
  creatorTaxBps: bigint
  phase: number
  /** true bila ada field penting yang gagal dibaca (multicall allowFailure) */
  partial: boolean
}

export type LogCache = { lastBlock: bigint; launches: Map<Address, Launch> }
export const newLogCache = (): LogCache => ({ lastBlock: FACTORY_DEPLOY_BLOCK - 1n, launches: new Map() })

/** Membagi rentang [from, to] menjadi potongan <= LOG_CHUNK_SIZE blok (batas RPC 50.000). */
export function chunkRanges(from: bigint, to: bigint, size = LOG_CHUNK_SIZE): Array<[bigint, bigint]> {
  const out: Array<[bigint, bigint]> = []
  for (let start = from; start <= to; start += size) {
    const end = start + size - 1n
    out.push([start, end > to ? to : end])
  }
  return out
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 400 * 2 ** i))
    }
  }
  throw lastErr
}

/**
 * Langkah 3: ambil event TokenLaunched dari blok deploy factory sampai blok terbaru.
 * Incremental: cache menyimpan blok terakhir yang sudah dipindai, jadi refresh hanya memindai blok baru
 * (mundur 20 blok sebagai pengaman reorg). Potongan diambil 3 sekaligus.
 */
export async function syncLaunches(client: PublicClient, cache: LogCache): Promise<Launch[]> {
  const latest = await withRetry(() => client.getBlockNumber())
  const from = cache.lastBlock >= FACTORY_DEPLOY_BLOCK + 20n ? cache.lastBlock - 20n : FACTORY_DEPLOY_BLOCK
  const ranges = chunkRanges(from, latest)

  for (let i = 0; i < ranges.length; i += 3) {
    const batch = ranges.slice(i, i + 3)
    const results = await Promise.all(
      batch.map(([fromBlock, toBlock]) =>
        withRetry(() =>
          client.getLogs({ address: FACTORY_ADDRESS, event: tokenLaunchedEvent, fromBlock, toBlock }),
        ),
      ),
    )
    for (const logs of results) {
      for (const l of logs) {
        const a = l.args
        if (!a.token || !a.curve || !a.deployer) continue
        cache.launches.set(a.token, {
          token: a.token,
          curve: a.curve,
          deployer: a.deployer,
          pairToken: a.pairToken ?? zeroAddress,
          launchConfigId: a.launchConfigId ?? 0n,
          graduationThreshold: a.graduationThreshold ?? 0n,
          blockNumber: l.blockNumber ?? 0n,
        })
      }
    }
  }
  cache.lastBlock = latest
  return [...cache.launches.values()].sort((a, b) => (a.blockNumber < b.blockNumber ? 1 : -1))
}

const PER_TOKEN_CALLS = 9

/** Langkah 4: seluruh data semua token dalam sedikit permintaan RPC lewat Multicall3 (aggregate3, allowFailure). */
export async function fetchTokenInfos(client: PublicClient, launches: Launch[]): Promise<TokenInfo[]> {
  if (launches.length === 0) return []
  const contracts = launches.flatMap((l) => [
    { address: l.token, abi: tokenAbi, functionName: 'name' } as const,
    { address: l.token, abi: tokenAbi, functionName: 'symbol' } as const,
    { address: l.token, abi: tokenAbi, functionName: 'logo' } as const,
    { address: l.token, abi: tokenAbi, functionName: 'decimals' } as const,
    { address: l.curve, abi: curveAbi, functionName: 'getReserves' } as const,
    { address: l.curve, abi: curveAbi, functionName: 'realQuoteReserve' } as const,
    { address: l.curve, abi: curveAbi, functionName: 'graduationThreshold' } as const,
    { address: l.curve, abi: curveAbi, functionName: 'feeBps' } as const,
    { address: l.curve, abi: curveAbi, functionName: 'creatorTaxBps' } as const,
  ])
  // phase berasal dari factory.getLaunchedToken(token) -> struct
  const phaseCalls = launches.map(
    (l) => ({ address: FACTORY_ADDRESS, abi: factoryAbi, functionName: 'getLaunchedToken', args: [l.token] }) as const,
  )

  const [main, phases] = await Promise.all([
    client.multicall({ contracts, allowFailure: true, batchSize: 64 * 1024 }),
    client.multicall({ contracts: phaseCalls, allowFailure: true, batchSize: 64 * 1024 }),
  ])

  return launches.map((l, i) => {
    const r = main.slice(i * PER_TOKEN_CALLS, (i + 1) * PER_TOKEN_CALLS)
    const ok = <T,>(x: { status: string; result?: unknown }): T | undefined =>
      x.status === 'success' ? (x.result as T) : undefined
    const reserves = ok<readonly [bigint, bigint]>(r[4])
    const phaseRes = phases[i]
    const launched = phaseRes.status === 'success' ? phaseRes.result : undefined
    const realQuote = ok<bigint>(r[5])
    const threshold = ok<bigint>(r[6]) ?? l.graduationThreshold
    const feeBps = ok<bigint>(r[7])
    const taxBps = ok<bigint>(r[8])
    const partial = !reserves || realQuote === undefined || feeBps === undefined || taxBps === undefined || !launched
    return {
      ...l,
      name: ok<string>(r[0]) ?? '',
      symbol: ok<string>(r[1]) ?? '',
      logo: ok<string>(r[2]) ?? '',
      decimals: ok<number>(r[3]) ?? 18,
      quoteReserve: reserves?.[0] ?? 0n,
      tokenReserve: reserves?.[1] ?? 0n,
      realQuoteReserve: realQuote ?? 0n,
      graduationThreshold: threshold,
      feeBps: feeBps ?? 0n,
      creatorTaxBps: taxBps ?? 0n,
      phase: launched ? Number(launched.phase) : -1,
      partial,
    }
  })
}

export const PHASE_LABEL: Record<number, { label: string; hint: string; cls: string }> = {
  0: { label: 'Bonding curve', hint: 'Masih diperdagangkan di bonding curve', cls: 'p0' },
  1: { label: 'Siap graduate', hint: 'Curve habis terbeli, pool Uniswap v4 belum dibuat', cls: 'p1' },
  2: { label: 'Graduated', hint: 'Sudah graduate ke pool Uniswap v4', cls: 'p2' },
  3: { label: 'Dibatalkan', hint: 'Graduation dibatalkan', cls: 'p3' },
}
export const phaseInfo = (p: number) => PHASE_LABEL[p] ?? { label: 'Status tidak diketahui', hint: 'Status tidak bisa dibaca', cls: 'pq' }
