import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPinned, Table, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel | Pesquisa Eleitoral por Bairro" },
      {
        name: "description",
        content:
          "Painel com total de imóveis, pesquisados, pendentes, indecisos e não encontrados da pesquisa eleitoral.",
      },
      { property: "og:title", content: "Painel | Pesquisa Eleitoral por Bairro" },
      {
        property: "og:description",
        content: "Acompanhe a pesquisa eleitoral por bairro, localidade, rua e imóvel.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Painel">
      <Dashboard />
    </AppShell>
  ),
});

async function contarSituacao(situacaoVal: string | null) {
  let q = supabase.from("imoveis").select("id", { count: "exact", head: true });
  if (situacaoVal === null) {
    q = q.is("situacao", null);
  } else {
    q = q.eq("situacao", situacaoVal);
  }
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function contarVoto(cargo: "voto_presidente" | "voto_governador" | "voto_senador", cand: string) {
  const { count, error } = await supabase
    .from("imoveis")
    .select("id", { count: "exact", head: true })
    .eq(cargo, cand);
  if (error) throw error;
  return count ?? 0;
}

function Dashboard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { count: total, error } = await supabase
        .from("imoveis")
        .select("id", { count: "exact", head: true });
      if (error) throw error;

      return {
        total: total ?? 0,
        pesquisados: await contarSituacao("regular"),
        fechadas: await contarSituacao("fechada"),
        desabitadas: await contarSituacao("desabitada"),
        pendentes: await contarSituacao(null),
        lula: await contarVoto("voto_presidente", "Lula"),
        flavio: await contarVoto("voto_presidente", "Flávio"),
        elmano: await contarVoto("voto_governador", "Elmano"),
        ciro: await contarVoto("voto_governador", "Ciro"),
      };
    },
  });

  async function resetarBanco() {
    const confirm = window.confirm(
      "ATENÇÃO: Isso irá apagar permanentemente todos os imóveis, bairros, localidades, ruas, pesquisas e importações cadastradas. Deseja continuar?"
    );
    if (!confirm) return;

    try {
      const { error: err1 } = await supabase.from("bairros").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const { error: err2 } = await supabase.from("equipes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const { error: err3 } = await supabase.from("importacoes").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      if (err1 || err2 || err3) {
        throw err1 || err2 || err3;
      }

      toast.success("Banco de dados limpo com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao limpar dados: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    }
  }

  const cards = [
    { label: "Total de Imóveis", value: data?.total, color: "text-foreground", spanFull: true },
    { label: "Pesquisados", value: data?.pesquisados, color: "text-emerald-700" },
    { label: "Pendentes", value: data?.pendentes, color: "text-amber-600" },
    { label: "Fechadas", value: data?.fechadas, color: "text-slate-500" },
    { label: "Desabitadas", value: data?.desabitadas, color: "text-blue-600" },
  ];

  const atalhos = [
    { to: "/planilha", label: "Digitar Pesquisa", icon: Table },
    { to: "/mapa", label: "Ver no Mapa", icon: MapPinned },
  ] as const;

  return (
    <div className="space-y-0">
      {/* Contadores — grade quadrada estilo PEC */}
      <div className="grid grid-cols-2 border-l border-t">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`border-r border-b bg-card p-4 ${c.spanFull ? "col-span-2" : ""}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {c.label}
            </p>
            <p className={`mt-1 text-4xl font-bold tabular-nums leading-none ${c.color}`}>
              {isLoading ? "—" : (c.value ?? 0)}
            </p>
          </div>
        ))}
      </div>

      {/* Atalhos quadrados estilo PEC */}
      <div className="grid grid-cols-2 border-l border-t">
        {atalhos.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center justify-center gap-2 border-r border-b bg-card p-6 text-center text-foreground transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <Icon className="size-8 text-primary" strokeWidth={1.5} />
            <span className="text-[13px] font-semibold">{label}</span>
          </Link>
        ))}
      </div>

      {/* Resultado Parcial */}
      {!isLoading && data && data.total > 0 && (
        <div className="border-l border-r border-b bg-card">
          <p className="border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Resultado Parcial
          </p>
          <div className="divide-y">
            <CandidatoBloco
              titulo="Presidente"
              candidatos={[
                { label: "Lula", votes: data.lula, color: "bg-red-500" },
                { label: "Flávio", votes: data.flavio, color: "bg-blue-500" },
              ]}
              total={data.pesquisados}
            />
            <CandidatoBloco
              titulo="Governador"
              candidatos={[
                { label: "Elmano", votes: data.elmano, color: "bg-emerald-600" },
                { label: "Ciro", votes: data.ciro, color: "bg-orange-500" },
              ]}
              total={data.pesquisados}
            />
          </div>
        </div>
      )}

      {/* Botão de Reset */}
      <div className="border-l border-r border-b">
        <button
          onClick={resetarBanco}
          className="flex w-full items-center justify-center gap-2 border-0 bg-transparent px-4 py-3 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/5 active:bg-destructive/10 cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          Zerar todos os dados
        </button>
      </div>
    </div>
  );
}

function CandidatoBloco({
  titulo,
  candidatos,
  total,
}: {
  titulo: string;
  candidatos: { label: string; votes: number; color: string }[];
  total: number;
}) {
  return (
    <div className="px-4 py-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <div className="space-y-1.5">
        {candidatos.map((c) => {
          const percent = total > 0 ? Math.round((c.votes / total) * 100) : 0;
          return (
            <div key={c.label} className="space-y-0.5 text-xs">
              <div className="flex justify-between font-medium">
                <span>{c.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {c.votes} ({percent}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden bg-muted">
                <div className={`${c.color} h-full transition-all`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

