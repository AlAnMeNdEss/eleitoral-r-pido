import { useEffect, useRef } from "react";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  numero: string;
  titulo: string;
  cor: string;
  situacao?: string | null;
};

export type ZonaEquipe = {
  id: string;
  nome: string;
  cor: string;
  geojson: object;
};

export type BuildingFeature = {
  id: string | number;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][];
  };
  properties: {
    imovel_id?: string;
    situacao?: string | null;
    numero?: string;
    nome_morador?: string | null;
    titulo?: string;
  };
};

type Props = {
  points?: MapPoint[];
  center?: [number, number] | undefined;
  zoom?: number;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
  zones?: ZonaEquipe[];
  buildings?: BuildingFeature[];
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  onZoneCreated?: (geojson: object, nome: string) => void;
  drawingMode?: boolean;
};

// Camocim-CE
export const CAMOCIM_CENTER: [number, number] = [-2.9015, -40.8413];

const SITUACAO_COLORS: Record<string, string> = {
  regular: "#16a34a",
  fechada: "#6b7280",
  desabitada: "#3b82f6",
  pendente: "#f59e0b",
};

export function MapView({
  points = [],
  center,
  zoom = 15,
  onPick,
  className,
  zones = [],
  buildings = [],
  onBoundsChange,
  onZoneCreated,
  drawingMode = false,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const pointsLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const buildingsLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const zonesLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onZoneCreatedRef = useRef(onZoneCreated);

  pickRef.current = onPick;
  onBoundsChangeRef.current = onBoundsChange;
  onZoneCreatedRef.current = onZoneCreated;

  // Initialize Leaflet and Geoman
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      
      // Crucial: assign window.L before importing geoman
      (window as any).L = L;
      await import("@geoman-io/leaflet-geoman-free");
      await import("@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css");

      if (cancelled || !el.current || mapRef.current) return;

      const map = L.map(el.current, { zoomControl: true }).setView(
        center ?? CAMOCIM_CENTER,
        zoom
      );

      // OpenStreetMap Tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href='https://openstreetmap.org'>OpenStreetMap</a>",
        maxZoom: 20,
      }).addTo(map);

      pointsLayerRef.current = L.layerGroup().addTo(map);
      buildingsLayerRef.current = L.layerGroup().addTo(map);
      zonesLayerRef.current = L.layerGroup().addTo(map);

      // Setup geoman options on map
      if ((map as any).pm) {
        (map as any).pm.setGlobalOptions({
          snappable: true,
          snapDistance: 20,
          allowSelfIntersection: false,
        });

        (map as any).pm.setPathOptions({
          color: "#ea580c",
          fillColor: "#ea580c",
          fillOpacity: 0.25,
          weight: 3,
        });
      }

      // Click event
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        pickRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      // Bounds change event
      const fireBoundsChange = () => {
        const b = map.getBounds();
        onBoundsChangeRef.current?.({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      };
      map.on("moveend", fireBoundsChange);
      map.on("zoomend", fireBoundsChange);

      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 250);
      fireBoundsChange();
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      pointsLayerRef.current = null;
      buildingsLayerRef.current = null;
      zonesLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render House Points with custom number badges
  useEffect(() => {
    const render = async () => {
      const L = (await import("leaflet")).default;
      const layer = pointsLayerRef.current;
      if (!layer) return;
      layer.clearLayers();

      points.forEach((p) => {
        // Custom HTML badge marker showing the house number
        const customIcon = L.divIcon({
          className: "custom-house-marker",
          html: `
            <div style="
              background-color: ${p.cor};
              color: #ffffff;
              font-weight: 700;
              font-size: 11px;
              padding: 2px 6px;
              border-radius: 4px;
              border: 1.5px solid #ffffff;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              white-space: nowrap;
              text-align: center;
              line-height: 1.2;
              transform: translate(-50%, -50%);
            ">
              ${p.numero || "●"}
            </div>
          `,
          iconSize: [0, 0],
        });

        L.marker([p.lat, p.lng], { icon: customIcon })
          .bindPopup(`
            <div style="font-family: inherit; padding: 2px;">
              <strong style="font-size: 13px;">${p.titulo}</strong>
            </div>
          `)
          .addTo(layer);
      });

      const map = mapRef.current;
      if (map && points.length > 0 && !center) {
        map.fitBounds(
          L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])).pad(0.15),
          { maxZoom: 18 }
        );
      }
    };
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // Render Building Polygons
  useEffect(() => {
    const render = async () => {
      const L = (await import("leaflet")).default;
      const layer = buildingsLayerRef.current;
      if (!layer) return;
      layer.clearLayers();

      buildings.forEach((b) => {
        const situacao = b.properties.situacao;
        const fillColor = SITUACAO_COLORS[situacao ?? "pendente"] ?? SITUACAO_COLORS["pendente"];
        const hasData = !!situacao;

        try {
          const geoJsonLayer = L.geoJSON(b as any, {
            style: {
              color: hasData ? fillColor : "#94a3b8",
              weight: hasData ? 2 : 1,
              fillColor,
              fillOpacity: hasData ? 0.65 : 0.15,
              dashArray: hasData ? undefined : "3 3",
            },
          });

          if (b.properties.titulo) {
            geoJsonLayer.bindPopup(b.properties.titulo);
          }
          geoJsonLayer.addTo(layer);
        } catch {
          // skip malformed
        }
      });
    };
    render();
  }, [buildings]);

  // Render Team Zones
  useEffect(() => {
    const render = async () => {
      const L = (await import("leaflet")).default;
      const layer = zonesLayerRef.current;
      if (!layer) return;
      layer.clearLayers();

      zones.forEach((z) => {
        try {
          L.geoJSON(z.geojson as any, {
            style: {
              color: z.cor,
              weight: 3,
              fillColor: z.cor,
              fillOpacity: 0.18,
              dashArray: "5 5",
            },
          })
            .bindTooltip(
              `<div style="font-weight: 700; font-size: 12px; color: ${z.cor}; text-shadow: 0 1px 2px #fff;">${z.nome}</div>`,
              { permanent: true, direction: "center", className: "bg-transparent border-0 shadow-none" }
            )
            .addTo(layer);
        } catch {
          // skip
        }
      });
    };
    render();
  }, [zones]);

  // Handle Geoman Drawing Controls
  useEffect(() => {
    const map = mapRef.current as any;
    if (!map?.pm) return;

    if (drawingMode) {
      map.pm.addControls({
        position: "topright",
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: true,
        drawPolygon: true,
        drawCircle: false,
        editMode: true,
        dragMode: false,
        cutPolygon: false,
        removalMode: true,
      });

      map.pm.enableDraw("Polygon", {
        snappable: true,
        snapDistance: 20,
      });

      const handleCreate = (e: any) => {
        const geojson = e.layer.toGeoJSON();
        const nome = window.prompt("Digite o nome da Área / Equipe:") || "Nova Área";
        if (nome) {
          onZoneCreatedRef.current?.(geojson, nome);
        }
        map.removeLayer(e.layer);
      };

      map.on("pm:create", handleCreate);

      return () => {
        map.off("pm:create", handleCreate);
        map.pm?.disableDraw?.();
        map.pm?.removeControls?.();
      };
    } else {
      map.pm?.disableDraw?.();
      map.pm?.removeControls?.();
      return undefined;
    }
  }, [drawingMode]);

  return (
    <div
      ref={el}
      className={className ?? "h-[65vh] w-full border"}
      style={{ position: "relative" }}
    />
  );
}
