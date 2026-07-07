// Per-service pricing. CAR is roomier/AC so it costs more than a motorbike RIDE.
const PRICING = {
  RIDE: { baseFare: 5000, perKmRate: 2500, minFare: 8000 },
  CAR: { baseFare: 10000, perKmRate: 4000, minFare: 15000 },
} as const;

export function calculateFare(distanceKm: number, serviceType: 'RIDE' | 'CAR' = 'RIDE'): number {
  const p = PRICING[serviceType] ?? PRICING.RIDE;
  return Math.max(p.minFare, Math.round(p.baseFare + distanceKm * p.perKmRate));
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
