import { Router, Request, Response } from 'express';

/// Halaman web tujuan tautan di email reset (dibuka di browser, bukan di app —
/// app belum punya deep link). Form-nya memanggil POST /api/auth/password/reset.
const router = Router();

/// Token selalu 32 byte hex (lihat passwordReset.service). Dicek di sini supaya
/// tautan yang cacat/dimodifikasi tidak pernah ikut ke dalam halaman.
const TOKEN_RE = /^[a-f0-9]{64}$/;

/// Sisipkan string ke dalam <script>: JSON.stringify lalu netralkan `<` supaya
/// token tidak bisa menutup tag script (`</script>`) dan menyuntik kode.
const jsString = (s: string) => JSON.stringify(s).replace(/</g, '\\u003c');

function page(token: string): string {
  return `<!doctype html><html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Atur Ulang Password - KilatGo</title>
</head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,sans-serif">
<div style="max-width:420px;margin:0 auto;padding:40px 20px">
  <div style="background:#fff;border-radius:24px;padding:32px 28px">
    <h2 style="margin:0 0 6px;color:#0f172a;font-size:20px">Atur Ulang Password</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px">
      Masukkan password baru untuk akun KilatGo Anda.
    </p>
    <form id="f">
      <label style="display:block;font-weight:600;font-size:13px;color:#0f172a;margin-bottom:8px" for="p">Password Baru</label>
      <input id="p" type="password" autocomplete="new-password" placeholder="Minimal 6 karakter"
        style="width:100%;box-sizing:border-box;padding:14px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px;margin-bottom:16px">
      <label style="display:block;font-weight:600;font-size:13px;color:#0f172a;margin-bottom:8px" for="c">Ulangi Password</label>
      <input id="c" type="password" autocomplete="new-password" placeholder="Ulangi password baru"
        style="width:100%;box-sizing:border-box;padding:14px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px;margin-bottom:20px">
      <button id="b" type="submit"
        style="width:100%;padding:15px;border:0;border-radius:28px;background:#1d4ed8;color:#fff;font-size:15px;font-weight:700;cursor:pointer">
        Simpan Password Baru
      </button>
      <p id="m" style="margin:16px 0 0;font-size:13px;line-height:1.6"></p>
    </form>
  </div>
</div>
<script>
  var TOKEN = ${jsString(token)};
  var f = document.getElementById('f'), p = document.getElementById('p'),
      c = document.getElementById('c'), b = document.getElementById('b'), m = document.getElementById('m');

  function say(text, ok) { m.style.color = ok ? '#15803d' : '#b91c1c'; m.textContent = text; }

  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (p.value.length < 6) return say('Password minimal 6 karakter.', false);
    if (p.value !== c.value) return say('Konfirmasi password tidak sama.', false);

    b.disabled = true; b.textContent = 'Menyimpan...'; say('', true);
    try {
      var res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ token: TOKEN, password: p.value })
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.ok && data.success) {
        f.innerHTML = '<p style="color:#15803d;font-size:14px;line-height:1.6;margin:0">' +
          'Password berhasil diubah. Silakan buka aplikasi KilatGo dan masuk dengan password baru.</p>';
        return;
      }
      say(data.message || 'Gagal mengubah password. Minta tautan baru.', false);
    } catch (err) {
      say('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', false);
    }
    b.disabled = false; b.textContent = 'Simpan Password Baru';
  });
</script>
</body></html>`;
}

router.get('/reset-password', (req: Request, res: Response) => {
  const raw = typeof req.query.token === 'string' ? req.query.token : '';
  // Token tak sesuai format → halaman tetap tampil, tapi tanpa token (submit
  // akan ditolak server dan pengguna diarahkan minta tautan baru).
  res.type('html').send(page(TOKEN_RE.test(raw) ? raw : ''));
});

export default router;
