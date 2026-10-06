import { defineChain } from 'viem'

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://robinhood-sepolia-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' },
  },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
  testnet: true,
})

export const FACTORY_ADDRESS = '0x533cE670f1372cb402D49866608b92e7bc2b4493' as const
export const FACTORY_DEPLOY_BLOCK = 129157568n
/** Batas RPC publik: maksimal 50.000 blok per eth_getLogs. Dipakai 49.000 agar ada margin. */
export const LOG_CHUNK_SIZE = 49_000n
export const EXPLORER = robinhoodTestnet.blockExplorers.default.url
