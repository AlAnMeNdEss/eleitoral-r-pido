import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronLeft, Save, MapPinCheck, History, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CANDIDATOS, SITUACOES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MapPoint } from "@/components/MapView";

const MapView = lazy(() => import("@/components/MapView").then((m) => ({ default: m.MapView })));

export const Route = createFileRoute("/imovel/$id")({
  head: () => ({
    meta: [
      { title: "Imóvel | Pesquisa Eleitoral" },
      { name: "description", content: "Detalhe do imóvel, edição de pesquisa e localização no mapa." },
      { property: "og:title", content: "Imóvel | Pesquisa Eleitoral" },
      { property: "og:description", content: "Visualize e edite a pesquisa de um imóvel." },
    ],
  }),
  component: () => (
    <AppShell title="Imóvel">
      <ImovelDetalhe />
    </AppShell>
  ),
});

type ImovelFull = {
  id: string;
  numero: string;
  complemento: string;
  latitude: number | null;
  longitude: number | null;
  resultado_atual: string | null;
  data_pesquisa: string | null;
  observacao: string | null;
  nome_morador: string | null;
  situacao: string | null;
  voto_estadual: string | null;
  voto_federal: string | null;
  voto_senador: string | null;
  voto_governador: string | null;
  voto_presidente: string | null;
  ruas: {
    nome: string;
    localidades: { nome: string; bairros: { nome: string } };
  };
  equipes: { nome: string } | null;
};

type PesquisaRow = {
  id: string;
  resultado: string | null;
  observacao: string | null;
  data_pesquisa: string;
  created_at: string;
  nome_morador: string | null;
  situacao: string | null;
  voto_estadual: string | null;
  voto_federal: string | null;
  voto_senador: string | null;
  voto_governador: string | null;
  voto_presidente: string | null;
  equipes: { nome: string } | null;
};

const CORES: Record<string, string> = {
  regular: "#2e9e6b",
  fechada: "#7b8794",
  desabitada: "#6f7fb0",
  pendente: "#9aa5b1",
};

function ImovelDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: imovel, isLoading } = useQuery({
    queryKey: ["imovel", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select(
          "id, numero, complemento, latitude, longitude, resultado_atual, data_pesquisa, observacao, nome_morador, situacao, voto_estadual, voto_federal, voto_senador, voto_governador, voto_presidente, ruas!inner(nome, localidades!inner(nome, bairros!inner(nome))), equipes(nome)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as ImovelFull;
    },
  });

  const { data: historico } = useQuery({
    queryKey: ["pesquisas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pesquisas")
        .select("id, resultado, observacao, data_pesquisa, created_at, nome_morador, situacao, voto_estadual, voto_federal, voto_senador, voto_governador, voto_presidente, equipes(nome)")
        .eq("imovel_id", id)
        .order("data_pesquisa", { ascending: false });
      if (error) throw error;
      return data as unknown as PesquisaRow[];
    },
  });

  const [nomeMorador, setNomeMorador] = useState("");
  const [situacao, setSituacao] = useState("regular");
  const [votoEstadual, setVotoEstadual] = useState("");
  const [votoFederal, setVotoFederal] = useState("");
  const [votoSenador, setVotoSenador] = useState("");
  const [votoGovernador, setVotoGovernador] = useState("");
  const [votoPresidente, setVotoPresidente] = useState("");
  const [observacao, setObservacao] = useState("");
  const [equipe, setEquipe] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [savingGeo, setSavingGeo] = useState(false);

  async function salvarPesquisa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.rpc("upsert_imovel", {
        p_bairro: imovel!.ruas.localidades.bairros.nome,
        p_localidade: imovel!.ruas.localidades.nome,
        p_rua: imovel!.ruas.nome,
        p_numero: imovel!.numero,
        p_complemento: imovel!.complemento,
        p_resultado: null,
        p_observacao: observacao || null,
        p_data: data,
        p_equipe: equipe || null,
        p_nome_morador: nomeMorador || null,
        p_situacao: situacao,
        p_voto_estadual: situacao === "regular" ? votoEstadual || null : null,
        p_voto_federal: situacao === "regular" ? votoFederal || null : null,
        p_voto_senador: situacao === "regular" ? votoSenador || null : null,
        p_voto_governador: situacao === "regular" ? votoGovernador || null : null,
        p_voto_presidente: situacao === "regular" ? votoPresidente || null : null,
      });
      if (error) throw error;
      toast.success("Pesquisa registrada");
      setNomeMorador("");
      setVotoEstadual("");
      setVotoFederal("");
      setVotoSenador("");
      setVotoGovernador("");
      setVotoPresidente("");
      setSituacao("regular");
      setObservacao("");
      setEquipe("");
      invalidar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar pesquisa");
    } finally {
      setBusy(false);
    }
  }

  async function salvarCoordenada(lat: number, lng: number) {
    setSavingGeo(true);
    try {
      const { error } = await supabase
        .from("imoveis")
        .update({ latitude: lat, longitude: lng })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Localização salva (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      invalidar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar localização");
    } finally {
      setSavingGeo(false);
    }
  }

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["imovel", id] });
    qc.invalidateQueries({ queryKey: ["pesquisas", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["mapa"] });
    qc.invalidateQueries({ queryKey: ["buscar"] });
    qc.invalidateQueries({ queryKey: ["enderecos"] });
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando imóvel...</p>;
  }

  if (!imovel) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">Imóvel não encontrado.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          Voltar ao painel
        </Button>
      </div>
    );
  }

  const enderecoCompleto = [
    imovel.ruas.nome,
    imovel.numero,
    imovel.complemento && `- ${imovel.complemento}`,
  ]
    .filter(Boolean)
    .join(", ");

  const bairroStr = [
    imovel.ruas.localidades.bairros.nome,
    imovel.ruas.localidades.nome && imovel.ruas.localidades.nome,
  ]
    .filter(Boolean)
    .join(" · ");

  const mapPoints: MapPoint[] =
    imovel.latitude && imovel.longitude
      ? [
          {
            id: imovel.id,
            lat: imovel.latitude,
            lng: imovel.longitude,
            titulo: `${enderecoCompleto} — ${imovel.situacao === 'fechada' ? 'FECH' : imovel.situacao === 'desabitada' ? 'DESAB' : 'Regular'}`,
            cor: CORES[imovel.situacao ?? "pendente"] ?? CORES["pendente"]!,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      {/* Header com voltar */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate({ to: "/buscar" })}
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{enderecoCompleto}</h2>
          <p className="truncate text-xs text-muted-foreground">{bairroStr}</p>
        </div>
      </div>

      {/* Status atual */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white",
              imovel.situacao === "fechada" ? "bg-nao-encontrado" :
              imovel.situacao === "desabitada" ? "bg-nao-respondeu" :
              imovel.situacao === "regular" ? "bg-apoia" : "bg-pendente"
            )}
          >
            {imovel.situacao === "fechada" ? "Casa Fechada (FECH)" :
             imovel.situacao === "desabitada" ? "Casa Desabitada (DESAB)" :
             imovel.situacao === "regular" ? "Pesquisa Respondida" : "Pendente"}
          </span>
          <div className="min-w-0 text-xs text-muted-foreground">
            {imovel.data_pesquisa && <p>Última visita em {imovel.data_pesquisa}</p>}
            {imovel.equipes?.nome && <p>Equipe: {imovel.equipes.nome}</p>}
          </div>
        </div>

        {imovel.situacao === "regular" && (
          <div className="border-t pt-3 mt-1 grid grid-cols-2 gap-3 text-sm">
            {imovel.nome_morador && (
              <div className="col-span-2">
                <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Morador</span>
                <span className="font-medium text-foreground">{imovel.nome_morador}</span>
              </div>
            )}
            {imovel.voto_presidente && (
              <div>
                <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Presidente</span>
                <span className="font-medium text-foreground">{imovel.voto_presidente}</span>
              </div>
            )}
            {imovel.voto_governador && (
              <div>
                <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Governador</span>
                <span className="font-medium text-foreground">{imovel.voto_governador}</span>
              </div>
            )}
            {imovel.voto_senador && (
              <div>
                <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Senador</span>
                <span className="font-medium text-foreground">{imovel.voto_senador}</span>
              </div>
            )}
            {imovel.voto_federal && (
              <div>
                <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Dep. Federal</span>
                <span className="font-medium text-foreground">{imovel.voto_federal}</span>
              </div>
            )}
            {imovel.voto_estadual && (
              <div>
                <span className="font-semibold text-[10px] text-muted-foreground block uppercase">Dep. Estadual</span>
                <span className="font-medium text-foreground">{imovel.voto_estadual}</span>
              </div>
            )}
          </div>
        )}
        {imovel.observacao && (
          <div className="border-t pt-2 mt-1 text-xs text-muted-foreground">
            <span className="font-semibold block">Observação:</span>
            {imovel.observacao}
          </div>
        )}
      </div>

      {/* Mapa com pick */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MapPinCheck className="size-4 text-muted-foreground" />
          <Label className="text-sm font-semibold">
            Localização
            {savingGeo && <span className="ml-2 text-xs text-muted-foreground">Salvando...</span>}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {imovel.latitude
            ? `${imovel.latitude.toFixed(5)}, ${imovel.longitude?.toFixed(5)} — clique no mapa para reposicionar`
            : "Clique no mapa para marcar a localização deste imóvel"}
        </p>
        <ClientOnly
          fallback={<div className="h-[40vh] w-full animate-pulse rounded-xl bg-muted" />}
        >
          <Suspense
            fallback={<div className="h-[40vh] w-full animate-pulse rounded-xl bg-muted" />}
          >
            <MapView
              points={mapPoints}
              center={
                imovel.latitude && imovel.longitude
                  ? [imovel.latitude, imovel.longitude]
                  : undefined
              }
              zoom={imovel.latitude ? 16 : 13}
              onPick={salvarCoordenada}
              className="h-[40vh] w-full rounded-xl border"
            />
          </Suspense>
        </ClientOnly>
      </div>

      {/* Formulário nova pesquisa */}
      <form onSubmit={salvarPesquisa} className="space-y-4 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Pencil className="size-4 text-muted-foreground" />
          <Label className="text-sm font-semibold">Registrar pesquisa</Label>
        </div>

        {/* Situação do imóvel */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Situação do Imóvel</Label>
          <div className="grid grid-cols-3 gap-2">
            {SITUACOES.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => setSituacao(s.value)}
                className={cn(
                  "rounded-xl border p-2 text-xs font-semibold transition-colors text-center flex items-center justify-center min-h-[44px]",
                  situacao === s.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {situacao === "regular" && (
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Morador</Label>
              <Input value={nomeMorador} onChange={(e) => setNomeMorador(e.target.value)} className="h-12" />
            </div>

            {/* President */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Presidente</Label>
              <div className="flex flex-wrap gap-2">
                {CANDIDATOS.presidente.map((cand) => (
                  <button
                    type="button"
                    key={cand}
                    onClick={() => setVotoPresidente(votoPresidente === cand ? "" : cand)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                      votoPresidente === cand
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-foreground",
                    )}
                  >
                    {cand}
                  </button>
                ))}
              </div>
            </div>

            {/* Governador */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Governador</Label>
              <div className="flex flex-wrap gap-2">
                {CANDIDATOS.governador.map((cand) => (
                  <button
                    type="button"
                    key={cand}
                    onClick={() => setVotoGovernador(votoGovernador === cand ? "" : cand)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                      votoGovernador === cand
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-foreground",
                    )}
                  >
                    {cand}
                  </button>
                ))}
              </div>
            </div>

            {/* Senador */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Senador</Label>
              <div className="flex flex-wrap gap-2">
                {CANDIDATOS.senador.map((cand) => (
                  <button
                    type="button"
                    key={cand}
                    onClick={() => setVotoSenador(votoSenador === cand ? "" : cand)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                      votoSenador === cand
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-foreground",
                    )}
                  >
                    {cand}
                  </button>
                ))}
              </div>
            </div>

            {/* Deputado Federal */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deputado Federal</Label>
              <div className="flex flex-wrap gap-2">
                {CANDIDATOS.federal.map((cand) => (
                  <button
                    type="button"
                    key={cand}
                    onClick={() => setVotoFederal(votoFederal === cand ? "" : cand)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                      votoFederal === cand
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-foreground",
                    )}
                  >
                    {cand}
                  </button>
                ))}
              </div>
            </div>

            {/* Deputado Estadual */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deputado Estadual</Label>
              <div className="flex flex-wrap gap-2">
                {CANDIDATOS.estadual.map((cand) => (
                  <button
                    type="button"
                    key={cand}
                    onClick={() => setVotoEstadual(votoEstadual === cand ? "" : cand)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                      votoEstadual === cand
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-foreground",
                    )}
                  >
                    {cand}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Data</Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Equipe</Label>
            <Input
              value={equipe}
              onChange={(e) => setEquipe(e.target.value)}
              placeholder="Nome da equipe"
              className="h-12"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observação</Label>
          <Textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Algo a anotar sobre esta visita?"
          />
        </div>

        <Button type="submit" disabled={busy} className="h-12 w-full text-base">
          <Save className="mr-2 size-4" />
          {busy ? "Salvando..." : "Salvar pesquisa"}
        </Button>
      </form>

      {/* Histórico */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <Label className="text-sm font-semibold">Histórico de visitas</Label>
        </div>

        {(!historico || historico.length === 0) && (
          <p className="text-sm text-muted-foreground">Nenhuma visita registrada ainda.</p>
        )}

        <ul className="space-y-2">
          {(historico ?? []).map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white",
                    p.situacao === "fechada" ? "bg-nao-encontrado" :
                    p.situacao === "desabitada" ? "bg-nao-respondeu" : "bg-apoia"
                  )}
                >
                  {p.situacao === "fechada" ? "FECH" : p.situacao === "desabitada" ? "DESAB" : "Regular"}
                </span>
                <span className="text-xs font-medium text-foreground">{p.data_pesquisa}</span>
                {p.equipes?.nome && <span className="text-xs text-muted-foreground ml-auto">Equipe: {p.equipes.nome}</span>}
              </div>

              {p.situacao === "regular" && (
                <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground border-t pt-2 mt-1">
                  {p.nome_morador && <p className="col-span-2 text-foreground font-medium text-xs">Morador: {p.nome_morador}</p>}
                  {p.voto_presidente && <p>Pres: <span className="text-foreground font-medium">{p.voto_presidente}</span></p>}
                  {p.voto_governador && <p>Gov: <span className="text-foreground font-medium">{p.voto_governador}</span></p>}
                  {p.voto_senador && <p>Sen: <span className="text-foreground font-medium">{p.voto_senador}</span></p>}
                  {p.voto_federal && <p>Fed: <span className="text-foreground font-medium">{p.voto_federal}</span></p>}
                  {p.voto_estadual && <p>Est: <span className="text-foreground font-medium">{p.voto_estadual}</span></p>}
                </div>
              )}
              {p.observacao && <p className="text-xs text-muted-foreground italic mt-1 border-t pt-1.5">Obs: {p.observacao}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
