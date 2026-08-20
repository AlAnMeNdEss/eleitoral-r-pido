import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Layers,
  Satellite,
  PenLine,
  X,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MapPoint, ZonaEquipe, BuildingFeature } from "@/components/MapView";

const MapView = lazy(() =>
  import("@/components/MapView").then((m) => ({ default: m.MapView }))
);

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa | Pesquisa Eleitoral — Camocim" },
      {
        name: "description",
        content: "Mapa de Camocim com edificações, status de visita e zonas por equipe.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Mapa">
      <MapaPage />
    </AppShell>
  ),
});

// Camocim-CE
const CAMOCIM_CENTER: [number, number] = [-2.9015, -40.8413];

const SITUACAO_COLORS: Record<string, string> = {
  regular: "#16a34a",
  fechada: "#6b7280",
  desabitada: "#3b82f6",
  pendente: "#f59e0b",
};

const SITUACAO_LABELS: Record<string, string> = {
  regular: "Pesquisado",
  fechada: "Fechado (FECH)",
  desabitada: "Desabitado (DESAB)",
  pendente: "Pendente",
};

const TEAM_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

type BoundsFilter = {
  north: number;
  south: number;
  east: number;
  west: number;
};

function MapaPage() {
  const qc = useQueryClient();
  const [filtroSituacao, setFiltroSituacao] = useState<string>("todas");
  const [bounds, setBounds] = useState<BoundsFilter | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [isSatellite, setIsSatellite] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [pendingZone, setPendingZone] = useState<{ geojson: object; nome: string } | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneEquipeId, setNewZoneEquipeId] = useState("");
  const [newZoneColor, setNewZoneColor] = useState(TEAM_COLORS[0]);
  const mapKeyRef = useRef(0); // force re-mount on satellite toggle

  // Fetch all imoveis with coordinates
  const { data: imoveis = [], isLoading: loadingImoveis } = useQuery({
    queryKey: ["mapa-imoveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select(
          "id, numero, latitude, longitude, nome_morador, situacao, ruas!inner(nome, localidades!inner(nome, bairros!inner(nome)))"
        )
        .not("latitude", "is", null)
        .limit(2000);
      if (error) throw error;
      return data as unknown as Array<{
        id: string;
        numero: string;
        latitude: number;
        longitude: number;
        nome_morador: string | null;
        situacao: string | null;
        ruas: { nome: string; localidades: { nome: string; bairros: { nome: string } } };
      }>;
    },
  });

  // Fetch zones
  const { data: zonas = [] } = useQuery({
    queryKey: ["zonas-equipe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zonas_equipe")
        .select("id, nome, cor, geojson, equipe_id, equipes(nome)")
        .order("created_at");
      if (error) throw error;
      return data as unknown as Array<{
        id: string;
        nome: string;
        cor: string;
        geojson: object;
        equipe_id: string | null;
        equipes: { nome: string } | null;
      }>;
    },
  });

  // Fetch equipes
  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes-mapa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipes").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Save zone mutation
  const saveZone = useMutation({
    mutationFn: async ({
      geojson,
      nome,
      cor,
      equipe_id,
    }: {
      geojson: object;
      nome: string;
      cor: string;
      equipe_id?: string;
    }) => {
      const { error } = await supabase.from("zonas_equipe").insert({
        nome,
        geojson: geojson as any,
        cor,
        equipe_id: equipe_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zona salva com sucesso!");
      qc.invalidateQueries({ queryKey: ["zonas-equipe"] });
      setPendingZone(null);
      setNewZoneName("");
      setNewZoneEquipeId("");
      setNewZoneColor(TEAM_COLORS[0]);
      setDrawingMode(false);
    },
    onError: (err) => {
      toast.error("Erro ao salvar zona: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    },
  });

  // Delete zone mutation
  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("zonas_equipe").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zona removida.");
      qc.invalidateQueries({ queryKey: ["zonas-equipe"] });
    },
  });

  // Load buildings from Overpass API based on current map bounds
  const fetchBuildings = useCallback(
    async (b: BoundsFilter) => {
      if (!showBuildings) return;
      // Only fetch at zoom >= 16 (bounds narrow enough)
      const latSpan = b.north - b.south;
      if (latSpan > 0.02) return; // too zoomed out

      setLoadingBuildings(true);
      try {
        const query = `
          [out:json][timeout:20];
          (
            way["building"](${b.south},${b.west},${b.north},${b.east});
          );
          out body;
          >;
          out skel qt;
        `;
        const resp = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: query,
        });
        if (!resp.ok) throw new Error("Overpass API error");
        const json = await resp.json();

        // Parse Overpass response into GeoJSON-like features
        const nodes: Record<number, [number, number]> = {};
        for (const el of json.elements) {
          if (el.type === "node") {
            nodes[el.id] = [el.lat, el.lon];
          }
        }

        // Build a lookup of imoveis by proximity
        const features: BuildingFeature[] = [];
        for (const el of json.elements) {
          if (el.type !== "way" || !el.nodes) continue;
          const coords: [number, number][] = el.nodes
            .map((nid: number) => nodes[nid])
            .filter(Boolean)
            .map(([lat, lng]: [number, number]) => [lng, lat]); // GeoJSON = [lng, lat]

          if (coords.length < 3) continue;
          if (coords[0][0] !== coords[coords.length - 1][0] ||
              coords[0][1] !== coords[coords.length - 1][1]) {
            coords.push(coords[0]); // close ring
          }

          // Find closest imovel to centroid
          const centroidLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
          const centroidLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;

          let closestImovel: (typeof imoveis)[0] | null = null;
          let minDist = 0.0002; // ~20m threshold
          for (const im of imoveis) {
            const d = Math.hypot(im.latitude - centroidLat, im.longitude - centroidLng);
            if (d < minDist) {
              minDist = d;
              closestImovel = im;
            }
          }

          // Apply situacao filter
          const situacao = closestImovel?.situacao ?? null;
          if (filtroSituacao !== "todas" && (situacao ?? "pendente") !== filtroSituacao) continue;

          let titulo = "";
          if (closestImovel) {
            titulo = `${closestImovel.ruas.nome}, ${closestImovel.numero}`;
            if (closestImovel.nome_morador) titulo += ` — ${closestImovel.nome_morador}`;
            titulo += ` (${SITUACAO_LABELS[situacao ?? "pendente"]})`;
          }

          features.push({
            id: el.id,
            geometry: { type: "Polygon", coordinates: [coords] },
            properties: {
              imovel_id: closestImovel?.id,
              situacao,
              numero: closestImovel?.numero,
              nome_morador: closestImovel?.nome_morador,
              titulo,
            },
          });
        }

        setBuildings(features);
      } catch (err) {
        console.warn("Falha ao carregar edificações do OSM:", err);
      } finally {
        setLoadingBuildings(false);
      }
    },
    [imoveis, filtroSituacao, showBuildings]
  );

  const handleBoundsChange = useCallback(
    (b: BoundsFilter) => {
      setBounds(b);
      fetchBuildings(b);
    },
    [fetchBuildings]
  );

  const handleZoneCreated = useCallback((geojson: object, nome: string) => {
    setPendingZone({ geojson, nome });
    setNewZoneName(nome);
    setDrawingMode(false);
  }, []);

  // Build points from imoveis (applying filter)
  const filteredPoints: MapPoint[] = imoveis
    .filter((i) => {
      if (filtroSituacao === "todas") return true;
      const s = i.situacao ?? "pendente";
      return s === filtroSituacao;
    })
    .map((i) => {
      const situacao = i.situacao ?? "pendente";
      let titulo = `${i.ruas.nome}, ${i.numero}`;
      if (i.nome_morador) titulo += ` — ${i.nome_morador}`;
      titulo += ` (${SITUACAO_LABELS[situacao]})`;
      return {
        id: i.id,
        lat: i.latitude,
        lng: i.longitude,
        titulo,
        cor: SITUACAO_COLORS[situacao],
      };
    });

  const zonesForMap: ZonaEquipe[] = showZones
    ? zonas.map((z) => ({ id: z.id, nome: z.nome, cor: z.cor, geojson: z.geojson }))
    : [];

  return (
    <div className="space-y-0">
      {/* Controles */}
      <div className="border-l border-r border-t bg-card">
        {/* Filtro de situação */}
        <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
          {["todas", "regular", "fechada", "desabitada", "pendente"].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroSituacao(s)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-semibold border transition-colors",
                filtroSituacao === s
                  ? "border-transparent text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
              style={
                filtroSituacao === s
                  ? { backgroundColor: s === "todas" ? "#334155" : SITUACAO_COLORS[s] }
                  : {}
              }
            >
              {s === "todas" ? "Todas" : SITUACAO_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Ações do mapa */}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-2">
            {/* Satélite toggle */}
            <button
              onClick={() => setIsSatellite((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                isSatellite
                  ? "border-transparent bg-slate-700 text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <Satellite className="size-3.5" />
              {isSatellite ? "OSM" : "Satélite"}
            </button>

            {/* Zonas toggle */}
            <button
              onClick={() => setShowZones((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                showZones
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <Layers className="size-3.5" />
              Zonas
            </button>

            {/* Buildings toggle */}
            <button
              onClick={() => {
                setShowBuildings((v) => {
                  if (!v && bounds) fetchBuildings(bounds);
                  return !v;
                });
              }}
              className={cn(
                "flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                showBuildings
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              🏠 Casas
            </button>
          </div>

          <div className="flex items-center gap-2">
            {loadingBuildings && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}

            {/* Legend */}
            <button
              onClick={() => setShowLegend((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Legenda {showLegend ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>

            {/* Draw zone */}
            <button
              onClick={() => setDrawingMode((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                drawingMode
                  ? "border-transparent bg-orange-500 text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <PenLine className="size-3.5" />
              {drawingMode ? "Desenhando..." : "Nova Zona"}
            </button>
          </div>
        </div>

        {/* Legenda */}
        {showLegend && (
          <div className="border-t px-3 py-2">
            <div className="flex flex-wrap gap-3">
              {Object.entries(SITUACAO_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    className="size-3 rounded-full border border-white"
                    style={{ backgroundColor: SITUACAO_COLORS[key] }}
                  />
                  <span>{label}</span>
                </div>
              ))}
              {showBuildings && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-3 rounded border border-dashed border-muted-foreground bg-muted/20" />
                  <span>Edificação sem vínculo</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mapa */}
      <ClientOnly
        fallback={
          <div className="flex h-[65vh] w-full items-center justify-center border bg-muted/10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="flex h-[65vh] w-full items-center justify-center border bg-muted/10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <MapView
            key={`map-${isSatellite}`}
            center={CAMOCIM_CENTER}
            zoom={15}
            points={filteredPoints}
            zones={zonesForMap}
            buildings={showBuildings ? buildings : []}
            onBoundsChange={handleBoundsChange}
            onZoneCreated={handleZoneCreated}
            drawingMode={drawingMode}
            className="h-[65vh] w-full border-l border-r"
          />
        </Suspense>
      </ClientOnly>

      {/* Painel de salvar nova zona */}
      {pendingZone && (
        <div className="border-l border-r border-b bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Salvar nova zona no mapa</p>
            <button onClick={() => setPendingZone(null)}>
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                Nome da zona
              </label>
              <input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Ex: Equipe Norte, Setor A..."
                className="w-full rounded border border-input bg-background px-3 h-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                Equipe (opcional)
              </label>
              <select
                value={newZoneEquipeId}
                onChange={(e) => setNewZoneEquipeId(e.target.value)}
                className="w-full rounded border border-input bg-background px-3 h-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Sem equipe</option>
                {equipes.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                Cor
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewZoneColor(c)}
                    className={cn(
                      "size-7 rounded border-2 transition-transform",
                      newZoneColor === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={() =>
              saveZone.mutate({
                geojson: pendingZone.geojson,
                nome: newZoneName || "Zona",
                cor: newZoneColor,
                equipe_id: newZoneEquipeId || undefined,
              })
            }
            disabled={saveZone.isPending}
            className="w-full rounded"
          >
            {saveZone.isPending ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : null}
            Salvar zona
          </Button>
        </div>
      )}

      {/* Lista de zonas cadastradas */}
      {zonas.length > 0 && (
        <div className="border-l border-r border-b bg-card">
          <p className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Zonas cadastradas ({zonas.length})
          </p>
          <ul className="divide-y">
            {zonas.map((z) => (
              <li key={z.id} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full border border-white/50"
                    style={{ backgroundColor: z.cor }}
                  />
                  <span className="text-sm font-medium">{z.nome}</span>
                  {z.equipes && (
                    <span className="text-[11px] text-muted-foreground">— {z.equipes.nome}</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Remover zona "${z.nome}"?`)) {
                      deleteZone.mutate(z.id);
                    }
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Informação de contagem */}
      <div className="border-l border-r border-b bg-muted/5 px-3 py-2">
        <p className="text-[11px] text-muted-foreground">
          {loadingImoveis ? (
            "Carregando imóveis..."
          ) : (
            <>
              <strong>{filteredPoints.length}</strong> imóveis com localização GPS.{" "}
              {showBuildings && (
                <>
                  <strong>{buildings.length}</strong> edificações do OSM visíveis.{" "}
                  {buildings.length === 0 && (
                    <span className="text-amber-600">
                      Aproxime o zoom para ver contornos das casas (disponível a partir do zoom 17+).
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </p>
        {drawingMode && (
          <p className="mt-1 text-[11px] font-semibold text-orange-600">
            🖊️ Modo de desenho ativo — clique no mapa para criar os vértices do polígono. Dê duplo-clique para finalizar.
          </p>
        )}
      </div>
    </div>
  );
}
