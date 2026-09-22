// ID video dari berbagai bentuk link YouTube (watch, youtu.be, shorts, embed).
// null = bukan link YouTube → diperlakukan sebagai URL file audio biasa.
export function youtubeId(url?: string): string | null {
  const m = (url || '').trim().match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// URL embed yang memutar berulang (loop butuh playlist=<id>).
export function youtubeEmbed(id: string, autoplay = true): string {
  const p = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    loop: '1',
    playlist: id,
    playsinline: '1',
    modestbranding: '1',
    rel: '0',
  });
  return `https://www.youtube.com/embed/${id}?${p}`;
}
