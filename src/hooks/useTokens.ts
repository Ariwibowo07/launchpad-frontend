import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { zeroAddress } from 'viem'
import { robinhoodTestnet } from '../chain'
import { fetchTokenInfos, newLogCache, syncLaunches, type TokenInfo } from '../lib/tokens'

/**
 * Daftar token: log TokenLaunched (incremental) -> Multicall3.
 * Polling tiap 15 detik menangkap token baru dan memperbarui harga/progres.
 * Token berpasangan non-ETH disaring (lihat README).
 */
export function useTokens() {
  const client = usePublicClient({ chainId: robinhoodTestnet.id })
  const cache = useRef(newLogCache())

  return useQuery({
    queryKey: ['tokens'],
    enabled: !!client,
    refetchInterval: 15_000,
    retry: 1,
    queryFn: async () => {
      const launches = await syncLaunches(client!, cache.current)
      const eth = launches.filter((l) => l.pairToken === zeroAddress)
      const infos = await fetchTokenInfos(client!, eth)
      return { tokens: infos as TokenInfo[], hiddenNonEth: launches.length - eth.length }
    },
  })
}
