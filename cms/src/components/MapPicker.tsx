import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Pin custom (divIcon) — hindari masalah aset ikon default Leaflet di bundler.
const pinIcon = L.divIcon({
  className: 'kg-map-pin',
  html: '<div style="font-size:30px;line-height:1">📍</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 28],
});

type LatLng = { lat: number; lng: number };

// Peta klik/drag untuk memilih titik koordinat. Default: Jakarta bila belum ada nilai.
export default function MapPicker({ value, onChange, height = 300 }: { value: LatLng | null; onChange: (v: LatLng) => void; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const start = value ?? { lat: -6.2, lng: 106.816 };
    const map = L.map(ref.current).setView([start.lat, start.lng], value ? 16 : 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    const marker = L.marker([start.lat, start.lng], { draggable: true, icon: pinIcon }).addTo(map);
    marker.on('dragend', () => { const p = marker.getLatLng(); onChangeRef.current({ lat: p.lat, lng: p.lng }); });
    map.on('click', (e: L.LeafletMouseEvent) => { marker.setLatLng(e.latlng); onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }); });
    mapRef.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 120); // fix ukuran saat muncul di modal
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan marker bila nilai diubah dari luar (mis. paste manual).
  useEffect(() => {
    if (value && markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
      mapRef.current.setView([value.lat, value.lng]);
    }
  }, [value?.lat, value?.lng]);

  return <div ref={ref} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0 }} />;
}
