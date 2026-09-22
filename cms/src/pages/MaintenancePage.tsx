import { useEffect, useRef, useState } from 'react';
import { Wrench, RefreshCw, Pause, Play } from 'lucide-react';
import { youtubeId, youtubeEmbed } from '../utils/youtube';

// Halaman "sedang perbaikan" untuk semua halaman publik (landing, daftar mitra,
// portal merchant). Palet mengikuti landing: navy #0a1f4d → cyan #19b0f5.
// Motion CSS-native (kelas .mnt-* di index.css), tanpa library animasi.
export default function MaintenancePage({ message, musicUrl }: { message?: string; musicUrl?: string }) {
  const text = (message || '').trim() || 'Aplikasi sedang dalam perbaikan. Silakan coba lagi nanti.';
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  // Link YouTube tidak bisa dimainkan <audio> → pakai pemutar YouTube (punya
  // tombol play/pause sendiri, dan ToS-nya melarang player disembunyikan).
  const ytId = youtubeId(musicUrl);

  // Browser memblokir autoplay bersuara sebelum ada interaksi — kalau ditolak,
  // biarkan berhenti dan pengguna menyalakan lewat tombol.
  useEffect(() => {
    if (!musicUrl || ytId) return;
    audio.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [musicUrl, ytId]);

  const toggleMusic = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else { el.pause(); setPlaying(false); }
  };
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08183c] flex items-center justify-center px-5 py-16">
      {/* Latar: gradient navy + tiga blob brand yang bergerak lambat + grid halus. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1f4d] via-[#0b2358] to-[#061230]" />
      <div className="absolute inset-0">
        <div className="mnt-blob w-[38rem] h-[38rem] -top-40 -left-32 bg-[#19b0f5]/35" />
        <div className="mnt-blob w-[32rem] h-[32rem] -bottom-40 -right-24 bg-[#2563eb]/40" />
        <div className="mnt-blob w-[22rem] h-[22rem] top-1/3 right-1/4 bg-[#facc15]/12" />
      </div>
      <div className="mnt-grid absolute inset-0" />

      <div className="relative w-full max-w-xl">
        <div className="hero-in rounded-3xl bg-white/[0.055] ring-1 ring-white/10 backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] px-7 sm:px-12 py-12 text-center">
          <img
            src="/logo_kilatgo_bg.png"
            alt="KilatGo"
            className="hero-in w-14 h-14 mx-auto object-contain bg-white rounded-2xl p-1.5 shadow-lg"
            style={{ '--i': 1 } as React.CSSProperties}
          />

          {/* Ikon kunci pas: dua cincin berdenyut + goyangan halus. */}
          <div className="hero-in relative mx-auto mt-9 w-24 h-24" style={{ '--i': 2 } as React.CSSProperties}>
            <span className="mnt-ring absolute inset-0 rounded-full ring-2 ring-[#19b0f5]/45" />
            <span className="mnt-ring mnt-ring-2 absolute inset-0 rounded-full ring-2 ring-[#19b0f5]/45" />
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#19b0f5]/25 to-[#2563eb]/20 ring-1 ring-white/15 flex items-center justify-center">
              <Wrench className="mnt-rock w-10 h-10 text-[#7fd6ff]" strokeWidth={1.9} />
            </span>
          </div>

          <h1
            className="hero-in mt-9 text-[1.75rem] sm:text-4xl font-extrabold tracking-tight text-white"
            style={{ '--i': 3 } as React.CSSProperties}
          >
            Sedang Dalam{' '}
            <span className="bg-gradient-to-r from-[#19b0f5] to-[#7fd6ff] bg-clip-text text-transparent">Perbaikan</span>
          </h1>

          <p
            className="hero-in mt-4 text-[0.98rem] sm:text-base leading-relaxed text-white/65 max-w-md mx-auto"
            style={{ '--i': 4 } as React.CSSProperties}
          >
            {text}
          </p>

          {/* Bar progres indeterminate — penanda "sedang dikerjakan". */}
          <div
            className="hero-in mnt-bar relative mt-8 mx-auto h-1 w-44 overflow-hidden rounded-full bg-white/10 after:absolute after:inset-y-0 after:left-0 after:w-1/3 after:rounded-full after:bg-gradient-to-r after:from-transparent after:via-[#19b0f5] after:to-transparent"
            style={{ '--i': 5 } as React.CSSProperties}
          />

          <button
            onClick={() => window.location.reload()}
            className="hero-in mnt-spin-hover mt-9 inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#19b0f5] to-[#2563eb] shadow-lg shadow-[#19b0f5]/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#19b0f5]/30 active:translate-y-0"
            style={{ '--i': 6 } as React.CSSProperties}
          >
            <RefreshCw className="mnt-spin w-4 h-4" /> Muat Ulang
          </button>

          {/* Musik latar dari YouTube — kontrol play/pause bawaan pemutar YouTube. */}
          {ytId && (
            <div className="hero-in mt-8 mx-auto w-full max-w-[300px]" style={{ '--i': 7 } as React.CSSProperties}>
              <div className="relative w-full aspect-video overflow-hidden rounded-2xl ring-1 ring-white/15 bg-black/40">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={youtubeEmbed(ytId)}
                  title="Musik latar"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
              <p className="mt-2 text-[11px] text-white/35">Musik latar — bisa dijeda lewat tombol di pemutar.</p>
            </div>
          )}

          {/* Musik latar (diatur admin) — bisa dijeda/diputar pengguna. */}
          {musicUrl && !ytId && (
            <div className="hero-in mt-7" style={{ '--i': 7 } as React.CSSProperties}>
              <audio ref={audio} src={musicUrl} loop preload="auto" />
              <button
                onClick={toggleMusic}
                className="inline-flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full bg-white/[0.07] ring-1 ring-white/15 text-sm text-white/75 hover:bg-white/[0.12] hover:text-white transition"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="mnt-eq flex items-end gap-[3px] h-3.5" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={`w-[3px] rounded-full bg-[#19b0f5] origin-bottom ${playing ? '' : 'scale-y-[0.35]'}`}
                      style={{ height: i === 1 ? '14px' : '10px', animationPlayState: playing ? 'running' : 'paused' }}
                    />
                  ))}
                </span>
                {playing ? 'Jeda musik' : 'Putar musik'}
              </button>
            </div>
          )}

          <p className="hero-in mt-7 text-xs text-white/35" style={{ '--i': 8 } as React.CSSProperties}>
            Halaman ini memeriksa status otomatis. Terima kasih atas kesabaran Anda.
          </p>
        </div>

        <p className="hero-in mt-6 text-center text-xs text-white/25" style={{ '--i': 9 } as React.CSSProperties}>
          © KilatGo — Ride · Car · Send · Food
        </p>
      </div>
    </div>
  );
}
