import { formatEther } from 'viem'
import { useReadContract } from 'wagmi'
import { factoryAbi } from './abis'
import { FACTORY_ADDRESS, robinhoodTestnet } from './chain'

export default function App() {
  const fee = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: 'launchFee',
    chainId: robinhoodTestnet.id,
  })

  return (
    <main className="container">
      <h1>Launchpad</h1>
      <p>
        Launch fee:{' '}
        {fee.isLoading
          ? 'memuat…'
          : fee.isError
            ? 'gagal memuat'
            : `${formatEther(fee.data!)} ETH`}
      </p>
    </main>
  )
}
