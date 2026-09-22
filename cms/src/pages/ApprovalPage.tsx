import { useEffect, useState } from 'react';
import { UserCheck, XCircle, MapPin, ShieldCheck, Inbox, Eye, X, Store, User, Trash2 } from 'lucide-react';
import { getDrivers, approveDriver, getMerchants, approveMerchant, getCustomerKyc, verifyCustomerKyc, resetCustomerKyc, type CustomerKyc } from '../api/admin';
import type { Driver, Merchant } from '../types';
import { onImgError } from '../utils/image';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const docUrl = (name?: string | null) =>
  name ? `${API}/admin/files/${name}?token=${localStorage.getItem('kilatgo_token')}` : '';

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-kilatgo-950 text-right">{value ?? '—'}</span>
    </div>
  );
}

function DocThumb({ label, name }: { label: string; name?: string | null }) {
  if (!name) return null;
  const url = docUrl(name);
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block group">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <img src={url} onError={onImgError} alt={label} className="w-full h-28 object-cover rounded-lg border border-slate-200 bg-slate-50 group-hover:ring-2 ring-kilatgo-400 transition" />
    </a>
  );
}

function ModalShell({ title, subtitle, onClose, children, footer }: {
  title: string; subtitle: string; onClose: () => void;
  children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-kilatgo-950">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-6">{children}</div>
        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          {footer}
        </div>
      </div>
    </div>
  );
}

export default function ApprovalPage() {
  const [tab, setTab] = useState<'driver' | 'merchant' | 'customer'>('driver');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [customers, setCustomers] = useState<CustomerKyc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [selDriver, setSelDriver] = useState<Driver | null>(null);
  const [selMerchant, setSelMerchant] = useState<Merchant | null>(null);
  const [selCustomer, setSelCustomer] = useState<CustomerKyc | null>(null);
  const [custStatus, setCustStatus] = useState<'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  // Sub-filter Menunggu/Disetujui untuk driver & mitra (client-side dari daftar lengkap).
  const [dSub, setDSub] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [mSub, setMSub] = useState<'PENDING' | 'APPROVED'>('PENDING');

  const load = async () => {
    try {
      setLoading(true);
      const [d, m, c] = await Promise.all([getDrivers(), getMerchants(), getCustomerKyc(custStatus)]);
      setDrivers(d); setMerchants(m); setCustomers(c);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  // Muat ulang KYC pelanggan saat sub-filter status berubah.
  const loadCustomers = async (status: 'PENDING' | 'VERIFIED' | 'REJECTED') => {
    setCustStatus(status);
    try { setCustomers(await getCustomerKyc(status)); } catch { /* ignore */ }
  };

  const reloadDrivers = async () => { try { setDrivers(await getDrivers()); } catch { /* ignore */ } };
  const reloadMerchants = async () => { try { setMerchants(await getMerchants()); } catch { /* ignore */ } };
  const doDriver = async (id: string, approve: boolean) => {
    let notes: string | undefined;
    if (!approve) {
      const r = window.prompt('Alasan tolak pendaftaran driver ini (akun terhapus otomatis setelah 3 hari):', '');
      if (r === null) return;
      if (!r.trim()) { setError('Alasan tolak wajib diisi.'); return; }
      notes = r.trim();
    }
    try { setBusy(id); await approveDriver(id, approve, notes); await reloadDrivers(); setSelDriver(null); }
    catch (e: any) { setError(e.response?.data?.message || 'Gagal'); } finally { setBusy(null); }
  };
  const doMerchant = async (id: string, approve: boolean) => {
    if (!approve && !confirm('Tolak pendaftaran usaha ini? Akun mitra akan dihapus.')) return;
    try { setBusy(id); await approveMerchant(id, approve); await reloadMerchants(); setSelMerchant(null); }
    catch (e: any) { setError(e.response?.data?.message || 'Gagal'); } finally { setBusy(null); }
  };
  const doCustomer = async (id: string, approve: boolean) => {
    let notes: string | undefined;
    if (!approve) {
      const r = window.prompt('Alasan tolak (ditampilkan ke pelanggan agar verifikasi ulang sesuai catatan):', '');
      if (r === null) return;
      if (!r.trim()) { setError('Alasan tolak wajib diisi.'); return; }
      notes = r.trim();
    }
    try { setBusy(id); await verifyCustomerKyc(id, approve, notes); await loadCustomers(custStatus); setSelCustomer(null); }
    catch (e: any) { setError(e.response?.data?.message || 'Gagal'); } finally { setBusy(null); }
  };
  const doResetKyc = async (id: string) => {
    if (!confirm('Hapus verifikasi KYC pelanggan ini? Status jadi belum-terverifikasi & foto dihapus — pelanggan wajib verifikasi ulang.')) return;
    try { setBusy(id); await resetCustomerKyc(id); await loadCustomers(custStatus); setSelCustomer(null); }
    catch (e: any) { setError(e.response?.data?.message || 'Gagal'); } finally { setBusy(null); }
  };
  // Ditolak = belum disetujui & kycStatus REJECTED; Menunggu = belum disetujui & belum ditolak.
  const shownDrivers = drivers.filter((d) =>
    dSub === 'APPROVED' ? d.isApproved
      : dSub === 'REJECTED' ? !d.isApproved && d.kycStatus === 'REJECTED'
      : !d.isApproved && d.kycStatus !== 'REJECTED');
  const shownMerchants = merchants.filter((m) => (mSub === 'APPROVED' ? m.isApproved : !m.isApproved));
  const pendingDriverCount = drivers.filter((d) => !d.isApproved && d.kycStatus !== 'REJECTED').length;
  const pendingMerchantCount = merchants.filter((m) => !m.isApproved).length;
  const list = tab === 'driver' ? shownDrivers : tab === 'merchant' ? shownMerchants : customers;
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition disabled:opacity-50';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Manajemen</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Persetujuan</h1>
          <p className="text-sm text-slate-500 mt-1">Pendaftaran driver, mitra usaha &amp; verifikasi KYC pelanggan menunggu review</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['driver', 'merchant', 'customer'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition inline-flex items-center gap-2 ${tab === t ? 'bg-kilatgo-600 text-white shadow-md shadow-kilatgo-600/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
            {t === 'driver' ? <ShieldCheck className="w-4 h-4" /> : t === 'merchant' ? <Store className="w-4 h-4" /> : <User className="w-4 h-4" />}
            {t === 'driver' ? `Driver (${pendingDriverCount})` : t === 'merchant' ? `Mitra Usaha (${pendingMerchantCount})` : `KYC Pelanggan (${customers.length})`}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}

      {/* Sub-filter riwayat per tab */}
      <div className="flex gap-2">
        {tab === 'customer'
          ? ([['PENDING', 'Menunggu'], ['VERIFIED', 'Disetujui'], ['REJECTED', 'Ditolak']] as const).map(([s, label]) => (
              <button key={s} onClick={() => loadCustomers(s)}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition ${custStatus === s ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                {label}
              </button>
            ))
          : ((tab === 'driver'
              ? [['PENDING', 'Menunggu'], ['APPROVED', 'Disetujui'], ['REJECTED', 'Ditolak']]
              : [['PENDING', 'Menunggu'], ['APPROVED', 'Disetujui']]) as ['PENDING' | 'APPROVED' | 'REJECTED', string][]).map(([s, label]) => {
              const active = tab === 'driver' ? dSub === s : mSub === s;
              return (
                <button key={s} onClick={() => (tab === 'driver' ? setDSub(s) : setMSub(s as 'PENDING' | 'APPROVED'))}
                  className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                  {label}
                </button>
              );
            })}
      </div>

      {tab === 'driver' && dSub === 'REJECTED' && (
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          Pendaftaran yang ditolak terhapus otomatis <strong>3 hari</strong> setelah ditolak. Sesudah itu
          email &amp; nomor HP-nya bebas dan driver bisa mendaftar ulang dari awal.
        </p>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500" /></div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-slate-400" /></div>
            <p className="text-sm font-medium">Tidak ada data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{tab === 'driver' ? 'Pendaftar' : tab === 'merchant' ? 'Usaha' : 'Pelanggan'}</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{tab === 'driver' ? 'Kendaraan' : tab === 'merchant' ? 'Pemilik / Lokasi' : 'Rekening'}</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tab === 'driver' && shownDrivers.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-sm text-kilatgo-950">{d.user.name}</p>
                      <p className="text-sm text-slate-500">{d.user.email}</p>
                      <p className="text-xs text-slate-400">{d.user.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-kilatgo-950">{d.vehicleType}</p>
                      <p className="text-xs text-slate-500">{d.vehiclePlate}</p>
                      <p className="text-xs text-slate-400">{d.city ?? ''}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelDriver(d)} className={`${btn} text-slate-700 bg-slate-100 hover:bg-slate-200`}><Eye className="w-4 h-4" />Detail</button>
                        {!d.isApproved && (
                          <button onClick={() => doDriver(d.id, true)} disabled={busy === d.id} className={`${btn} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`}><UserCheck className="w-4 h-4" />Setujui</button>
                        )}
                        {d.kycStatus !== 'REJECTED' && (
                          <button onClick={() => doDriver(d.id, false)} disabled={busy === d.id} className={`${btn} text-red-700 bg-red-50 hover:bg-red-100`}><XCircle className="w-4 h-4" />Tolak</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {tab === 'merchant' && shownMerchants.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-sm text-kilatgo-950">{m.businessName}</p>
                      <p className="text-sm text-slate-500">{m.category ?? '—'}</p>
                      <p className="text-xs text-slate-400">{m.user.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-kilatgo-950">{m.ownerName}</p>
                      <p className="text-xs text-slate-500">{m.city ?? ''}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelMerchant(m)} className={`${btn} text-slate-700 bg-slate-100 hover:bg-slate-200`}><Eye className="w-4 h-4" />Detail</button>
                        {!m.isApproved && (
                          <>
                            <button onClick={() => doMerchant(m.id, true)} disabled={busy === m.id} className={`${btn} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`}><UserCheck className="w-4 h-4" />Setujui</button>
                            <button onClick={() => doMerchant(m.id, false)} disabled={busy === m.id} className={`${btn} text-red-700 bg-red-50 hover:bg-red-100`}><XCircle className="w-4 h-4" />Tolak</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {tab === 'customer' && customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-sm text-kilatgo-950">{c.name}</p>
                      <p className="text-sm text-slate-500">{c.email}</p>
                      <p className="text-xs text-slate-400">{c.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-kilatgo-950">{c.bankName ?? '—'}</p>
                      <p className="text-xs text-slate-500">{c.bankAccount ?? ''}</p>
                      <p className="text-xs text-slate-400">{c.bankHolder ?? ''}</p>
                      {c.kycStatus === 'REJECTED' && c.note && <p className="text-xs text-red-600 mt-0.5">Alasan: {c.note}</p>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelCustomer(c)} className={`${btn} text-slate-700 bg-slate-100 hover:bg-slate-200`}><Eye className="w-4 h-4" />Detail</button>
                        {custStatus === 'PENDING' && (
                          <button onClick={() => doCustomer(c.id, true)} disabled={busy === c.id} className={`${btn} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`}><UserCheck className="w-4 h-4" />Setujui</button>
                        )}
                        {custStatus !== 'REJECTED' && (
                          <button onClick={() => doCustomer(c.id, false)} disabled={busy === c.id} className={`${btn} text-red-700 bg-red-50 hover:bg-red-100`}><XCircle className="w-4 h-4" />Tolak</button>
                        )}
                        {custStatus !== 'PENDING' && (
                          <button onClick={() => doResetKyc(c.id)} disabled={busy === c.id} className={`${btn} text-red-700 bg-red-50 hover:bg-red-100`}><Trash2 className="w-4 h-4" />Hapus</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selDriver && (
        <ModalShell title={selDriver.user.name} subtitle="Detail pendaftaran driver"
          onClose={() => setSelDriver(null)}
          footer={<>
            {!selDriver.isApproved && (
              <button onClick={() => doDriver(selDriver.id, true)} disabled={busy === selDriver.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"><UserCheck className="w-4 h-4" />Setujui</button>
            )}
            {selDriver.kycStatus !== 'REJECTED' && (
              <button onClick={() => doDriver(selDriver.id, false)} disabled={busy === selDriver.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"><XCircle className="w-4 h-4" />Tolak</button>
            )}
          </>}>
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-1">Akun & Diri</h3>
              <Row label="Email" value={selDriver.user.email} />
              <Row label="No HP" value={selDriver.user.phone} />
              <Row label="NIK" value={selDriver.nik} />
              <Row label="Kota" value={selDriver.city} />
              <Row label="Alamat" value={selDriver.address} />
              <Row label="Layanan" value={selDriver.serviceType === 'CAR' ? 'Mobil' : 'Motor'} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-1">Kendaraan & SIM</h3>
              <Row label="Kendaraan" value={selDriver.vehicleType} />
              <Row label="Plat" value={selDriver.vehiclePlate} />
              <Row label="SIM" value={selDriver.simType ? `${selDriver.simType} · ${selDriver.simNumber ?? ''}` : selDriver.licenseNumber} />
              <Row label="Bank" value={selDriver.bankName} />
              <Row label="No rek" value={selDriver.bankAccount} />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-3">Dokumen (KYC)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <DocThumb label="e-KTP" name={selDriver.ktpPhoto} />
              <DocThumb label="Selfie" name={selDriver.selfiePhoto} />
              <DocThumb label="SIM" name={selDriver.simPhoto} />
              <DocThumb label="STNK" name={selDriver.stnkPhoto} />
              <DocThumb label="SKCK" name={selDriver.skckPhoto} />
            </div>
          </div>
        </ModalShell>
      )}

      {selMerchant && (
        <ModalShell title={selMerchant.businessName} subtitle="Detail pendaftaran mitra usaha"
          onClose={() => setSelMerchant(null)}
          footer={<>
            {!selMerchant.isApproved ? (
              <>
                <button onClick={() => doMerchant(selMerchant.id, true)} disabled={busy === selMerchant.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"><UserCheck className="w-4 h-4" />Setujui</button>
                <button onClick={() => doMerchant(selMerchant.id, false)} disabled={busy === selMerchant.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"><XCircle className="w-4 h-4" />Tolak</button>
              </>
            ) : (
              <div className="flex-1 text-center text-sm text-emerald-600 font-semibold py-3">✓ Mitra sudah disetujui</div>
            )}
          </>}>
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-1">Usaha</h3>
              <Row label="Kategori" value={selMerchant.category} />
              <Row label="Pemilik" value={selMerchant.ownerName} />
              <Row label="NIK" value={selMerchant.nik} />
              <Row label="Kota" value={selMerchant.city} />
              <Row label="Alamat" value={selMerchant.address} />
              <Row label="Jam" value={selMerchant.operatingHours} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-1">Legalitas & Rekening</h3>
              <Row label="NPWP" value={selMerchant.npwp} />
              <Row label="NIB" value={selMerchant.nib} />
              <Row label="SIUP" value={selMerchant.siup} />
              <Row label="Bank" value={selMerchant.bankName} />
              <Row label="No rek" value={selMerchant.bankAccount} />
            </div>
          </div>
          {selMerchant.latitude != null && (
            <a className="inline-flex items-center gap-1 text-sm text-kilatgo-600 hover:underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${selMerchant.latitude},${selMerchant.longitude}`}>
              <MapPin className="w-4 h-4" /> Lihat lokasi di Maps
            </a>
          )}
          <div>
            <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-3">Dokumen (KYC)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <DocThumb label="e-KTP" name={selMerchant.ktpPhoto} />
              <DocThumb label="Outlet" name={selMerchant.outletPhoto} />
              <DocThumb label="NPWP" name={selMerchant.npwpPhoto} />
            </div>
          </div>
          {selMerchant.menus && selMerchant.menus.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-2">Menu ({selMerchant.menus.length})</h3>
              <div className="space-y-1">
                {selMerchant.menus.map((mn) => (
                  <div key={mn.id} className="flex justify-between text-sm border-b border-slate-100 py-1.5">
                    <span className="text-slate-700">{mn.name}</span>
                    <span className="font-medium text-kilatgo-950">Rp {Number(mn.price).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ModalShell>
      )}

      {selCustomer && (
        <ModalShell title={selCustomer.name} subtitle={`Verifikasi KYC pelanggan · ${selCustomer.kycStatus === 'VERIFIED' ? 'Disetujui' : selCustomer.kycStatus === 'REJECTED' ? 'Ditolak' : 'Menunggu'}`}
          onClose={() => setSelCustomer(null)}
          footer={<>
            {selCustomer.kycStatus === 'PENDING' && (
              <button onClick={() => doCustomer(selCustomer.id, true)} disabled={busy === selCustomer.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"><UserCheck className="w-4 h-4" />Setujui</button>
            )}
            {selCustomer.kycStatus !== 'REJECTED' && (
              <button onClick={() => doCustomer(selCustomer.id, false)} disabled={busy === selCustomer.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"><XCircle className="w-4 h-4" />Tolak</button>
            )}
            {selCustomer.kycStatus !== 'PENDING' && (
              <button onClick={() => doResetKyc(selCustomer.id)} disabled={busy === selCustomer.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"><Trash2 className="w-4 h-4" />Hapus (verif. ulang)</button>
            )}
          </>}>
          {selCustomer.kycStatus === 'REJECTED' && selCustomer.note && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"><b>Alasan ditolak:</b> {selCustomer.note}</div>
          )}
          <div>
            <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-1">Akun & Rekening</h3>
            <Row label="Email" value={selCustomer.email} />
            <Row label="No HP" value={selCustomer.phone} />
            <Row label="Bank" value={selCustomer.bankName} />
            <Row label="No rek" value={selCustomer.bankAccount} />
            <Row label="Nama rek" value={selCustomer.bankHolder} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-3">Dokumen (KYC)</h3>
            <div className="grid grid-cols-2 gap-3">
              <DocThumb label="e-KTP" name={selCustomer.ktpPhoto} />
              <DocThumb label="Selfie + KTP" name={selCustomer.selfiePhoto} />
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
