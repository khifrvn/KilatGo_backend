import { useEffect, useState, type ReactNode } from 'react';
import { Store, Search, Inbox, MapPin, X, CheckCircle, ExternalLink, Utensils } from 'lucide-react';
import { getMerchants, suspendUser, activateUser, verifyKyc, getMerchantReport, setMenuAvailability, type MerchantReport } from '../api/admin';
import { IMAGE_BASE } from '../api/client';
import type { Merchant, MerchantMenu } from '../types';

const menuPhoto = (photo?: string | null) => (photo ? `${IMAGE_BASE}menus/${photo}` : null);

const logoUrl = (logo?: string | null) => (logo ? `${IMAGE_BASE}logos/${logo}` : null);
const rp = (v: number | string | undefined) => 'Rp ' + Number(v ?? 0).toLocaleString('id-ID');

function Logo({ m, size = 'w-11 h-11' }: { m: Merchant; size?: string }) {
  const url = logoUrl(m.logo);
  return (
    <div className={`${size} rounded-full bg-kilatgo-100 flex items-center justify-center shrink-0 overflow-hidden`}>
      {url ? (
        <img src={url} alt={m.businessName} className="w-full h-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <Store className="w-5 h-5 text-kilatgo-600" />
      )}
    </div>
  );
}

export default function MerchantsPage() {
  const [rows, setRows] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<Merchant | null>(null);
  const [openFilter, setOpenFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [city, setCity] = useState('all');

  const load = async () => {
    setLoading(true);
    try { setRows(await getMerchants()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (m: Merchant) => {
    let reason: string | undefined;
    if (m.user.status !== 'SUSPENDED') {
      const r = window.prompt('Alasan blokir (ditampilkan ke mitra di aplikasi):', '');
      if (r === null) return;
      reason = r.trim() || undefined;
    }
    try {
      setBusy(m.id);
      if (m.user.status === 'SUSPENDED') await activateUser(m.userId);
      else await suspendUser(m.userId, reason);
      await load();
    } finally { setBusy(null); }
  };

  const cities = Array.from(new Set(rows.map((r) => r.city).filter(Boolean))).sort() as string[];

  // Hanya mitra yang sudah disetujui — pengajuan baru ada di halaman Persetujuan.
  const filtered = rows.filter((m) => {
    if (!m.isApproved) return false;
    const s = q.toLowerCase();
    const matchQ = !s || m.businessName?.toLowerCase().includes(s) || m.ownerName?.toLowerCase().includes(s) || m.user.email?.toLowerCase().includes(s) || (m.phone ?? m.user.phone ?? '').includes(s);
    const matchOpen = openFilter === 'all' || (openFilter === 'open' ? m.isOpen !== false : m.isOpen === false);
    const matchCity = city === 'all' || m.city === city;
    return matchQ && matchOpen && matchCity;
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Manajemen</p>
        <h1 className="text-3xl font-bold text-kilatgo-950">Mitra</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-2 flex items-center gap-2">
        <Search className="w-5 h-5 text-slate-400 ml-2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama usaha, pemilik, email, telepon"
          className="flex-1 px-2 py-2.5 outline-none text-slate-900 bg-transparent" />
      </div>

      {/* Filter buka/tutup + daerah */}
      <div className="flex flex-wrap items-center gap-2">
        {([['all', 'Semua'], ['open', 'Buka'], ['closed', 'Tutup']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setOpenFilter(v)}
            className={`text-sm font-semibold px-3.5 py-1.5 rounded-lg transition ${openFilter === v ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          <select value={city} onChange={(e) => setCity(e.target.value)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 outline-none">
            <option value="all">Semua daerah</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Inbox className="w-8 h-8 mb-3" /><p className="text-sm">Tidak ada mitra</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((m) => (
              <div key={m.id} className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Logo m={m} />
                  <div className="min-w-0">
                    <p className="font-bold text-kilatgo-950">{m.businessName}</p>
                    <p className="text-sm text-slate-500">{m.ownerName} · {m.phone ?? m.user.phone ?? '-'}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{m.city ?? '-'}{m.category ? ` · ${m.category}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right mr-1">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Saldo</p>
                    <p className="text-sm font-bold text-kilatgo-950">{rp(m.balance)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.isOpen === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>{m.isOpen === false ? 'Tutup' : 'Buka'}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.user.status === 'SUSPENDED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{m.user.status === 'SUSPENDED' ? 'Diblokir' : 'Aktif'}</span>
                  <button onClick={() => setDetail(m)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-kilatgo-50 text-kilatgo-700 hover:bg-kilatgo-100">
                    Detail
                  </button>
                  <button disabled={busy === m.id} onClick={() => toggle(m)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${m.user.status === 'SUSPENDED' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}>
                    {m.user.status === 'SUSPENDED' ? 'Aktifkan' : 'Suspend'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <MerchantDetailModal
          merchant={detail}
          onClose={() => setDetail(null)}
          onKyc={async (approve) => {
            await verifyKyc('merchant', detail.id, approve, approve ? undefined : 'Dokumen tidak sesuai');
            setDetail(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function MerchantDetailModal({ merchant: m, onClose, onKyc }: { merchant: Merchant; onClose: () => void; onKyc: (approve: boolean) => Promise<void> }) {
  const [kycBusy, setKycBusy] = useState(false);
  const [report, setReport] = useState<MerchantReport | null>(null);
  const [menus, setMenus] = useState<MerchantMenu[]>(m.menus ?? []);
  const [menuBusy, setMenuBusy] = useState<string | null>(null);

  useEffect(() => { getMerchantReport(m.id).then(setReport).catch(() => {}); }, [m.id]);

  const toggleMenu = async (menu: MerchantMenu) => {
    setMenuBusy(menu.id);
    try {
      const next = !menu.isAvailable;
      await setMenuAvailability(menu.id, next);
      setMenus((prev) => prev.map((x) => (x.id === menu.id ? { ...x, isAvailable: next } : x)));
    } finally {
      setMenuBusy(null);
    }
  };

  const lat = m.latitude, lng = m.longitude;
  const hasGeo = lat != null && lng != null;
  const bbox = hasGeo ? `${lng! - 0.008},${lat! - 0.006},${lng! + 0.008},${lat! + 0.006}` : '';

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right break-words">{value || '-'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <Logo m={m} />
            <div>
              <p className="font-bold text-kilatgo-950">{m.businessName}</p>
              <p className="text-xs text-slate-500">ID Mitra: {m.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{m.isApproved ? 'Disetujui' : 'Menunggu'}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.user.status === 'SUSPENDED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{m.user.status === 'SUSPENDED' ? 'Diblokir' : 'Aktif'}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.isOpen === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{m.isOpen === false ? 'Tutup' : 'Buka'}</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">KYC: {m.kycStatus ?? 'UNVERIFIED'}</span>
          </div>

          {/* Laporan mitra */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Laporan</p>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Saldo" value={rp(report?.balance ?? m.balance)} highlight />
              <Stat label="Omzet (selesai)" value={rp(report?.grossSales)} />
              <Stat label="Order selesai" value={String(report?.completedOrders ?? 0)} />
              <Stat label="Order aktif" value={String(report?.activeOrders ?? 0)} />
              <Stat label="Order hari ini" value={String(report?.todayOrders ?? 0)} />
              <Stat label="Omzet hari ini" value={rp(report?.todaySales)} />
              <Stat label="Rata-rata/order" value={rp(report?.avgOrderValue)} />
              <Stat label="Dibatalkan" value={String(report?.cancelledOrders ?? 0)} />
            </div>
          </div>

          <Section title="Usaha">
            <Row label="Nama usaha" value={m.businessName} />
            <Row label="Kategori" value={m.category} />
            <Row label="Deskripsi" value={m.description} />
            <Row label="Jam operasional" value={m.operatingHours} />
          </Section>

          <Section title="Pemilik & Kontak">
            <Row label="Pemilik" value={m.ownerName} />
            <Row label="NIK" value={m.nik} />
            <Row label="Telepon" value={m.phone ?? m.user.phone} />
            <Row label="Email" value={m.user.email} />
          </Section>

          <Section title="Alamat">
            <Row label="Alamat" value={m.address} />
            <Row label="Kota" value={m.city} />
            <Row label="Koordinat" value={hasGeo ? `${lat}, ${lng}` : '-'} />
          </Section>

          {hasGeo && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Peta</p>
              <iframe
                title="Peta lokasi"
                className="w-full h-52 rounded-xl border border-slate-100"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
              />
              <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-kilatgo-600 hover:underline mt-1.5">
                Buka di OpenStreetMap <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <Section title="Rekening pencairan">
            <Row label="Bank" value={m.bankName} />
            <Row label="No. rekening" value={m.bankAccount} />
            <Row label="Atas nama" value={m.bankHolder} />
          </Section>

          <Section title="Legalitas">
            <Row label="NPWP" value={m.npwp} />
            <Row label="NIB" value={m.nib} />
            <Row label="SIUP" value={m.siup} />
          </Section>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Menu ({menus.length})</p>
            {menus.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">Belum ada menu</p>
            ) : (
              <div className="space-y-2">
                {menus.map((menu) => {
                  const photo = menuPhoto(menu.photo);
                  return (
                    <div key={menu.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${menu.isAvailable ? 'border-slate-100 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
                      <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {photo ? (
                          <img src={photo} alt={menu.name} className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Utensils className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{menu.name}</p>
                        {menu.category && <p className="text-xs text-slate-400">{menu.category}</p>}
                        <p className="text-sm font-medium text-kilatgo-700">{rp(menu.price)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${menu.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {menu.isAvailable ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <button disabled={menuBusy === menu.id} onClick={() => toggleMenu(menu)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg disabled:opacity-50 ${menu.isAvailable ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                          {menu.isAvailable ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Verifikasi KYC merchant */}
          {m.kycStatus !== 'VERIFIED' ? (
            <div className="flex gap-2 pt-1">
              <button
                disabled={kycBusy}
                onClick={async () => { setKycBusy(true); try { await onKyc(true); } finally { setKycBusy(false); } }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-60"
              >
                <CheckCircle className="w-4 h-4" />Verifikasi KYC
              </button>
              <button
                disabled={kycBusy}
                onClick={async () => { setKycBusy(true); try { await onKyc(false); } finally { setKycBusy(false); } }}
                className="px-4 py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition disabled:opacity-60"
              >
                Tolak
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle className="w-4 h-4" />KYC terverifikasi</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-kilatgo-50' : 'bg-slate-50'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-kilatgo-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <div className="bg-white rounded-xl border border-slate-100 px-4">{children}</div>
    </div>
  );
}
