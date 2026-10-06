# Launchpad — Token List + Buy (Robinhood Chain Testnet)

Frontend untuk launchpad token: menampilkan daftar token dari event `TokenLaunched` dan memungkinkan user membeli token dari bonding curve.
Stack: **React 19 + Vite + TypeScript + wagmi v2 + viem + TanStack Query**.

## Cara menjalankan

Prasyarat: Node.js 20+, MetaMask (Chrome/Chromium), ETH testnet dari faucet (<https://faucet.testnet.chain.robinhood.com/>).

```bash
git clone <url-repo-ini>
cd <folder-repo>
npm install
npm run dev
```

Buka URL yang ditampilkan Vite (biasanya <http://localhost:5173>).

```bash
npm test        # unit test (kalkulasi bigint, chunk log, pemetaan error)
npm run build   # type-check + build produksi
```

Tidak ada variabel environment dan tidak ada secret/private key di repo. RPC memakai RPC publik dari definisi chain di `src/chain.ts`.
Bila MetaMask belum punya network-nya, tombol **Pindah network** akan menambahkannya otomatis.

## Struktur singkat

| Path | Isi |
| --- | --- |
| `src/chain.ts` | Definisi chain 46630, alamat factory, blok deploy, ukuran potongan log |
| `src/abis.ts` | Subset ABI yang dipakai (typed). ABI lengkap dari brief ada di `src/abi/` |
| `src/lib/math.ts` | Semua kalkulasi `bigint`: `calcBuy`, slippage, progres, parse input, format harga |
| `src/lib/tokens.ts` | `getLogs` per potongan + Multicall3 untuk data token |
| `src/lib/errors.ts` | Terjemahan error kontrak/wallet menjadi pesan yang mudah dipahami |
| `src/hooks/useTokens.ts` | Hook daftar token (polling 15 detik) |
| `src/components/` | `WalletBar`, `TokenList`, `TokenCard`, `TokenLogo`, `BuyPanel` |

## Keputusan teknis dan alasannya

- **Daftar token dari event, bukan hardcode.** `getLogs` dimulai dari blok deploy factory (`129157568`) dan dipotong per **49.000 blok** (batas RPC 50.000) lalu diambil 3 potongan paralel dengan retry. Hasil di-cache di memori: refresh/polling hanya memindai blok baru (mundur 20 blok sebagai pengaman reorg), jadi token yang di-launch setelah halaman dibuka ikut muncul tanpa memindai ulang seluruh chain.
- **Multicall3 (`aggregate3`, `allowFailure: true`).** Semua pembacaan (nama, simbol, logo, decimals, reserve, ETH terkumpul, threshold, fee, tax, dan phase dari `getLaunchedToken`) digabung dalam sedikit permintaan RPC. Kegagalan satu field tidak menjatuhkan seluruh daftar; token ditandai "sebagian data gagal dimuat".
- **Semua angka `bigint`.** Input diparse dengan `parseEther` setelah validasi regex ketat (tolak kosong, nol, non-angka, notasi `1e5`, angka negatif, dan lebih dari 18 desimal). Rumus estimasi persis seperti brief, pembagian dibulatkan ke bawah. Progres graduation dihitung dalam basis poin dan dibatasi 100%. Tidak ada konversi wei ke `Number`.
- **Format harga.** Harga spot = `quoteReserve / tokenReserve` dihitung pada skala 1e36, ditampilkan 4 angka signifikan dengan notasi `0.0₅1234` untuk nilai sangat kecil; tidak pernah menampilkan `0.00` untuk nilai > 0.
- **Simulasi sebelum kirim.** Sebelum meminta tanda tangan, transaksi `buy` disimulasikan (`simulateContract`) dengan reserve terbaru. Error kontrak (`SlippageExceeded`, `CurveGraduated`, dll.) ter-decode menjadi pesan yang jelas tanpa membuang gas, dan `minTokensOut` dihitung dari reserve yang segar pada saat klik, bukan angka yang sudah basi.
- **Jumlah token hasil beli dibaca dari event `CurveBuy`** di receipt (bukan dari estimasi). Event `CurveBuyRefunded` juga dibaca: bila curve penuh di tengah pembelian, sisa ETH yang dikembalikan ditampilkan.
- **Refresh pasca-transaksi** lewat `invalidateQueries()`: daftar token, harga/progres, saldo ETH, dan saldo token ter-update tanpa reload. Saldo token juga tampil di form sebelum pembelian pertama.
- **Token non-ETH disaring.** Token dengan `pairToken != address(0)` disembunyikan dan jumlahnya diberitahukan lewat banner, karena harga/progres/pembelian dengan ETH tidak berlaku untuknya.
- **Mobile.** Daftar berupa grid responsif; form beli tampil sebagai panel samping di desktop dan bottom sheet di HP.
- **Tampilan status.** Loading (skeleton), kosong, dan gagal (dengan tombol coba lagi) punya tampilan sendiri; logo kosong/gagal dimuat kembali ke placeholder huruf.

## Fitur tambahan kecil

Search (nama/simbol/alamat), sort (terbaru / progres tertinggi), tombol refresh, preset jumlah ETH, slippage preset + custom.

## Belum selesai / tidak dikerjakan

- Bonus: launch token sendiri, sell, halaman detail token, tombol `createGraduatedPool`. (Hapus baris yang sudah Anda kerjakan.)
- Token non-ETH belum ditampilkan (disaring).
- Tidak ada test end-to-end otomatis dengan wallet; pengujian transaksi dilakukan manual dengan MetaMask.

## Catatan pada brief / kontrak

- **Snipe tax tidak ada di rumus brief.** ABI curve punya `currentSnipeTaxBps(recipient)` dan event `SnipeTaxCharged`, sedangkan rumus estimasi pada brief hanya memotong `fee` dan `creatorTax`. Bila snipe tax aktif, hasil sebenarnya bisa lebih kecil dari estimasi dan `buy` bisa revert `SlippageExceeded`. Aplikasi membaca `currentSnipeTaxBps` dan menampilkan peringatan bila nilainya > 0, tetapi tidak mengubah rumus (mengikuti brief). Belum dikonfirmasi ke source kontrak.
- **Pembelian yang melewati sisa kapasitas curve** dapat menghasilkan `CurveBuyRefunded` (sebagian ETH dikembalikan); estimasi dari rumus brief tidak memperhitungkan batas ini.
- **Harga spot memakai `getReserves()`** (sesuai brief). Karena ada `phantomQuote` pada konfigurasi launch, `quoteReserve` kemungkinan sudah mencakup reserve virtual, sehingga bukan sama dengan ETH sungguhan yang terkumpul (`realQuoteReserve`). Aplikasi menampilkan keduanya terpisah.
- Pembulatan: pembelian sungguhan mendapat harga lebih buruk dari harga spot karena fee dan price impact (sesuai brief).

## Bagian yang dibantu AI

Proyek ini dikerjakan dengan bantuan AI (Claude): kerangka proyek, kode komponen, modul kalkulasi, unit test, dan draf README dihasilkan dengan bantuan AI, lalu ditinjau dan dijalankan oleh saya. Saya menjelaskan dan bertanggung jawab atas seluruh kode ini.

## Status verifikasi

- [x] Unit test dan type-check lulus (`npm test`, `npm run build`)
- [ ] Daftar memuat kelima token contoh (FRESH, EARLY, HALF, TAXED, GRAD) — diverifikasi di browser
- [ ] Pembelian nyata berhasil di salah satu token contoh (hash: _isi di sini_)
- [ ] GRAD: tombol beli nonaktif
- [ ] Screenshot ada di folder `demo/`
