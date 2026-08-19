import { useEffect, useRef } from "react";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  titulo: string;
  cor: string;
};

type Props = {
  points?: MapPoint[];
  center?: [number, number];
  zoom?: number;
  /** Quando definido, clicar no mapa devolve a coordenada escolhida. */
  onPick?: (lat: number, lng: number) => void;
  className?: string;
};

const DEFAULT_CENTER: [number, number] = [-3.7319, -38.5267]; // Fortaleza

export function MapView({ points = [], center, zoom = 13, onPick, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current).setView(center ?? DEFAULT_CENTER, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        pickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
      render();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function render() {
    const L = (await import("leaflet")).default;
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    points.forEach((p) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: p.cor,
        fillOpacity: 0.95,
      })
        .bindPopup(p.titulo)
        .addTo(layer);
    });
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])).pad(0.2), {
        maxZoom: 17,
      });
    } else if (center) {
      map.setView(center, zoom);
    }
  }

  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, center?.[0], center?.[1]]);

  return <div ref={el} className={className ?? "h-[60vh] w-full rounded-xl border"} />;
}
