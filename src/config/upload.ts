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

// 5MB per file. Field dokumen driver.
export const driverDocsUpload = multer({
  storage,
  fileFilter: imageOnly,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: 'ktpPhoto', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 },
  { name: 'simPhoto', maxCount: 1 },
  { name: 'stnkPhoto', maxCount: 1 },
  { name: 'skckPhoto', maxCount: 1 },
]);
