import { useEffect, useState } from 'react';
import { Search, UserX, UserCheck, Users, Eye, Wallet, Star, Mail, Phone, Calendar, X } from 'lucide-react';
import { getAllUsers, suspendUser, activateUser } from '../api/admin';
import { IMAGE_BASE } from '../api/client';
import type { User } from '../types';

const avatarUrl = (a?: string | null) => (a ? `${IMAGE_BASE}avatars/${a}` : null);
const rp = (v?: number | string | null) => 'Rp ' + Number(v ?? 0).toLocaleString('id-ID');
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

// Avatar bulat: foto bila ada, else inisial nama.
const UserAvatar = ({ name, avatar, size = 40 }: { name: string; avatar?: string | null; size?: number }) => {
  const url = avatarUrl(avatar);
  return (
    <div
      className="rounded-full bg-kilatgo-100 flex items-center justify-center text-kilatgo-700 font-semibold text-sm flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
};

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 ring-purple-200',
  CUSTOMER: 'bg-kilatgo-100 text-kilatgo-700 ring-kilatgo-200',
  DRIVER: 'bg-kilatgo-accent/30 text-kilatgo-900 ring-kilatgo-accent/50',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  SUSPENDED: 'bg-red-100 text-red-700 ring-red-200',
  PENDING: 'bg-amber-100 text-amber-700 ring-amber-200',
};

const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${color}`}>
    {children}
  </span>
);

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detail, setDetail] = useState<User | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await getAllUsers('CUSTOMER'); // halaman ini khusus customer
      setUsers(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat pengguna');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSuspend = async (userId: string) => {
    const reason = window.prompt('Alasan blokir (ditampilkan ke pengguna di aplikasi):', '');
    if (reason === null) return; // batal
    try {
      setActionLoading(userId);
      await suspendUser(userId, reason.trim() || undefined);
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memblokir pengguna');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (userId: string) => {
    try {
      setActionLoading(userId);
      await activateUser(userId);
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mengaktifkan pengguna');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">
            Manajemen
          </p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Pelanggan</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, email, atau telepon"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium">Tidak ada pengguna</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Pengguna
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Peran
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Bergabung
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={user.name} avatar={user.avatar} />
                        <div>
                          <p className="font-semibold text-sm text-kilatgo-950">{user.name}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                          <p className="text-xs text-slate-400">{user.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge color={roleColors[user.role] || 'bg-slate-100 text-slate-700 ring-slate-200'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-kilatgo-950">
                      {rp(user.customer?.balance)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge color={statusColors[user.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setDetail(user)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-kilatgo-700 bg-kilatgo-50 hover:bg-kilatgo-100 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                          Detail
                        </button>
                      {user.status === 'SUSPENDED' ? (
                        <button
                          onClick={() => handleActivate(user.id)}
                          disabled={actionLoading === user.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50"
                        >
                          <UserCheck className="w-4 h-4" />
                          Aktifkan
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspend(user.id)}
                          disabled={actionLoading === user.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                        >
                          <UserX className="w-4 h-4" />
                          Blokir
                        </button>
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

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-kilatgo-950">Detail Pelanggan</h3>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-5">
                <UserAvatar name={detail.name} avatar={detail.avatar} size={64} />
                <div className="min-w-0">
                  <p className="text-lg font-bold text-kilatgo-950 truncate">{detail.name}</p>
                  <div className="mt-1">
                    <Badge color={statusColors[detail.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}>{detail.status}</Badge>
                  </div>
                </div>
              </div>

              {/* Saldo highlight */}
              <div className="rounded-xl bg-gradient-to-br from-kilatgo-500 to-kilatgo-700 text-white p-4 mb-5">
                <div className="flex items-center gap-2 text-white/80 text-xs font-medium">
                  <Wallet className="w-4 h-4" /> Saldo KilatGo
                </div>
                <p className="text-2xl font-extrabold mt-1">{rp(detail.customer?.balance)}</p>
              </div>

              <div className="space-y-3">
                <DetailRow icon={Mail} label="Email" value={detail.email} />
                <DetailRow icon={Phone} label="Telepon" value={detail.phone} />
                <DetailRow icon={Star} label="Rating" value={`${Number(detail.customer?.rating ?? 5).toFixed(1)} (${detail.customer?.totalRatings ?? 0} penilaian)`} />
                <DetailRow icon={Calendar} label="Bergabung" value={fmtDate(detail.createdAt)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-kilatgo-950 truncate">{value}</p>
    </div>
  </div>
);
