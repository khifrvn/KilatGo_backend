# Deployment — KilatGo Backend + CMS

Cara deploy yang **terbukti jalan** di hosting ini (Rumahweb / cPanel + LiteSpeed).
Baca ini dulu sebelum deploy — banyak jebakan yang sudah kena.

## Ringkasan lingkungan

| Hal | Nilai |
|---|---|
| Host cPanel | `leuser.iixcp.rumahweb.net` (103.247.10.236) |
| SSH | user `kilb7536`, **port 2223** (bukan 22), key-only (password auth mati) |
| App root (Node) | `~/repositories/Kilatgo_backend` |
| Startup file | `dist/server.js` (Passenger/LiteSpeed = proses `lsnode`) |
| Node | 22.x, mode Production |
| Backend URL | `https://api.kilatgo.com` (serve API **dan** `/admin` dari `cms/dist`) |
| Landing + admin statik | `https://kilatgo.com` → docroot `~/public_html` |
| Build backend | `npx tsc` → `dist/` |
| Build CMS | `cd cms && npm run build` → `cms/dist/` |

> **Admin ada di 2 tempat.** `api.kilatgo.com/admin` di-serve backend dari `~/repositories/Kilatgo_backend/cms/dist`. `kilatgo.com/admin` statik dari `~/public_html`. Tiap update CMS, **dua-duanya** harus di-update.

## Aturan penting (kenapa)

1. **Push ke GitHub TIDAK auto-deploy.** Remote repo = GitHub, cPanel cuma pull kalau ditrigger manual. `git push` hanya menyimpan kode; tidak menyentuh server.
2. **Jangan `npm ci` / `npm install` di server.** RAM shared hosting kecil → OOM (`Aborted (core dumped)`). Karena itu **build di lokal**, upload hasil build. Deployment via tombol cPanel "Deploy HEAD Commit" (yang menjalankan `.cpanel.yml` berisi `npm ci`) akan gagal di paket ini.
3. **`dist/` & `cms/dist/` di-.gitignore** → tidak ikut git. Selalu dikirim manual.
4. **Restart Passenger lewat tombol cPanel / `touch tmp/restart.txt` sering tidak mempan.** Yang pasti: `pkill` proses `lsnode`-nya (respawn otomatis saat request berikutnya).
5. **`scp` sering gagal diam-diam** (auth passphrase via expect, atau path mangling di macOS). Pakai **ssh-agent + kirim file via `ssh stdin`** (lihat di bawah). Kalau file "sudah baru" tapi server serve lama, curiga scp gagal — cek isi file di disk, bukan cuma percaya exit code.
6. **Bukan cache.** LiteSpeed tidak nge-cache HTML di sini (express kirim `max-age=0`). Kalau server serve versi lama, itu karena **file di disk memang lama**, bukan cache. Tes: curl URL SPA acak (`/zz-123`) — kalau tetap lama, disk lama.

## Prosedur deploy (andal)

### 1. Build di lokal
```bash
cd KilatGo_backend
rm -rf dist && npx tsc                 # backend → dist/
(cd cms && npm run build)              # CMS → cms/dist/
# catat hash JS baru:
grep -o 'index-[A-Za-z0-9_-]*\.js' cms/dist/index.html
```

### 2. Zip hasil build
```bash
zip -rq /tmp/kilatgo-deploy.zip dist cms/dist -x "*.DS_Store"
```

### 3. Unlock SSH key sekali (ssh-agent)
Key `~/.ssh/kilatgo_id_rsa` ber-passphrase; masukkan sekali ke agent supaya `ssh`/perpipaan jalan tanpa prompt berulang:
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/kilatgo_id_rsa          # ketik passphrase
```

### 4. Kirim zip via ssh stdin (BUKAN scp)
```bash
H="kilb7536@leuser.iixcp.rumahweb.net"
ssh -p 2223 "$H" 'cat > ~/repositories/Kilatgo_backend/kilatgo-deploy.zip' < /tmp/kilatgo-deploy.zip
```

### 5. Extract, sync ke public_html, restart backend
```bash
ssh -p 2223 "$H" 'cd ~/repositories/Kilatgo_backend \
  && unzip -o kilatgo-deploy.zip >/dev/null && rm -f kilatgo-deploy.zip \
  && cp -rf cms/dist/* ~/public_html/ \
  && pkill -f "lsnode:/home/kilb7536/repositories/Kilatgo_backend" ; echo DONE'
```
- `cp ... ~/public_html/` = update admin statik `kilatgo.com`.
- `pkill lsnode` = restart backend (serve `api.kilatgo.com` + `/admin` baru). Respawn otomatis.
- **Tidak perlu** `prisma migrate` kecuali skema DB (`prisma/schema.prisma`) berubah. Migrasi skema butuh langkah terpisah (lihat di bawah).

### 6. Matikan agent (opsional)
```bash
ssh-agent -k
```

## Verifikasi
```bash
curl -s https://api.kilatgo.com/health                       # {"status":"ok"...}
curl -s https://api.kilatgo.com/admin | grep -o 'index-[^"]*\.js'   # = hash baru
curl -s https://kilatgo.com/          | grep -o 'index-[^"]*\.js'   # = hash baru
curl -s "https://api.kilatgo.com/zz-$RANDOM" | grep -o 'index-[^"]*\.js'  # SPA route acak, harus hash baru
```
Semua harus menunjukkan hash JS yang dicatat di langkah 1. Lalu hard-refresh browser (Cmd+Shift+R) — favicon/HTML lama suka nyangkut di cache browser.

## Kalau skema DB berubah (`prisma/schema.prisma`)
Migrasi tidak bisa lewat `npm ci`. Jalankan manual per-perintah (bukan sekaligus, hindari beban):
```bash
ssh -p 2223 "$H"
cd ~/repositories/Kilatgo_backend
source ~/nodevenv/repositories/Kilatgo_backend/*/bin/activate
npx prisma generate
npx prisma migrate deploy
```
Kalau `prisma generate` OOM, coba lagi (kadang lolos di percobaan kedua).

## Troubleshooting cepat
| Gejala | Sebab | Aksi |
|---|---|---|
| Server serve versi lama walau "sudah deploy" | file di disk lama (scp gagal) | cek isi file via `ssh ... grep`, kirim ulang via ssh-stdin |
| `Permission denied (publickey...)` | key belum di agent | ulangi `ssh-add`; cek `ssh-add -l` |
| `Aborted (core dumped)` saat npm | OOM RAM shared | jangan build di server; build lokal |
| Restart cPanel tak berefek | Passenger tak respawn | `pkill -f "lsnode:...Kilatgo_backend"` |
| `git checkout -- .` diminta di cPanel Git | working tree server kotor | jangan pakai cPanel git deploy; pakai prosedur di atas |
| SSH timeout dari rumah | ISP blok port 2223 | pakai VPN |

## Yang JANGAN dilakukan
- ❌ Andalkan `git push` untuk deploy (tidak nyambung ke server).
- ❌ `npm ci` / "Deploy HEAD Commit" cPanel / "Run NPM Install" (OOM).
- ❌ Percaya `scp` tanpa verifikasi isi file di disk.
- ❌ Lupa update `~/public_html` (admin `kilatgo.com` jadi ketinggalan).
