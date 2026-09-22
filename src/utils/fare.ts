type Pricing = { baseFare: number; perKmRate: number; minFare: number };

// Default per-layanan (dipakai bila settings admin tak diisi). CAR lebih mahal (AC/luas).
const DEFAULT_PRICING: Record<string, Pricing> = {
  RIDE: { baseFare: 5000, perKmRate: 2500, minFare: 8000 },
  CAR: { baseFare: 10000, perKmRate: 4000, minFare: 15000 },
  SEND: { baseFare: 6000, perKmRate: 2500, minFare: 9000 }, // kurir motor
  FOOD: { baseFare: 5000, perKmRate: 2500, minFare: 8000 }, // antar makanan (ongkir)
};

// Tarif dari settings admin: key `<service>_base_fare|_per_km|_min_fare` (mis. ride_base_fare).
// Fallback ke DEFAULT_PRICING per field agar admin bisa isi sebagian saja.
export function pricingFor(serviceType: string, settings?: Record<string, string>): Pricing {
  const d = DEFAULT_PRICING[serviceType] ?? DEFAULT_PRICING.RIDE;
  if (!settings) return d;
  const k = serviceType.toLowerCase();
  const num = (key: string, def: number) => {
    const v = parseFloat(settings[key]);
    return Number.isFinite(v) ? v : def;
  };
  return {
    baseFare: num(`${k}_base_fare`, d.baseFare),
    perKmRate: num(`${k}_per_km`, d.perKmRate),
    minFare: num(`${k}_min_fare`, d.minFare),
  };
}

export function calculateFare(distanceKm: number, serviceType = 'RIDE', settings?: Record<string, string>): number {
  const p = pricingFor(serviceType, settings);
  return Math.max(p.minFare, Math.round(p.baseFare + distanceKm * p.perKmRate));
}

// Biaya tambahan KilatSend berdasarkan tipe/ukuran paket (Rp).
const PACKAGE_SURCHARGE: Record<string, number> = {
  DOCUMENT: 0, // dokumen
  SMALL: 0, // barang kecil (< 5kg)
  MEDIUM: 5000, // barang sedang (5–20kg)
  LARGE: 15000, // barang besar (> 20kg)
};

export function packageSurcharge(packageType?: string | null): number {
  return PACKAGE_SURCHARGE[String(packageType ?? '').toUpperCase()] ?? 0;
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
