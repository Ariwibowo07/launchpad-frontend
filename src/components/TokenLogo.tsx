import { useEffect, useState } from 'react'

const resolve = (u: string) => (u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7)}` : u)

/** Logo token; string kosong atau gambar gagal dimuat -> placeholder huruf pertama simbol. */
export function TokenLogo({ logo, symbol, size = 48 }: { logo: string; symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [logo])
  const style = { width: size, height: size }
  if (!logo || failed) {
    return <div className="logo" style={style} aria-hidden>{(symbol || '?').slice(0, 1).toUpperCase()}</div>
  }
  return <img className="logo" style={style} src={resolve(logo)} alt="" loading="lazy" onError={() => setFailed(true)} />
}
