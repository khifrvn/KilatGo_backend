import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Dokumen KYC disimpan PRIVAT (di luar web root), hanya diakses admin via endpoint ber-token.
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'drivers');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.fieldname.replace(/[^a-z0-9]/gi, '');
    const ext = path.extname(file.originalname).slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    // ponytail: nama unik tanpa Date/random di modul — pakai hrtime + fieldname
    const uniq = process.hrtime.bigint().toString(36);
    cb(null, `${safe}_${uniq}${ext || '.jpg'}`);
  },
});

const imageOnly = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (/^image\/(jpe?g|png|webp)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPG/PNG/WEBP images are allowed'));
};

const base = multer({ storage, fileFilter: imageOnly, limits: { fileSize: 5 * 1024 * 1024 } });

// Foto menu = PUBLIK (dilihat pelanggan di KilatFood). Disimpan terpisah dari dokumen KYC privat.
export const MENU_UPLOAD_DIR =
  process.env.MENU_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'menus');
fs.mkdirSync(MENU_UPLOAD_DIR, { recursive: true });

const menuStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MENU_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    const uniq = process.hrtime.bigint().toString(36);
    cb(null, `menu_${uniq}${ext || '.jpg'}`);
  },
});

export const menuPhotoUpload = multer({ storage: menuStorage, fileFilter: imageOnly, limits: { fileSize: 5 * 1024 * 1024 } }).single('photo');

// Bukti antar order = PUBLIK (dilihat customer). Folder terpisah.
export const PROOF_UPLOAD_DIR =
  process.env.PROOF_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'proofs');
fs.mkdirSync(PROOF_UPLOAD_DIR, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROOF_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    const uniq = process.hrtime.bigint().toString(36);
    cb(null, `proof_${uniq}${ext || '.jpg'}`);
  },
});
const proofMulter = multer({ storage: proofStorage, fileFilter: imageOnly, limits: { fileSize: 5 * 1024 * 1024 } });
export const orderProofUpload = proofMulter.single('photo');
// SEND: bukti foto + tanda tangan penerima (dua file opsional) saat selesai antar.
export const orderCompleteUpload = proofMulter.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
]);

// Logo restoran = PUBLIK (tampil di KilatFood).
export const LOGO_UPLOAD_DIR =
  process.env.LOGO_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'logos');
fs.mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGO_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    const uniq = process.hrtime.bigint().toString(36);
    cb(null, `logo_${uniq}${ext || '.jpg'}`);
  },
});
export const logoUpload = multer({ storage: logoStorage, fileFilter: imageOnly, limits: { fileSize: 5 * 1024 * 1024 } }).single('logo');

// Banner promo = PUBLIK.
export const PROMO_UPLOAD_DIR =
  process.env.PROMO_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'promos');
fs.mkdirSync(PROMO_UPLOAD_DIR, { recursive: true });

const promoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROMO_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    const uniq = process.hrtime.bigint().toString(36);
    cb(null, `promo_${uniq}${ext || '.jpg'}`);
  },
});
export const promoUpload = multer({ storage: promoStorage, fileFilter: imageOnly, limits: { fileSize: 5 * 1024 * 1024 } }).single('image');

// Foto profil user = PUBLIK.
export const AVATAR_UPLOAD_DIR =
  process.env.AVATAR_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    const uniq = process.hrtime.bigint().toString(36);
    cb(null, `avatar_${uniq}${ext || '.jpg'}`);
  },
});
export const avatarUpload = multer({ storage: avatarStorage, fileFilter: imageOnly, limits: { fileSize: 5 * 1024 * 1024 } }).single('avatar');

// Musik latar layar perbaikan = PUBLIK (diputar app & web saat maintenance).
export const MUSIC_UPLOAD_DIR =
  process.env.MUSIC_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'music');
fs.mkdirSync(MUSIC_UPLOAD_DIR, { recursive: true });

const musicStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MUSIC_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 8).replace(/[^.a-z0-9]/gi, '');
    const uniq = process.hrtime.bigint().toString(36);
    cb(null, `music_${uniq}${ext || '.mp3'}`);
  },
});
const audioOnly = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (/^audio\/(mpeg|mp3|mp4|aac|ogg|wav|x-m4a|webm)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Hanya file audio (MP3/M4A/AAC/OGG/WAV) yang diizinkan'));
};
export const musicUpload = multer({ storage: musicStorage, fileFilter: audioOnly, limits: { fileSize: 10 * 1024 * 1024 } }).single('music');

// 5MB per file. Field dokumen driver.
export const driverDocsUpload = base.fields([
  { name: 'ktpPhoto', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 },
  { name: 'simPhoto', maxCount: 1 },
  { name: 'stnkPhoto', maxCount: 1 },
  { name: 'skckPhoto', maxCount: 1 },
]);

// Dokumen merchant (GoFood)
export const merchantDocsUpload = base.fields([
  { name: 'ktpPhoto', maxCount: 1 },
  { name: 'outletPhoto', maxCount: 1 },
  { name: 'npwpPhoto', maxCount: 1 },
]);

// Satu foto: absen selfie / menu
export const singlePhotoUpload = base.single('photo');
