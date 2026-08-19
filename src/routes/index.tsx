import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, MapPinned, PlusCircle, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

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

async function contar(filtro?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const q = filtro ? filtro(base()) : base();
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
const base = () => supabase.from("imoveis").select("id", { count: "exact", head: true });

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => ({
      total: await contar(),
      pesquisados: await contar((q) => q.not("resultado_atual", "is", null)),
      pendentes: await contar((q) => q.is("resultado_atual", null)),
      indecisos: await contar((q) => q.eq("resultado_atual", "indeciso")),
      naoEncontrados: await contar((q) => q.eq("resultado_atual", "nao_encontrado")),
    }),
  });

  const cards = [
    { label: "Total de imóveis", value: data?.total, cls: "text-foreground" },
    { label: "Pesquisados", value: data?.pesquisados, cls: "text-apoia" },
    { label: "Pendentes", value: data?.pendentes, cls: "text-muted-foreground" },
    { label: "Indecisos", value: data?.indecisos, cls: "text-indeciso" },
    { label: "Não encontrados", value: data?.naoEncontrados, cls: "text-nao-encontrado" },
  ];

  const atalhos = [
    { to: "/importar", label: "Importar planilha", icon: FileSpreadsheet },
    { to: "/novo", label: "Novo imóvel", icon: PlusCircle },
    { to: "/buscar", label: "Pesquisar endereço", icon: Search },
    { to: "/mapa", label: "Mapa", icon: MapPinned },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className={`rounded-2xl border bg-card p-4 ${i === 0 ? "col-span-2" : ""}`}
          >
            <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${c.cls}`}>
              {isLoading ? "—" : (c.value ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {atalhos.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-24 flex-col items-start justify-between rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
          >
            <Icon className="size-7" />
            <span className="text-sm font-semibold leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
