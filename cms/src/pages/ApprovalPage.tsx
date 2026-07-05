import { useEffect, useState } from 'react';
import { UserCheck, XCircle, MapPin, ShieldCheck, Inbox, Eye, X, Store, BadgeCheck } from 'lucide-react';
import { getPendingDrivers, approveDriver, getPendingMerchants, approveMerchant, verifyKyc } from '../api/admin';
import type { Driver, Merchant } from '../types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const docUrl = (name?: string | null) =>
  name ? `${API}/admin/files/${name}?token=${localStorage.getItem('kilatgo_token')}` : '';

function KycBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    VERIFIED: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    PENDING: 'bg-amber-100 text-amber-700 ring-amber-200',
    REJECTED: 'bg-red-100 text-red-700 ring-red-200',
    UNVERIFIED: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  const s = status || 'UNVERIFIED';
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${map[s]}`}><BadgeCheck className="w-3 h-3" />KYC: {s}</span>;
}

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
      <img src={url} alt={label} className="w-full h-28 object-cover rounded-lg border border-slate-200 group-hover:ring-2 ring-kilatgo-400 transition" />
    </a>
  );
}

function ModalShell({ title, subtitle, kyc, onClose, onVerifyKyc, children, footer }: {
  title: string; subtitle: string; kyc?: string; onClose: () => void; onVerifyKyc?: () => void;
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
          <div className="flex items-center gap-3">
            <KycBadge status={kyc} />
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
        </div>
        <div className="p-6 space-y-6">{children}</div>
        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          {onVerifyKyc && (
            <button onClick={onVerifyKyc} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-kilatgo-700 bg-kilatgo-50 hover:bg-kilatgo-100 transition">
              <BadgeCheck className="w-4 h-4" /> Verifikasi KYC
            </button>
          )}
          {footer}
        </div>
      </div>
    </div>
  );
}

export default function ApprovalPage() {
  const [tab, setTab] = useState<'driver' | 'merchant'>('driver');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [selDriver, setSelDriver] = useState<Driver | null>(null);
  const [selMerchant, setSelMerchant] = useState<Merchant | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [d, m] = await Promise.all([getPendingDrivers(), getPendingMerchants()]);
      setDrivers(d); setMerchants(m);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const doDriver = async (id: string, approve: boolean) => {
    if (!approve && !confirm('Reject pendaftaran driver ini?')) return;
    try { setBusy(id); await approveDriver(id, approve); setDrivers((p) => p.filter((x) => x.id !== id)); setSelDriver(null); }
    catch (e: any) { setError(e.response?.data?.message || 'Gagal'); } finally { setBusy(null); }
  };
  const doMerchant = async (id: string, approve: boolean) => {
    if (!approve && !confirm('Reject pendaftaran usaha ini?')) return;
    try { setBusy(id); await approveMerchant(id, approve); setMerchants((p) => p.filter((x) => x.id !== id)); setSelMerchant(null); }
    catch (e: any) { setError(e.response?.data?.message || 'Gagal'); } finally { setBusy(null); }
  };
  const doKyc = async (type: 'driver' | 'merchant', id: string) => {
    try { setBusy(id); await verifyKyc(type, id, true); alert('KYC ditandai terverifikasi.'); load(); }
    catch (e: any) { setError(e.response?.data?.message || 'Gagal verifikasi KYC'); } finally { setBusy(null); }
  };

  const list = tab === 'driver' ? drivers : merchants;
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition disabled:opacity-50';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Management</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Approval</h1>
          <p className="text-sm text-slate-500 mt-1">Pendaftaran driver &amp; mitra usaha menunggu review</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['driver', 'merchant'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition inline-flex items-center gap-2 ${tab === t ? 'bg-kilatgo-600 text-white shadow-md shadow-kilatgo-600/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
            {t === 'driver' ? <ShieldCheck className="w-4 h-4" /> : <Store className="w-4 h-4" />}
            {t === 'driver' ? `Driver (${drivers.length})` : `Mitra Usaha (${merchants.length})`}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500" /></div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-slate-400" /></div>
            <p className="text-sm font-medium">Tidak ada yang menunggu approval</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{tab === 'driver' ? 'Applicant' : 'Usaha'}</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{tab === 'driver' ? 'Kendaraan' : 'Pemilik / Lokasi'}</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tab === 'driver' && drivers.map((d) => (
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
                        <button onClick={() => doDriver(d.id, true)} disabled={busy === d.id} className={`${btn} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`}><UserCheck className="w-4 h-4" />Approve</button>
                        <button onClick={() => doDriver(d.id, false)} disabled={busy === d.id} className={`${btn} text-red-700 bg-red-50 hover:bg-red-100`}><XCircle className="w-4 h-4" />Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tab === 'merchant' && merchants.map((m) => (
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
                        <button onClick={() => doMerchant(m.id, true)} disabled={busy === m.id} className={`${btn} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`}><UserCheck className="w-4 h-4" />Approve</button>
                        <button onClick={() => doMerchant(m.id, false)} disabled={busy === m.id} className={`${btn} text-red-700 bg-red-50 hover:bg-red-100`}><XCircle className="w-4 h-4" />Reject</button>
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
        <ModalShell title={selDriver.user.name} subtitle="Detail pendaftaran driver" kyc={selDriver.kycStatus}
          onClose={() => setSelDriver(null)} onVerifyKyc={() => doKyc('driver', selDriver.id)}
          footer={<>
            <button onClick={() => doDriver(selDriver.id, true)} disabled={busy === selDriver.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"><UserCheck className="w-4 h-4" />Approve</button>
            <button onClick={() => doDriver(selDriver.id, false)} disabled={busy === selDriver.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"><XCircle className="w-4 h-4" />Reject</button>
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
        <ModalShell title={selMerchant.businessName} subtitle="Detail pendaftaran mitra usaha" kyc={selMerchant.kycStatus}
          onClose={() => setSelMerchant(null)} onVerifyKyc={() => doKyc('merchant', selMerchant.id)}
          footer={<>
            <button onClick={() => doMerchant(selMerchant.id, true)} disabled={busy === selMerchant.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"><UserCheck className="w-4 h-4" />Approve</button>
            <button onClick={() => doMerchant(selMerchant.id, false)} disabled={busy === selMerchant.id} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"><XCircle className="w-4 h-4" />Reject</button>
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
    </div>
  );
}
