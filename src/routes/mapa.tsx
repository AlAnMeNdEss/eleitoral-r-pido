import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { RESULTADOS, resultadoLabel } from "@/lib/constants";
import type { MapPoint } from "@/components/MapView";

const MapView = lazy(() => import("@/components/MapView").then((m) => ({ default: m.MapView })));

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa | Pesquisa Eleitoral" },
      { name: "description", content: "Veja no mapa os imóveis pesquisados e pendentes." },
      { property: "og:title", content: "Mapa | Pesquisa Eleitoral" },
      { property: "og:description", content: "Imóveis geolocalizados da pesquisa eleitoral." },
    ],
  }),
  component: () => (
    <AppShell title="Mapa">
      <Mapa />
    </AppShell>
  ),
});

const CORES: Record<string, string> = {
  apoia: "#2e9e6b",
  nao_apoia: "#d1495b",
  indeciso: "#e6a417",
  nao_respondeu: "#6f7fb0",
  nao_encontrado: "#7b8794",
  pendente: "#9aa5b1",
};

function Mapa() {
  const { data, isLoading } = useQuery({
    queryKey: ["mapa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select("id, numero, latitude, longitude, resultado_atual, ruas!inner(nome)")
        .not("latitude", "is", null)
        .limit(1000);
      if (error) throw error;
      return (data as unknown as Array<{
        id: string;
        numero: string;
        latitude: number;
        longitude: number;
        resultado_atual: string | null;
        ruas: { nome: string };
      }>).map<MapPoint>((i) => ({
        id: i.id,
        lat: i.latitude,
        lng: i.longitude,
        titulo: `${i.ruas.nome}, ${i.numero} — ${resultadoLabel(i.resultado_atual)}`,
        cor: CORES[i.resultado_atual ?? "pendente"] ?? CORES["pendente"]!,
      }));
    },
  });

  return (
    <div className="space-y-3">
      <ClientOnly fallback={<div className="h-[60vh] w-full animate-pulse rounded-xl bg-muted" />}>
        <Suspense fallback={<div className="h-[60vh] w-full animate-pulse rounded-xl bg-muted" />}>
          <MapView points={data ?? []} />
        </Suspense>
      </ClientOnly>
      <div className="flex flex-wrap gap-2 text-xs">
        {RESULTADOS.map((r) => (
          <span key={r.value} className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: CORES[r.value] }} />
            {r.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {isLoading ? "Carregando imóveis..." : `${data?.length ?? 0} imóveis com localização.`}
      </p>
    </div>
  );
}
