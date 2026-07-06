import { Request, Response, NextFunction } from 'express';
import { getSettings } from '../services/settings.service';

// Path yang tetap boleh diakses saat maintenance: login (agar admin bisa masuk),
// panel admin, dan settings publik (agar app tahu status maintenance + pesannya).
const ALLOW = ['/api/auth', '/api/admin', '/api/settings'];

// ponytail: cache 10 dtk, hindari query DB tiap request. Toggle nyala max ~10dtk telat, cukup.
let cached = { on: false, msg: '', at: 0 };

export async function maintenanceGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (ALLOW.some((p) => req.path.startsWith(p))) return next();

  try {
    const now = Date.now();
    if (now - cached.at > 10_000) {
      const s = await getSettings();
      cached = { on: s.maintenance_mode === '1', msg: s.maintenance_message, at: now };
    }
    if (cached.on) {
      res.status(503).json({ success: false, message: cached.msg, maintenance: true });
      return;
    }
  } catch {
    // Kalau gagal baca settings, jangan kunci semua orang.
  }
  next();
}
