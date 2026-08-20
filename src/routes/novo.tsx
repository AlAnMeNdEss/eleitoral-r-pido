import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CANDIDATOS, SITUACOES } from "@/lib/constants";
import { geocodeEndereco } from "@/lib/geocode.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/novo")({
  head: () => ({
    meta: [
      { title: "Novo imóvel | Pesquisa Eleitoral" },
      {
        name: "description",
        content: "Cadastre rapidamente um imóvel com bairro, localidade, rua, número e resultado.",
      },
      { property: "og:title", content: "Novo imóvel | Pesquisa Eleitoral" },
      { property: "og:description", content: "Cadastro rápido de imóvel e pesquisa." },
    ],
  }),
  component: () => (
    <AppShell title="Novo imóvel">
      <NovoImovel />
    </AppShell>
  ),
});

function NovoImovel() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    bairro: "",
    localidade: "",
    rua: "",
    numero: "",
    complemento: "",
    cidade: "",
    observacao: "",
    equipe: "",
    data: new Date().toISOString().slice(0, 10),
  });
  const [nomeMorador, setNomeMorador] = useState("");
  const [situacao, setSituacao] = useState<string>("regular");
  const [votoEstadual, setVotoEstadual] = useState("");
  const [votoFederal, setVotoFederal] = useState("");
  const [votoSenador, setVotoSenador] = useState("");
  const [votoGovernador, setVotoGovernador] = useState("");
  const [votoPresidente, setVotoPresidente] = useState("");
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function localizar() {
    if (!form.rua) return toast.error("Informe a rua primeiro");
    const r = await geocodeEndereco({
      data: {
        rua: form.rua,
        numero: form.numero,
        bairro: form.bairro,
        cidade: form.cidade,
      },
    });
    if (r.lat && r.lng) {
      setCoord({ lat: r.lat, lng: r.lng });
      toast.success("Localização encontrada");
    } else {
      toast.error(`${r.error ?? "Não encontrado"} — marque no mapa depois de salvar`);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let lat = coord?.lat ?? null;
      let lng = coord?.lng ?? null;
      if (lat === null) {
        const g = await geocodeEndereco({
          data: { rua: form.rua, numero: form.numero, bairro: form.bairro, cidade: form.cidade },
        });
        lat = g.lat;
        lng = g.lng;
      }
      const { data: resData, error } = await supabase.rpc("upsert_imovel", {
        p_bairro: form.bairro,
        p_localidade: form.localidade,
        p_rua: form.rua,
        p_numero: form.numero || "S/N",
        p_complemento: form.complemento,
        p_resultado: null,
        p_observacao: form.observacao || null,
        p_data: form.data,
        p_equipe: form.equipe || null,
        p_latitude: lat,
        p_longitude: lng,
        p_nome_morador: nomeMorador || null,
        p_situacao: situacao,
        p_voto_estadual: situacao === "regular" ? votoEstadual || null : null,
        p_voto_federal: situacao === "regular" ? votoFederal || null : null,
        p_voto_senador: situacao === "regular" ? votoSenador || null : null,
        p_voto_governador: situacao === "regular" ? votoGovernador || null : null,
        p_voto_presidente: situacao === "regular" ? votoPresidente || null : null,
      });
      if (error) throw error;
      const res = resData as unknown as { imovel_id: string; criado: boolean };
      toast.success(res.criado ? "Imóvel cadastrado" : "Imóvel já existia — pesquisa atualizada");
      navigate({ to: "/imovel/$id", params: { id: res.imovel_id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo label="Bairro *">
        <Input required value={form.bairro} onChange={set("bairro")} className="h-12" />
      </Campo>
      <Campo label="Localidade">
        <Input value={form.localidade} onChange={set("localidade")} className="h-12" />
      </Campo>
      <Campo label="Rua *">
        <Input required value={form.rua} onChange={set("rua")} className="h-12" />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Número">
          <Input value={form.numero} onChange={set("numero")} className="h-12" />
        </Campo>
        <Campo label="Complemento">
          <Input value={form.complemento} onChange={set("complemento")} className="h-12" />
        </Campo>
      </div>
      <Campo label="Cidade (ajuda a localizar no mapa)">
        <Input value={form.cidade} onChange={set("cidade")} className="h-12" />
      </Campo>

      {/* Situação do imóvel */}
      <div className="space-y-1.5">
        <Label>Situação do Imóvel</Label>
        <div className="grid grid-cols-3 gap-2">
          {SITUACOES.map((s) => (
            <button
              type="button"
              key={s.value}
              onClick={() => setSituacao(s.value)}
              className={cn(
                "rounded-xl border p-3 text-xs font-semibold transition-colors text-center flex items-center justify-center min-h-[50px]",
                situacao === s.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {situacao === "regular" && (
        <div className="space-y-4 border-t pt-4">
          <Campo label="Nome do Morador">
            <Input value={nomeMorador} onChange={(e) => setNomeMorador(e.target.value)} className="h-12" />
          </Campo>

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
                      : "bg-card text-foreground",
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
                      : "bg-card text-foreground",
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
                      : "bg-card text-foreground",
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
                      : "bg-card text-foreground",
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
                      : "bg-card text-foreground",
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
        <Campo label="Data">
          <Input type="date" value={form.data} onChange={set("data")} className="h-12" />
        </Campo>
        <Campo label="Equipe">
          <Input value={form.equipe} onChange={set("equipe")} className="h-12" />
        </Campo>
      </div>
      <Campo label="Observação">
        <Textarea value={form.observacao} onChange={set("observacao")} rows={3} />
      </Campo>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={localizar} className="h-12 flex-1">
          <MapPin className="mr-2 size-4" /> Localizar no mapa
        </Button>
        {coord && (
          <span className="text-xs text-muted-foreground">
            {coord.lat.toFixed(5)}, {coord.lng.toFixed(5)}
          </span>
        )}
      </div>

      <Button type="submit" disabled={busy} className="h-14 w-full text-base">
        {busy ? "Salvando..." : "Salvar imóvel"}
      </Button>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
