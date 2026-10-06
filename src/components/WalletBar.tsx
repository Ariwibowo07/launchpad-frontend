import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { robinhoodTestnet } from '../chain'
import { fmtEth, shortAddr } from '../lib/format'

export function WalletBar() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain()
  const { data: balance } = useBalance({ address, chainId: robinhoodTestnet.id, query: { refetchInterval: 15_000 } })

  const wrongNetwork = isConnected && chainId !== robinhoodTestnet.id
  const hasProvider = typeof window !== 'undefined' && 'ethereum' in window

  return (
    <>
      <div className="wallet">
        {!isConnected ? (
          <button
            className="btn primary"
            disabled={isPending}
            onClick={() => connect({ connector: connectors[0], chainId: robinhoodTestnet.id })}
          >
            {isPending ? 'Menghubungkan…' : 'Connect Wallet'}
          </button>
        ) : (
          <>
            <div className="wallet-info">
              <span className="addr" title={address}>{shortAddr(address!)}</span>
              <span className="bal">{balance ? `${fmtEth(balance.value)} ETH` : '…'}</span>
            </div>
            <button className="btn" onClick={() => disconnect()}>Disconnect</button>
          </>
        )}
      </div>

      {!isConnected && !hasProvider && (
        <div className="banner warn">Wallet tidak terdeteksi. Pasang MetaMask lalu muat ulang halaman.</div>
      )}
      {connectError && !isConnected && (
        <div className="banner warn">
          {/rejected|denied/i.test(connectError.message)
            ? 'Koneksi wallet dibatalkan.'
            : 'Gagal menghubungkan wallet. Coba lagi.'}
        </div>
      )}
      {wrongNetwork && (
        <div className="banner warn">
          <span>Wallet berada di network lain. Pindah ke <b>{robinhoodTestnet.name}</b> untuk melanjutkan.</span>
          <button className="btn primary" disabled={switching} onClick={() => switchChain({ chainId: robinhoodTestnet.id })}>
            {switching ? 'Menunggu wallet…' : 'Pindah network'}
          </button>
          {switchError && <small>Gagal pindah network: {/rejected|denied/i.test(switchError.message) ? 'ditolak di wallet.' : 'coba lagi.'}</small>}
        </div>
      )}
    </>
  )
}
