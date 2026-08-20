import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { resultadoColor, resultadoLabel } from "@/lib/constants";

export const Route = createFileRoute("/buscar")({
  head: () => ({
    meta: [
      { title: "Buscar endereço | Pesquisa Eleitoral" },
      {
        name: "description",
        content: "Busque rapidamente um imóvel por bairro, rua ou número e edite a pesquisa.",
      },
      { property: "og:title", content: "Buscar endereço | Pesquisa Eleitoral" },
      { property: "og:description", content: "Busca rápida de imóveis por bairro, rua e número." },
    ],
  }),
  component: () => (
    <AppShell title="Buscar">
      <Buscar />
    </AppShell>
  ),
});

export type ImovelRow = {
  id: string;
  numero: string;
  complemento: string;
  resultado_atual: string | null;
  nome_morador: string | null;
  situacao: string | null;
  voto_presidente: string | null;
  ruas: { nome: string; localidades: { nome: string; bairros: { nome: string } } };
};

const SELECT = "id, numero, complemento, resultado_atual, nome_morador, situacao, voto_presidente, ruas!inner(nome, localidades!inner(nome, bairros!inner(nome)))";

function Buscar() {
  const [termo, setTermo] = useState("");
  const q = termo.trim();

  const { data, isFetching } = useQuery({
    queryKey: ["buscar", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const like = `%${q}%`;
      const [porRua, porBairro, porNumero] = await Promise.all([
        supabase.from("imoveis").select(SELECT).ilike("ruas.nome", like).limit(30),
        supabase.from("imoveis").select(SELECT).ilike("ruas.localidades.bairros.nome", like).limit(30),
        supabase.from("imoveis").select(SELECT).ilike("numero", like).limit(30),
      ]);
      const all = [
        ...(porRua.data ?? []),
        ...(porBairro.data ?? []),
        ...(porNumero.data ?? []),
      ] as unknown as ImovelRow[];
      const seen = new Set<string>();
      return all.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))).slice(0, 50);
    },
  });

  return (
    <div className="space-y-4">
      <Input
        autoFocus
        placeholder="Bairro, rua ou número"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        className="h-14 text-base"
      />
      {q.length < 2 && (
        <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres.</p>
      )}
      {isFetching && <p className="text-sm text-muted-foreground">Buscando...</p>}
      <ul className="space-y-2">
        {(data ?? []).map((i) => (
          <li key={i.id}>
            <ImovelItem imovel={i} />
          </li>
        ))}
      </ul>
      {q.length >= 2 && !isFetching && (data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>
      )}
    </div>
  );
}

export function ImovelItem({ imovel }: { imovel: ImovelRow }) {
  const getBadgeDetails = () => {
    if (imovel.situacao === "fechada") {
      return { label: "FECH", color: "bg-nao-encontrado" };
    }
    if (imovel.situacao === "desabitada") {
      return { label: "DESAB", color: "bg-nao-respondeu" };
    }
    if (imovel.situacao === "regular") {
      return { label: imovel.voto_presidente || "Votou", color: "bg-apoia" };
    }
    return { label: "Pendente", color: "bg-pendente" };
  };

  const badge = getBadgeDetails();

  return (
    <Link
      to="/imovel/$id"
      params={{ id: imovel.id }}
      className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 hover:bg-muted/10 transition-colors"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {imovel.ruas.nome}, {imovel.numero}
          {imovel.complemento ? ` - ${imovel.complemento}` : ""}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {imovel.nome_morador ? `${imovel.nome_morador} · ` : ""}
          {imovel.ruas.localidades.bairros.nome}
          {imovel.ruas.localidades.nome ? ` · ${imovel.ruas.localidades.nome}` : ""}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${badge.color}`}
      >
        {badge.label}
      </span>
    </Link>
  );
}
