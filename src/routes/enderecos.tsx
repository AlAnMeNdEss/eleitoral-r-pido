import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ImovelItem, type ImovelRow } from "./buscar";

export const Route = createFileRoute("/enderecos")({
  head: () => ({
    meta: [
      { title: "Endereços | Pesquisa Eleitoral" },
      {
        name: "description",
        content: "Navegue por bairro, localidade e rua e veja todos os imóveis cadastrados.",
      },
      { property: "og:title", content: "Endereços | Pesquisa Eleitoral" },
      { property: "og:description", content: "Bairro, localidade, rua e imóveis organizados." },
    ],
  }),
  component: () => (
    <AppShell title="Endereços">
      <Enderecos />
    </AppShell>
  ),
});

type Nivel =
  | { tipo: "bairros" }
  | { tipo: "localidades"; bairro: { id: string; nome: string } }
  | { tipo: "ruas"; bairro: { id: string; nome: string }; localidade: { id: string; nome: string } }
  | {
      tipo: "imoveis";
      bairro: { id: string; nome: string };
      localidade: { id: string; nome: string };
      rua: { id: string; nome: string };
    };

function Enderecos() {
  const [nivel, setNivel] = useState<Nivel>({ tipo: "bairros" });
  const qc = useQueryClient();
  const [novoNumero, setNovoNumero] = useState("");
  const [novoComp, setNovoComp] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["enderecos", nivel],
    queryFn: async () => {
      if (nivel.tipo === "bairros") {
        const { data, error } = await supabase.from("bairros").select("id, nome").order("nome");
        if (error) throw error;
        return data;
      }
      if (nivel.tipo === "localidades") {
        const { data, error } = await supabase
          .from("localidades")
          .select("id, nome")
          .eq("bairro_id", nivel.bairro.id)
          .order("nome");
        if (error) throw error;
        return data;
      }
      if (nivel.tipo === "ruas") {
        const { data, error } = await supabase
          .from("ruas")
          .select("id, nome")
          .eq("localidade_id", nivel.localidade.id)
          .order("nome");
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("imoveis")
        .select(
          "id, numero, complemento, resultado_atual, nome_morador, situacao, voto_presidente, ruas!inner(nome, localidades!inner(nome, bairros!inner(nome)))",
        )
        .eq("rua_id", nivel.rua.id)
        .order("numero");
      if (error) throw error;
      return data as unknown as ImovelRow[];
    },
  });

  async function adicionarNumero() {
    if (nivel.tipo !== "imoveis" || !novoNumero.trim()) return;
    const { error } = await supabase.rpc("upsert_imovel", {
      p_bairro: nivel.bairro.nome,
      p_localidade: nivel.localidade.nome,
      p_rua: nivel.rua.nome,
      p_numero: novoNumero.trim(),
      p_complemento: novoComp.trim(),
    });
    if (error) return toast.error(error.message);
    setNovoNumero("");
    setNovoComp("");
    toast.success("Número cadastrado");
    qc.invalidateQueries({ queryKey: ["enderecos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const trilha =
    nivel.tipo === "bairros"
      ? "Bairros"
      : nivel.tipo === "localidades"
        ? nivel.bairro.nome
        : nivel.tipo === "ruas"
          ? `${nivel.bairro.nome} · ${nivel.localidade.nome || "Sem localidade"}`
          : `${nivel.rua.nome}`;

  function voltar() {
    if (nivel.tipo === "localidades") setNivel({ tipo: "bairros" });
    else if (nivel.tipo === "ruas") setNivel({ tipo: "localidades", bairro: nivel.bairro });
    else if (nivel.tipo === "imoveis")
      setNivel({ tipo: "ruas", bairro: nivel.bairro, localidade: nivel.localidade });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {nivel.tipo !== "bairros" && (
          <Button variant="outline" size="icon" onClick={voltar} aria-label="Voltar">
            <ChevronLeft className="size-5" />
          </Button>
        )}
        <p className="truncate text-sm font-semibold text-muted-foreground">{trilha}</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {nivel.tipo === "imoveis" ? (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="Novo número"
              value={novoNumero}
              onChange={(e) => setNovoNumero(e.target.value)}
              className="h-12"
            />
            <Input
              placeholder="Compl."
              value={novoComp}
              onChange={(e) => setNovoComp(e.target.value)}
              className="h-12 w-28"
            />
            <Button onClick={adicionarNumero} className="h-12" aria-label="Adicionar número">
              <Plus className="size-5" />
            </Button>
          </div>
          <ul className="space-y-2">
            {((data ?? []) as ImovelRow[]).map((i) => (
              <li key={i.id}>
                <ImovelItem imovel={i} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul className="space-y-2">
          {((data ?? []) as Array<{ id: string; nome: string }>).map((item) => (
            <li key={item.id}>
              <button
                onClick={() => {
                  if (nivel.tipo === "bairros") setNivel({ tipo: "localidades", bairro: item });
                  else if (nivel.tipo === "localidades")
                    setNivel({ tipo: "ruas", bairro: nivel.bairro, localidade: item });
                  else if (nivel.tipo === "ruas")
                    setNivel({
                      tipo: "imoveis",
                      bairro: nivel.bairro,
                      localidade: nivel.localidade,
                      rua: item,
                    });
                }}
                className="flex w-full items-center justify-between rounded-xl border bg-card p-4 text-left font-medium"
              >
                <span className="truncate">{item.nome || "Sem localidade"}</span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && (data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nada cadastrado aqui ainda.</p>
      )}
    </div>
  );
}
