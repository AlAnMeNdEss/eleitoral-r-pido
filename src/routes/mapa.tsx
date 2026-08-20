import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Layers,
  Satellite,
  PenLine,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Home,
  CheckCircle2,
  Clock,
  Building,
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
        content: "Mapa georreferenciado de Camocim com imóveis, status de visitação e zonas por equipe.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Mapa de Camocim">
      <MapaPage />
    </AppShell>
  ),
});

// Camocim-CE (Centro / Boa Esperança)
const CAMOCIM_CENTER: [number, number] = [-2.9065, -40.8545];

const SITUACAO_COLORS: Record<string, string> = {
  regular: "#16a34a",
  fechada: "#6b7280",
  desabitada: "#3b82f6",
  pendente: "#f59e0b",
};

const SITUACAO_LABELS: Record<string, string> = {
  regular: "Pesquisada / Aberta",
  fechada: "Fechada (FECH)",
  desabitada: "Desabitada (DESAB)",
  pendente: "Pendente de Visita",
};

const TEAM_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function MapaPage() {
  const qc = useQueryClient();
  const [filtroSituacao, setFiltroSituacao] = useState<string>("todas");
  const [drawingMode, setDrawingMode] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [pendingZone, setPendingZone] = useState<{ geojson: object; nome: string } | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneEquipeId, setNewZoneEquipeId] = useState("");
  const [newZoneColor, setNewZoneColor] = useState(TEAM_COLORS[0]);

  // Carregar todos os imóveis com GPS diretamente do banco de dados
  const { data: imoveis = [], isLoading: loadingImoveis } = useQuery({
    queryKey: ["mapa-imoveis-direct"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select("id, numero, complemento, latitude, longitude, nome_morador, situacao, voto_presidente, voto_governador, ruas(nome)")
        .not("latitude", "is", null)
        .limit(3000);

      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        numero: string;
        complemento: string;
        latitude: number;
        longitude: number;
        nome_morador: string | null;
        situacao: string | null;
        voto_presidente: string | null;
        voto_governador: string | null;
        ruas: { nome: string } | null;
      }>;
    },
  });

  // Carregar zonas cadastradas
  const { data: zonas = [] } = useQuery({
    queryKey: ["zonas-equipe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zonas_equipe")
        .select("id, nome, cor, geojson, equipe_id, equipes(nome)")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        nome: string;
        cor: string;
        geojson: object;
        equipe_id: string | null;
        equipes: { nome: string } | null;
      }>;
    },
  });

  // Carregar equipes
  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes-mapa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Salvar nova zona
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
      toast.success("Área delimitada salva com sucesso!");
      qc.invalidateQueries({ queryKey: ["zonas-equipe"] });
      setPendingZone(null);
      setNewZoneName("");
      setNewZoneEquipeId("");
      setNewZoneColor(TEAM_COLORS[0]);
      setDrawingMode(false);
    },
    onError: (err) => {
      toast.error("Erro ao salvar zona: " + (err instanceof Error ? err.message : "Erro"));
    },
  });

  // Excluir zona
  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("zonas_equipe").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Área removida.");
      qc.invalidateQueries({ queryKey: ["zonas-equipe"] });
    },
  });

  // Gerar contornos de edificações fiéis ao redor de cada imóvel cadastrado
  const buildingFootprints = useMemo<BuildingFeature[]>(() => {
    if (!showBuildings) return [];

    const delta = 0.000045; // ~5 metros de raio para o lote/casa
    return imoveis
      .filter((i) => {
        if (filtroSituacao === "todas") return true;
        return (i.situacao ?? "pendente") === filtroSituacao;
      })
      .map((i) => {
        const lat = i.latitude;
        const lng = i.longitude;
        const coords: number[][] = [
          [lng - delta, lat - delta],
          [lng + delta, lat - delta],
          [lng + delta, lat + delta],
          [lng - delta, lat + delta],
          [lng - delta, lat - delta],
        ];

        const ruaNome = i.ruas?.nome || "Rua";
        let titulo = `${ruaNome}, Nº ${i.numero}`;
        if (i.nome_morador) titulo += ` — ${i.nome_morador}`;
        titulo += ` (${SITUACAO_LABELS[i.situacao ?? "pendente"]})`;

        return {
          id: i.id,
          geometry: {
            type: "Polygon" as const,
            coordinates: [coords],
          },
          properties: {
            imovel_id: i.id,
            situacao: i.situacao,
            numero: i.numero,
            nome_morador: i.nome_morador,
            titulo,
          },
        };
      });
  }, [imoveis, showBuildings, filtroSituacao]);

  // Pontos de marcadores no mapa com número da casa
  const filteredPoints = useMemo<MapPoint[]>(() => {
    return imoveis
      .filter((i) => {
        if (filtroSituacao === "todas") return true;
        return (i.situacao ?? "pendente") === filtroSituacao;
      })
      .map((i) => {
        const situacao = i.situacao ?? "pendente";
        const ruaNome = i.ruas?.nome || "Rua";
        let titulo = `${ruaNome}, Nº ${i.numero}`;
        if (i.nome_morador) titulo += ` — ${i.nome_morador}`;
        titulo += ` [${SITUACAO_LABELS[situacao]}]`;

        return {
          id: i.id,
          lat: i.latitude,
          lng: i.longitude,
          numero: i.numero,
          titulo,
          cor: SITUACAO_COLORS[situacao],
          situacao: i.situacao,
        };
      });
  }, [imoveis, filtroSituacao]);

  const zonesForMap: ZonaEquipe[] = useMemo(() => {
    if (!showZones) return [];
    return zonas.map((z) => ({ id: z.id, nome: z.nome, cor: z.cor, geojson: z.geojson }));
  }, [zonas, showZones]);

  // Estatísticas do mapa
  const stats = useMemo(() => {
    const total = imoveis.length;
    const pesquisados = imoveis.filter((i) => i.situacao === "regular").length;
    const fechadas = imoveis.filter((i) => i.situacao === "fechada").length;
    const desabitadas = imoveis.filter((i) => i.situacao === "desabitada").length;
    const pendentes = imoveis.filter((i) => !i.situacao).length;
    return { total, pesquisados, fechadas, desabitadas, pendentes };
  }, [imoveis]);

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* Barra de Controles e Filtros do Mapa */}
      <div className="border border-border bg-card p-3 space-y-2.5">
        {/* Resumo do Mapa */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider">
              Camocim — {stats.total} Imóveis Mapeados
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-600" />
              {stats.pesquisados} Visitadas
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <span className="size-2 rounded-full bg-amber-500" />
              {stats.pendentes} Pendentes
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <span className="size-2 rounded-full bg-slate-500" />
              {stats.fechadas} Fechadas
            </span>
            <span className="flex items-center gap-1 text-blue-700">
              <span className="size-2 rounded-full bg-blue-600" />
              {stats.desabitadas} Desabitadas
            </span>
          </div>
        </div>

        {/* Filtros por Situação */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {[
              { key: "todas", label: "Todas as Casas" },
              { key: "regular", label: "Visitadas (Verde)" },
              { key: "pendente", label: "Pendentes (Amarelo)" },
              { key: "fechada", label: "Fechadas (Cinza)" },
              { key: "desabitada", label: "Desabitadas (Azul)" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setFiltroSituacao(s.key)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-bold uppercase border transition-colors",
                  filtroSituacao === s.key
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Alternar Zonas */}
            <button
              onClick={() => setShowZones((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase border transition-colors",
                showZones
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <Layers className="size-3.5" />
              <span>Zonas ({zonas.length})</span>
            </button>

            {/* Alternar Casas */}
            <button
              onClick={() => setShowBuildings((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase border transition-colors",
                showBuildings
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <Home className="size-3.5" />
              <span>Casas</span>
            </button>

            {/* Delimitar Nova Zona */}
            <button
              onClick={() => setDrawingMode((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-3 py-1 text-[11px] font-black uppercase border transition-all",
                drawingMode
                  ? "bg-orange-600 text-white border-orange-600 animate-pulse shadow-md"
                  : "border-orange-600 bg-orange-50 text-orange-800 hover:bg-orange-100"
              )}
            >
              <PenLine className="size-3.5" />
              <span>{drawingMode ? "Desenhando Área..." : "Delimitar Área"}</span>
            </button>
          </div>
        </div>

        {/* Instrução visual durante o modo de desenho */}
        {drawingMode && (
          <div className="p-2.5 border border-orange-400 bg-orange-50 text-orange-950 text-xs font-bold flex items-center justify-between">
            <span>
              🖊️ <strong>Modo de Delimitação Ativo:</strong> Clique nos cantos do quarteirão/setor no mapa. Dê dois cliques para fechar a área e salvar.
            </span>
            <button
              onClick={() => setDrawingMode(false)}
              className="text-xs font-black underline hover:opacity-80"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Mapa Interativo */}
      <div className="border border-border bg-card">
        <ClientOnly
          fallback={
            <div className="flex h-[68vh] w-full items-center justify-center bg-muted/20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="flex h-[68vh] w-full items-center justify-center bg-muted/20">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <MapView
              center={CAMOCIM_CENTER}
              zoom={16}
              points={filteredPoints}
              zones={zonesForMap}
              buildings={buildingFootprints}
              onZoneCreated={(geojson, nome) => {
                setPendingZone({ geojson, nome });
                setNewZoneName(nome);
                setDrawingMode(false);
              }}
              drawingMode={drawingMode}
              className="h-[68vh] w-full"
            />
          </Suspense>
        </ClientOnly>
      </div>

      {/* Modal / Painel para Salvar Nova Zona Delimitada */}
      {pendingZone && (
        <div className="border border-foreground bg-card p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-black uppercase text-foreground">
              Salvar Área Delimitada para Equipe
            </h3>
            <button onClick={() => setPendingZone(null)}>
              <X className="size-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Nome da Área</label>
              <input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Ex: Quarteirão 1, Setor A..."
                className="w-full border border-border bg-background px-3 py-1.5 text-xs font-bold focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Equipe Responsável</label>
              <select
                value={newZoneEquipeId}
                onChange={(e) => setNewZoneEquipeId(e.target.value)}
                className="w-full border border-border bg-background px-3 py-1.5 text-xs font-bold focus:outline-none"
              >
                <option value="">Sem equipe vinculada</option>
                {equipes.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Cor da Área</label>
              <div className="flex items-center gap-1.5 pt-1">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewZoneColor(c)}
                    className={cn(
                      "size-6 border-2 transition-transform",
                      newZoneColor === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setPendingZone(null)}
              className="text-xs uppercase font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                saveZone.mutate({
                  geojson: pendingZone.geojson,
                  nome: newZoneName.trim() || "Área sem nome",
                  cor: newZoneColor,
                  equipe_id: newZoneEquipeId || undefined,
                })
              }
              disabled={saveZone.isPending}
              className="text-xs uppercase font-black"
            >
              {saveZone.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              Confirmar e Salvar Área
            </Button>
          </div>
        </div>
      )}

      {/* Lista de Zonas Delimitadas */}
      {zonas.length > 0 && (
        <div className="border border-border bg-card">
          <div className="p-2.5 border-b bg-muted/20 flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase">
              Áreas / Zonas de Equipes Cadastradas ({zonas.length})
            </span>
          </div>

          <div className="divide-y divide-border">
            {zonas.map((z) => (
              <div key={z.id} className="p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="size-3 border border-foreground/30" style={{ backgroundColor: z.cor }} />
                  <span className="font-bold">{z.nome}</span>
                  {z.equipes && (
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">
                      — {z.equipes.nome}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (window.confirm(`Deseja remover a área "${z.nome}"?`)) {
                      deleteZone.mutate(z.id);
                    }
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Excluir área"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
