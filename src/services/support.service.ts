import { TicketRole, TicketStatus, TicketSender, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

// ===== Bot balas cepat (rule-based, tanpa API key) =====
// Topik umum KilatGo + jawaban template. Admin bisa perluas daftar ini.
interface Topic { key: string; label: string; keywords: string[]; answer: string }
const TOPICS: Topic[] = [
  {
    key: 'ubah_profil', label: 'Ubah profil akun',
    keywords: ['ubah profil', 'ganti nama', 'ubah nama', 'ganti email', 'ubah email', 'ganti nomor', 'ubah nomor', 'ubah hp', 'alamat'],
    answer: 'Untuk mengubah informasi akun (nama, nomor HP, alamat): buka menu Profil → Edit Profil, lalu ubah datanya dan tekan Simpan. Email tidak bisa diubah sendiri — jika perlu ganti email, sampaikan di sini agar CS membantu.',
  },
  {
    key: 'lupa_pin', label: 'Lupa PIN penarikan',
    keywords: ['lupa pin', 'reset pin', 'pin salah', 'ganti pin', 'pin penarikan'],
    answer: 'Lupa PIN penarikan? Buka menu Tarik Saldo → tekan "Lupa PIN?", masukkan sandi akunmu, lalu tentukan PIN baru. Demi keamanan, KilatGo tidak pernah tahu & tidak pernah meminta PIN kamu.',
  },
  {
    key: 'tarik_saldo', label: 'Tarik saldo / pencairan',
    keywords: ['tarik saldo', 'pencairan', 'withdraw', 'cairkan', 'saldo belum masuk', 'penarikan'],
    answer: 'Penarikan saldo: buka menu Tarik Saldo, pastikan rekening & PIN sudah diatur, lalu ajukan. Pencairan diverifikasi admin maksimal 3×24 jam (maks 1x pengajuan/hari). Untuk pelanggan, akun harus terverifikasi (KTP + selfie) dulu.',
  },
  {
    key: 'isi_saldo', label: 'Isi saldo / top up',
    keywords: ['isi saldo', 'top up', 'topup', 'saldo tidak masuk', 'gagal top up'],
    answer: 'Isi saldo: menu Isi Saldo → pilih nominal → bayar lewat halaman pembayaran. Saldo masuk otomatis setelah pembayaran berhasil. Jika sudah bayar tapi saldo belum masuk >15 menit, sampaikan bukti bayarnya di sini agar CS cek.',
  },
  {
    key: 'verifikasi', label: 'Verifikasi akun (KYC)',
    keywords: ['verifikasi', 'kyc', 'ktp', 'selfie', 'akun belum terverifikasi'],
    answer: 'Verifikasi akun: buka menu Tarik Saldo → unggah foto KTP + selfie memegang KTP → kirim. Tim admin meninjau maksimal 1×24 jam. Setelah disetujui, fitur tarik saldo aktif.',
  },
  {
    key: 'pesanan', label: 'Kendala pesanan',
    keywords: ['pesanan', 'order', 'driver', 'batal', 'dibatalkan', 'lama', 'tidak dapat driver', 'salah'],
    answer: 'Untuk kendala pesanan (driver lama, pesanan salah/batal), sampaikan nomor/detail pesanannya di sini ya. Jika pesanan berjalan, kamu bisa memantau di menu Pesanan. CS kami akan bantu menindaklanjuti.',
  },
  {
    key: 'pembayaran', label: 'Pembayaran',
    keywords: ['pembayaran', 'bayar', 'transfer', 'gagal bayar', 'link pembayaran', 'refund', 'dana kembali'],
    answer: 'Kendala pembayaran: pastikan pembayaran diselesaikan lewat link/halaman resmi KilatGo. Jika dana sudah terpotong tapi status belum berubah, sampaikan bukti transaksinya di sini agar CS bantu cek & proses.',
  },
  {
    key: 'lainnya', label: 'Lainnya',
    keywords: [],
    answer: 'Baik, mohon jelaskan kendalamu lebih detail di sini. Jika perlu, CS KilatGo akan segera terhubung untuk membantu. 🙏',
  },
];

const GREETING = (name: string) => `Hai ${name} 👋 Saya asisten KilatGo, siap bantu kamu. Pilih topik di bawah atau ketik kendalamu ya.`;
const ESCALATE = 'Baik, saya teruskan ke CS KilatGo. Mohon tunggu sebentar, tim kami akan segera membalas di sini ya 🙏';
const CLOSE_THANKS = 'Senang bisa membantu! 🎉 Laporan ini saya tandai selesai. Jangan ragu buat laporan baru bila ada kendala lain ya.';

// Kata kunci "masalah teratasi" → bot boleh menutup tiket sendiri (bila belum ditangani CS).
const RESOLVED_WORDS = ['sudah teratasi', 'sudah selesai', 'teratasi', 'sudah bisa', 'makasih', 'terima kasih', 'thanks', 'oke sudah', 'udah bisa', 'beres'];

export function listTopics() {
  return TOPICS.map((t) => ({ key: t.key, label: t.label }));
}

function botAnswerFor(topicKey?: string, text?: string): { answer: string; topic?: string } | null {
  if (topicKey) {
    const t = TOPICS.find((x) => x.key === topicKey);
    if (t) return { answer: t.answer, topic: t.key };
  }
  if (text) {
    const low = text.toLowerCase();
    for (const t of TOPICS) {
      if (t.keywords.some((k) => low.includes(k))) return { answer: t.answer, topic: t.key };
    }
  }
  return null;
}

const roleOf = (r: UserRole): TicketRole =>
  r === UserRole.DRIVER ? TicketRole.DRIVER : r === UserRole.MERCHANT ? TicketRole.MERCHANT : TicketRole.CUSTOMER;

// ===== Pengguna =====
export async function createTicket(userId: string, userRole: UserRole, input: { subject: string; category?: string }) {
  const subject = input.subject?.trim();
  if (!subject) throw new AppError('Judul laporan wajib diisi', 400);
  // Anti-spam: 1 laporan aktif per pengguna.
  const active = await prisma.supportTicket.findFirst({
    where: { userId, status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
  });
  if (active) throw new AppError('Kamu masih punya laporan aktif. Tutup dulu sebelum membuat laporan baru.', 400);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const ticket = await prisma.supportTicket.create({
    data: { userId, role: roleOf(userRole), fromName: user?.name ?? null, subject, category: input.category ?? null, status: TicketStatus.OPEN },
  });

  // Pesan pembuka bot + jawaban topik (jika ada).
  const msgs: { sender: TicketSender; body: string; readByUser: boolean }[] = [
    { sender: TicketSender.BOT, body: GREETING(user?.name ?? 'Kak'), readByUser: false },
  ];
  const bot = botAnswerFor(input.category, subject);
  if (bot) msgs.push({ sender: TicketSender.BOT, body: bot.answer, readByUser: false });
  await prisma.supportMessage.createMany({ data: msgs.map((m) => ({ ...m, ticketId: ticket.id })) });

  return getTicket(userId, ticket.id);
}

export async function listMyTickets(userId: string) {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  return tickets.map((t) => ({
    id: t.id, subject: t.subject, status: t.status, needsAdmin: t.needsAdmin, handledByAdmin: t.handledByAdmin,
    rating: t.rating, lastMessage: t.messages[0]?.body ?? null,
    unread: 0, createdAt: t.createdAt, updatedAt: t.updatedAt,
  }));
}

export async function getTicket(userId: string, id: string) {
  const t = await prisma.supportTicket.findFirst({ where: { id, userId }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  if (!t) throw new AppError('Laporan tidak ditemukan', 404);
  // Tandai pesan CS/bot terbaca oleh user.
  await prisma.supportMessage.updateMany({ where: { ticketId: id, sender: { not: TicketSender.USER }, readByUser: false }, data: { readByUser: true } });
  return serialize(t, t.messages);
}

export async function sendMessage(userId: string, id: string, body: string, topicKey?: string) {
  const text = body?.trim();
  if (!text) throw new AppError('Pesan kosong', 400);
  const t = await prisma.supportTicket.findFirst({ where: { id, userId } });
  if (!t) throw new AppError('Laporan tidak ditemukan', 404);
  if (t.status === TicketStatus.RESOLVED) throw new AppError('Laporan sudah ditutup. Buat laporan baru bila perlu.', 400);

  await prisma.supportMessage.create({ data: { ticketId: id, sender: TicketSender.USER, body: text, readByAdmin: false } });
  await prisma.supportTicket.update({ where: { id }, data: { updatedAt: new Date() } });

  // Bot hanya membalas bila CS belum menangani tiket.
  if (!t.handledByAdmin) {
    // Pengguna bilang sudah teratasi → bot tutup tiket sendiri.
    if (RESOLVED_WORDS.some((w) => text.toLowerCase().includes(w))) {
      await prisma.supportMessage.create({ data: { ticketId: id, sender: TicketSender.BOT, body: CLOSE_THANKS, readByUser: false } });
      await prisma.supportTicket.update({ where: { id }, data: { status: TicketStatus.RESOLVED, closedBy: 'bot', resolvedAt: new Date() } });
      return getTicket(userId, id);
    }
    const bot = botAnswerFor(topicKey, text);
    if (bot) {
      await prisma.supportMessage.create({ data: { ticketId: id, sender: TicketSender.BOT, body: bot.answer, readByUser: false } });
    } else {
      // Tak ada template cocok → eskalasi ke CS.
      await prisma.supportMessage.create({ data: { ticketId: id, sender: TicketSender.BOT, body: ESCALATE, readByUser: false } });
      await prisma.supportTicket.update({ where: { id }, data: { needsAdmin: true } });
    }
  }
  return getTicket(userId, id);
}

export async function closeTicket(userId: string, id: string) {
  const t = await prisma.supportTicket.findFirst({ where: { id, userId } });
  if (!t) throw new AppError('Laporan tidak ditemukan', 404);
  if (t.status === TicketStatus.RESOLVED) return getTicket(userId, id);
  await prisma.supportTicket.update({ where: { id }, data: { status: TicketStatus.RESOLVED, closedBy: 'user', resolvedAt: new Date() } });
  return getTicket(userId, id);
}

export async function rateTicket(userId: string, id: string, stars: number, comment?: string) {
  const s = Math.round(Number(stars));
  if (!(s >= 1 && s <= 5)) throw new AppError('Bintang harus 1-5', 400);
  const t = await prisma.supportTicket.findFirst({ where: { id, userId } });
  if (!t) throw new AppError('Laporan tidak ditemukan', 404);
  if (t.status !== TicketStatus.RESOLVED) throw new AppError('Laporan belum ditutup', 400);
  await prisma.supportTicket.update({ where: { id }, data: { rating: s, ratingComment: comment?.trim() || null } });
  return { ok: true };
}

function serialize(t: any, messages: any[]) {
  return {
    id: t.id, subject: t.subject, category: t.category, status: t.status,
    needsAdmin: t.needsAdmin, handledByAdmin: t.handledByAdmin, closedBy: t.closedBy,
    rating: t.rating, ratingComment: t.ratingComment,
    role: t.role, fromName: t.fromName,
    createdAt: t.createdAt, updatedAt: t.updatedAt, resolvedAt: t.resolvedAt,
    messages: messages.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt })),
    topics: listTopics(),
  };
}

// ===== Admin CS =====
export async function adminList(status?: string) {
  const where = status ? { status: status as TicketStatus } : {};
  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 300,
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const ids = tickets.map((t) => t.id);
  const unreadRows = await prisma.supportMessage.groupBy({
    by: ['ticketId'], where: { ticketId: { in: ids }, sender: TicketSender.USER, readByAdmin: false }, _count: { _all: true },
  });
  const unreadMap = new Map(unreadRows.map((r) => [r.ticketId, r._count._all]));
  const photos = await photosFor(tickets.map((t) => t.userId));
  return tickets.map((t) => ({
    id: t.id, subject: t.subject, role: t.role, fromName: t.fromName, status: t.status,
    needsAdmin: t.needsAdmin, handledByAdmin: t.handledByAdmin, rating: t.rating,
    lastMessage: t.messages[0]?.body ?? null, unread: unreadMap.get(t.id) ?? 0,
    ...(photos.get(t.userId) ?? { photo: null, photoKind: null }),
    createdAt: t.createdAt, updatedAt: t.updatedAt,
  }));
}

// Foto pengguna per peran: driver = selfie (privat), mitra = logo (publik), pelanggan = avatar.
async function photosFor(userIds: string[]) {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, avatar: true, driver: { select: { selfiePhoto: true } }, merchant: { select: { logo: true } } },
  });
  const map = new Map<string, { photo: string | null; photoKind: string | null }>();
  for (const u of users) {
    if (u.driver?.selfiePhoto) map.set(u.id, { photo: u.driver.selfiePhoto, photoKind: 'selfie' });
    else if (u.merchant?.logo) map.set(u.id, { photo: u.merchant.logo, photoKind: 'logo' });
    else if (u.avatar) map.set(u.id, { photo: u.avatar, photoKind: 'avatar' });
    else map.set(u.id, { photo: null, photoKind: null });
  }
  return map;
}

export async function adminGet(id: string) {
  const t = await prisma.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } }, } });
  if (!t) throw new AppError('Laporan tidak ditemukan', 404);
  await prisma.supportMessage.updateMany({ where: { ticketId: id, sender: TicketSender.USER, readByAdmin: false }, data: { readByAdmin: true } });
  const user = await prisma.user.findUnique({ where: { id: t.userId }, select: { name: true, email: true, phone: true } });
  const photo = (await photosFor([t.userId])).get(t.userId) ?? { photo: null, photoKind: null };
  return { ...serialize(t, t.messages), user, ...photo };
}

export async function adminReply(id: string, body: string) {
  const text = body?.trim();
  if (!text) throw new AppError('Pesan kosong', 400);
  const t = await prisma.supportTicket.findUnique({ where: { id } });
  if (!t) throw new AppError('Laporan tidak ditemukan', 404);
  if (t.status === TicketStatus.RESOLVED) throw new AppError('Laporan sudah ditutup', 400);
  await prisma.supportMessage.create({ data: { ticketId: id, sender: TicketSender.ADMIN, body: text, readByUser: false } });
  await prisma.supportTicket.update({ where: { id }, data: { status: TicketStatus.IN_PROGRESS, handledByAdmin: true, needsAdmin: false, updatedAt: new Date() } });
  return adminGet(id);
}

export async function adminClose(id: string) {
  const t = await prisma.supportTicket.findUnique({ where: { id } });
  if (!t) throw new AppError('Laporan tidak ditemukan', 404);
  await prisma.supportTicket.update({ where: { id }, data: { status: TicketStatus.RESOLVED, closedBy: 'admin', resolvedAt: new Date() } });
  return adminGet(id);
}
