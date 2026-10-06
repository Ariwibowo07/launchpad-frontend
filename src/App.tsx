import { formatEther } from 'viem'
import { useReadContract } from 'wagmi'
import { factoryAbi } from './abis'
import { FACTORY_ADDRESS, robinhoodTestnet } from './chain'
import { WalletBar } from './components/WalletBar'

export default function App() {
  const fee = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: 'launchFee',
    chainId: robinhoodTestnet.id,
  })

  return (
    <div className="container">
      <header className="topbar">
        <h1>Launchpad</h1>
        <WalletBar />
      </header>
      <p className="muted">
        Launch fee: {fee.isLoading ? 'memuat…' : fee.isError ? 'gagal memuat' : `${formatEther(fee.data!)} ETH`}
      </p>
    </div>
  )
}
