import { useState } from 'react'
import { formatEther } from 'viem'
import { useReadContract } from 'wagmi'
import { factoryAbi } from './abis'
import { FACTORY_ADDRESS, robinhoodTestnet } from './chain'
import { TokenList } from './components/TokenList'
import { WalletBar } from './components/WalletBar'
import { useTokens } from './hooks/useTokens'

export default function App() {
  const fee = useReadContract({ address: FACTORY_ADDRESS, abi: factoryAbi, functionName: 'launchFee', chainId: robinhoodTestnet.id })
  const tokens = useTokens()
  const [selectedAddr, setSelectedAddr] = useState<string>()

  return (
    <div className="container">
      <header className="topbar">
        <h1>Launchpad</h1>
        <WalletBar />
      </header>
      <p className="muted">
        Robinhood Chain Testnet · Launch fee: {fee.isLoading ? 'memuat…' : fee.isError ? 'gagal memuat' : `${formatEther(fee.data!)} ETH`}
      </p>
      <TokenList
        tokens={tokens.data?.tokens}
        hiddenNonEth={tokens.data?.hiddenNonEth ?? 0}
        isLoading={tokens.isLoading}
        isError={tokens.isError}
        isFetching={tokens.isFetching}
        onRetry={() => tokens.refetch()}
        selected={selectedAddr}
        onSelect={(t) => setSelectedAddr(t.token)}
      />
    </div>
  )
}
