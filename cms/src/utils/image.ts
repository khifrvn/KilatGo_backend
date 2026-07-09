// Placeholder abu-abu (ikon foto) — dipakai saat file selfie/dokumen tidak ada di server.
export const IMG_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" fill="#f1f5f9"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`
  );

// onError untuk <img>: ganti sumber rusak jadi placeholder, hindari loop.
export function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src === IMG_PLACEHOLDER) return;
  img.src = IMG_PLACEHOLDER;
}
