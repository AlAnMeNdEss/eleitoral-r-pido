import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  Check,
  ChevronRight,
  User,
  LayoutGrid,
  Table as TableIcon,
  Home,
  DoorClosed,
  Building,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planilha")({
  head: () => ({
    meta: [
      { title: "Pesquisa | Digitação da Folha 2026" },
      {
        name: "description",
        content: "Digitação interativa e rápida dos dados da pesquisa eleitoral 2026.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Pesquisa Eleitoral">
      <DigitarPlanilha />
    </AppShell>
  ),
});

type Imovel = {
  id: string;
  numero: string;
  complemento: string;
  nome_morador: string | null;
  situacao: string | null;
  voto_estadual: string | null;
  voto_federal: string | null;
  voto_senador: string | null;
  voto_governador: string | null;
  voto_presidente: string | null;
};

// Candidatos com perfis, cores de campanha e avatares visuais
const CANDIDATOS_CONFIG = {
  presidente: [
    { nome: "LULA", cargo: "Presidente", cor: "#ef4444", sigla: "PT", avatar: "🔴" },
    { nome: "FLÁVIO", cargo: "Presidente", cor: "#2563eb", sigla: "PL", avatar: "🔵" },
    { nome: "INDECISO", cargo: "Presidente", cor: "#64748b", sigla: "—", avatar: "⚪" },
  ],
  governador: [
    { nome: "ELMANO", cargo: "Governador", cor: "#059669", sigla: "PT", avatar: "🟢" },
    { nome: "CIRO", cargo: "Governador", cor: "#ea580c", sigla: "PDT", avatar: "🟠" },
    { nome: "INDECISO", cargo: "Governador", cor: "#64748b", sigla: "—", avatar: "⚪" },
  ],
  senador: [
    { nome: "CID GOMES", cargo: "Senador", cor: "#7c3aed", sigla: "PSB", avatar: "🟣" },
    { nome: "LUIZIANE", cargo: "Senadora", cor: "#e11d48", sigla: "PT", avatar: "🔴" },
    { nome: "CAP. WAGNER", cargo: "Senador", cor: "#1e40af", sigla: "UNIÃO", avatar: "🔵" },
    { nome: "ALCIDES", cargo: "Senador", cor: "#0891b2", sigla: "PL", avatar: "🌐" },
    { nome: "INDECISO", cargo: "Senador", cor: "#64748b", sigla: "—", avatar: "⚪" },
  ],
  federal: [
    { nome: "ROGER", cargo: "Dep. Federal", cor: "#0284c7", sigla: "DEP", avatar: "🔷" },
    { nome: "TAYNA", cargo: "Dep. Federal", cor: "#10b981", sigla: "DEP", avatar: "🟩" },
    { nome: "INDECISO", cargo: "Dep. Federal", cor: "#64748b", sigla: "—", avatar: "⚪" },
    { nome: "OUTRO", cargo: "Dep. Federal", cor: "#475569", sigla: "—", avatar: "⬛" },
  ],
  estadual: [
    { nome: "SÉRGIO", cargo: "Dep. Estadual", cor: "#d97706", sigla: "DEP", avatar: "🟡" },
    { nome: "ROMEU", cargo: "Dep. Estadual", cor: "#15803d", sigla: "DEP", avatar: "🟢" },
    { nome: "EUVALDETE", cargo: "Dep. Estadual", cor: "#9333ea", sigla: "DEP", avatar: "🟣" },
    { nome: "INDECISO", cargo: "Dep. Estadual", cor: "#64748b", sigla: "—", avatar: "⚪" },
    { nome: "OUTRO", cargo: "Dep. Estadual", cor: "#475569", sigla: "—", avatar: "⬛" },
  ],
} as const;

function DigitarPlanilha() {
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [area, setArea] = useState<string>("");
  const [bairroNome, setBairroNome] = useState<string>("Boa Esperança");
  const [ruaNome, setRuaNome] = useState<string>("Tv Zé Carioca");
  
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [loadingImoveis, setLoadingImoveis] = useState(false);
  const [savingStatus, setSavingStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  
  const [novoNumero, setNovoNumero] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [adicionandoCasa, setAdicionandoCasa] = useState(false);
  const [filtroNumero, setFiltroNumero] = useState("");

  const numInputRef = useRef<HTMLInputElement>(null);

  // Query Bairros
  const { data: bairros = [] } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ["bairros-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bairros").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Query Ruas do Bairro
  const { data: ruas = [] } = useQuery<{ id: string; nome: string; count?: number }[]>({
    queryKey: ["ruas-list", bairroNome],
    queryFn: async () => {
      if (!bairroNome) return [];
      const { data: bData } = await supabase
        .from("bairros")
        .select("id")
        .ilike("nome", bairroNome.trim())
        .maybeSingle();

      if (!bData) return [];

      const { data, error } = await supabase
        .from("ruas")
        .select("id, nome, localidades!inner(bairro_id)")
        .eq("localidades.bairro_id", bData.id)
        .order("nome");

      if (error) throw error;
      return data ?? [];
    },
  });

  // Carregar Imóveis da Rua Selecionada
  const carregarImoveis = async () => {
    if (!bairroNome.trim() || !ruaNome.trim()) {
      setImoveis([]);
      return;
    }

    setLoadingImoveis(true);
    try {
      const { data: bData } = await supabase
        .from("bairros")
        .select("id")
        .ilike("nome", bairroNome.trim())
        .maybeSingle();

      if (!bData) {
        setImoveis([]);
        return;
      }

      const { data: rData } = await supabase
        .from("ruas")
        .select("id, localidade_id, localidades!inner(bairro_id)")
        .ilike("nome", ruaNome.trim())
        .eq("localidades.bairro_id", bData.id);

      if (!rData || rData.length === 0) {
        setImoveis([]);
        return;
      }

      const ruaIds = rData.map((r) => r.id);

      const { data, error } = await supabase
        .from("imoveis")
        .select("id, numero, complemento, nome_morador, situacao, voto_estadual, voto_federal, voto_senador, voto_governador, voto_presidente")
        .in("rua_id", ruaIds);

      if (error) throw error;

      // Ordenação natural por número de casa
      const sorted = (data ?? []).sort((a, b) => {
        const numA = parseInt(a.numero.replace(/\D/g, ""), 10);
        const numB = parseInt(b.numero.replace(/\D/g, ""), 10);
        if (isNaN(numA) && isNaN(numB)) return a.numero.localeCompare(b.numero);
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        if (numA !== numB) return numA - numB;
        return (a.complemento || "").localeCompare(b.complemento || "");
      });

      setImoveis(sorted);
      if (sorted.length > 0 && !selectedHouseId) {
        setSelectedHouseId(sorted[0].id);
      }
    } catch (err) {
      console.error("Erro ao buscar imóveis:", err);
    } finally {
      setLoadingImoveis(false);
    }
  };

  useEffect(() => {
    carregarImoveis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bairroNome, ruaNome]);

  // Imóvel atualmente selecionado para edição rápida
  const selectedImovel = useMemo(() => {
    return imoveis.find((i) => i.id === selectedHouseId) || imoveis[0] || null;
  }, [imoveis, selectedHouseId]);

  // Salvar linha inteira no Supabase via upsert_imovel
  async function saveRow(imovelId: string, fieldsToUpdate: Partial<Imovel>) {
    const imovel = imoveis.find((i) => i.id === imovelId);
    if (!imovel) return;

    const fullImovel = { ...imovel, ...fieldsToUpdate };
    setSavingStatus((prev) => ({ ...prev, [imovelId]: "saving" }));

    try {
      const { error } = await supabase.rpc("upsert_imovel", {
        p_bairro: bairroNome.trim(),
        p_localidade: "",
        p_rua: ruaNome.trim(),
        p_numero: fullImovel.numero,
        p_complemento: fullImovel.complemento || "",
        p_resultado: null,
        p_observacao: null,
        p_data: new Date().toISOString().slice(0, 10),
        p_equipe: area.trim() || null,
        p_nome_morador: fullImovel.nome_morador || null,
        p_situacao: fullImovel.situacao,
        p_voto_estadual: fullImovel.voto_estadual,
        p_voto_federal: fullImovel.voto_federal,
        p_voto_senador: fullImovel.voto_senador,
        p_voto_governador: fullImovel.voto_governador,
        p_voto_presidente: fullImovel.voto_presidente,
      });

      if (error) throw error;

      setSavingStatus((prev) => ({ ...prev, [imovelId]: "saved" }));
      setTimeout(() => {
        setSavingStatus((prev) => (prev[imovelId] === "saved" ? { ...prev, [imovelId]: "idle" } : prev));
      }, 1500);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setSavingStatus((prev) => ({ ...prev, [imovelId]: "error" }));
      toast.error(`Erro ao salvar casa ${fullImovel.numero}: ${err instanceof Error ? err.message : "Erro"}`);
    }
  }

  // Alternar voto
  async function handleVoteClick(imovelId: string, cargo: keyof Imovel, value: string) {
    const imovel = imoveis.find((i) => i.id === imovelId);
    if (!imovel) return;

    const currentValue = imovel[cargo];
    const newValue = currentValue === value ? null : value;

    let newSituacao = imovel.situacao;
    if (newValue !== null && (imovel.situacao === "fechada" || imovel.situacao === "desabitada" || !imovel.situacao)) {
      newSituacao = "regular";
    }

    const updates = {
      [cargo]: newValue,
      situacao: newSituacao,
    };

    setImoveis((prev) => prev.map((i) => (i.id === imovelId ? { ...i, ...updates } : i)));
    await saveRow(imovelId, updates);
  }

  // Alternar situação FECH / DESAB
  async function handleSituacaoClick(imovelId: string, targetSituacao: "fechada" | "desabitada" | "regular") {
    const imovel = imoveis.find((i) => i.id === imovelId);
    if (!imovel) return;

    const currentSituacao = imovel.situacao;
    const newSituacao = currentSituacao === targetSituacao ? null : targetSituacao;

    const updates: Partial<Imovel> = { situacao: newSituacao };

    if (newSituacao === "fechada" || newSituacao === "desabitada") {
      updates.voto_estadual = null;
      updates.voto_federal = null;
      updates.voto_senador = null;
      updates.voto_governador = null;
      updates.voto_presidente = null;
    }

    setImoveis((prev) => prev.map((i) => (i.id === imovelId ? { ...i, ...updates } : i)));
    await saveRow(imovelId, updates);
  }

  // Adicionar nova casa
  async function handleAdicionarCasa(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!bairroNome.trim() || !ruaNome.trim() || !novoNumero.trim()) {
      toast.error("Informe o Bairro, Rua e Número da casa.");
      return;
    }

    setAdicionandoCasa(true);
    try {
      const { error } = await supabase.rpc("upsert_imovel", {
        p_bairro: bairroNome.trim(),
        p_localidade: "",
        p_rua: ruaNome.trim(),
        p_numero: novoNumero.trim(),
        p_complemento: "",
        p_nome_morador: novoNome.trim() || null,
        p_equipe: area.trim() || null,
        p_data: new Date().toISOString().slice(0, 10),
      });

      if (error) throw error;

      toast.success(`Casa ${novoNumero.trim()} cadastrada!`);
      setNovoNumero("");
      setNovoNome("");
      await carregarImoveis();

      setTimeout(() => {
        numInputRef.current?.focus();
      }, 100);
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setAdicionandoCasa(false);
    }
  }

  // Próxima casa
  function handleNextHouse() {
    if (!selectedImovel || imoveis.length === 0) return;
    const currentIndex = imoveis.findIndex((i) => i.id === selectedImovel.id);
    if (currentIndex < imoveis.length - 1) {
      setSelectedHouseId(imoveis[currentIndex + 1].id);
    } else {
      toast.info("Você chegou à última casa da rua.");
    }
  }

  // Casa anterior
  function handlePrevHouse() {
    if (!selectedImovel || imoveis.length === 0) return;
    const currentIndex = imoveis.findIndex((i) => i.id === selectedImovel.id);
    if (currentIndex > 0) {
      setSelectedHouseId(imoveis[currentIndex - 1].id);
    }
  }

  // Filtro de casas
  const imoveisFiltrados = useMemo(() => {
    if (!filtroNumero.trim()) return imoveis;
    return imoveis.filter(
      (i) =>
        i.numero.toLowerCase().includes(filtroNumero.toLowerCase()) ||
        (i.nome_morador && i.nome_morador.toLowerCase().includes(filtroNumero.toLowerCase()))
    );
  }, [imoveis, filtroNumero]);

  // Contadores da rua
  const stats = useMemo(() => {
    const total = imoveis.length;
    const pesquisadas = imoveis.filter((i) => i.situacao === "regular").length;
    const fechadas = imoveis.filter((i) => i.situacao === "fechada").length;
    const desabitadas = imoveis.filter((i) => i.situacao === "desabitada").length;
    const pendentes = imoveis.filter((i) => !i.situacao).length;
    return { total, pesquisadas, fechadas, desabitadas, pendentes };
  }, [imoveis]);

  return (
    <div className="space-y-3 font-sans pb-16">
      {/* Barra de Cabeçalho da Folha */}
      <div className="border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between border-b pb-2 mb-3 gap-2">
          <div className="flex items-center gap-2">
            <Link to="/" className="p-1.5 border border-border hover:bg-muted" title="Voltar ao início">
              <ChevronLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-sm font-extrabold tracking-wide uppercase">
                PESQUISA ELEITORAL 2026
              </h1>
              <p className="text-[11px] text-muted-foreground">
                {stats.total} casas na rua • {stats.pesquisadas} visitadas • {stats.pendentes} pendentes
              </p>
            </div>
          </div>

          {/* Alternador de Modo de Visualização */}
          <div className="flex items-center gap-1 border border-border p-0.5 bg-muted/20">
            <button
              onClick={() => setViewMode("card")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase transition-colors",
                viewMode === "card"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="size-3.5" />
              <span>Ficha Rápida</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase transition-colors",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <TableIcon className="size-3.5" />
              <span>Planilha</span>
            </button>
          </div>
        </div>

        {/* Inputs de Área, Bairro e Rua */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 bg-background">
            <span className="font-bold uppercase text-muted-foreground shrink-0 text-[11px]">ÁREA:</span>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Ex: Equipe 1"
              className="w-full bg-transparent font-semibold uppercase text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 bg-background">
            <span className="font-bold uppercase text-muted-foreground shrink-0 text-[11px]">BAIRRO:</span>
            <input
              type="text"
              list="bairros-datalist"
              value={bairroNome}
              onChange={(e) => setBairroNome(e.target.value)}
              placeholder="Digite o Bairro..."
              className="w-full bg-transparent font-semibold uppercase text-xs focus:outline-none"
            />
            <datalist id="bairros-datalist">
              {bairros.map((b) => (
                <option key={b.id} value={b.nome} />
              ))}
            </datalist>
          </div>

          <div className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 bg-background">
            <span className="font-bold uppercase text-muted-foreground shrink-0 text-[11px]">RUA:</span>
            <input
              type="text"
              list="ruas-datalist"
              value={ruaNome}
              onChange={(e) => setRuaNome(e.target.value)}
              placeholder="Digite ou escolha a Rua..."
              className="w-full bg-transparent font-semibold uppercase text-xs focus:outline-none"
            />
            <datalist id="ruas-datalist">
              {ruas.map((r) => (
                <option key={r.id} value={r.nome} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODO 1: FICHA RÁPIDA DE VOTAÇÃO COM FOTOS / CARDS DE CANDIDATOS            */}
      {/* ========================================================================= */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Coluna Lateral: Lista de Casas da Rua */}
          <div className="border border-border bg-card flex flex-col h-[520px]">
            <div className="p-2 border-b bg-muted/30 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold uppercase">
                <span>Casas da Rua ({imoveisFiltrados.length})</span>
                <span className="text-[10px] text-muted-foreground">Clique para abrir</span>
              </div>
              <div className="relative">
                <Search className="size-3.5 absolute left-2 top-2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar nº ou morador..."
                  value={filtroNumero}
                  onChange={(e) => setFiltroNumero(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 text-xs border border-border bg-background focus:outline-none"
                />
              </div>
            </div>

            {/* Lista com scroll */}
            <div className="flex-1 overflow-y-auto divide-y divide-border scrollbar-thin">
              {loadingImoveis ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mx-auto mb-1" />
                  Carregando casas...
                </div>
              ) : imoveisFiltrados.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Nenhuma casa cadastrada.
                </div>
              ) : (
                imoveisFiltrados.map((i) => {
                  const isSelected = selectedImovel?.id === i.id;
                  const isRegular = i.situacao === "regular";
                  const isFechada = i.situacao === "fechada";
                  const isDesab = i.situacao === "desabitada";

                  return (
                    <button
                      key={i.id}
                      onClick={() => setSelectedHouseId(i.id)}
                      className={cn(
                        "w-full text-left p-2.5 flex items-center justify-between text-xs transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[11px] font-bold border shrink-0",
                            isSelected
                              ? "bg-primary-foreground text-primary border-primary-foreground"
                              : isRegular
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : isFechada
                              ? "bg-slate-200 text-slate-700 border-slate-300"
                              : isDesab
                              ? "bg-blue-100 text-blue-800 border-blue-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          )}
                        >
                          Nº {i.numero}
                        </span>
                        <span className="truncate text-[11px]">
                          {i.nome_morador || <span className="opacity-50 italic">Sem nome</span>}
                        </span>
                      </div>

                      {/* Status indicator */}
                      <span className="shrink-0 text-[10px] uppercase font-bold opacity-80">
                        {isRegular ? "✓ Visitada" : isFechada ? "FECH" : isDesab ? "DESAB" : "Pendente"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Inserir nova casa rápida */}
            <form onSubmit={handleAdicionarCasa} className="p-2 border-t bg-muted/20 flex gap-1.5">
              <input
                ref={numInputRef}
                type="text"
                placeholder="Nº casa"
                value={novoNumero}
                onChange={(e) => setNovoNumero(e.target.value)}
                className="w-20 px-2 py-1 text-xs border border-border bg-background font-bold focus:outline-none"
              />
              <input
                type="text"
                placeholder="Morador..."
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-border bg-background focus:outline-none"
              />
              <button
                type="submit"
                disabled={adicionandoCasa || !novoNumero.trim()}
                className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold border border-primary shrink-0"
              >
                <Plus className="size-3.5" />
              </button>
            </form>
          </div>

          {/* Coluna Central / Painel de Votação da Casa */}
          <div className="lg:col-span-3 border border-border bg-card p-4 space-y-4">
            {selectedImovel ? (
              <>
                {/* Cabeçalho da Casa Ativa + Navegação */}
                <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary text-primary-foreground font-black text-xl px-3 py-1 border border-foreground shadow-sm">
                      Nº {selectedImovel.numero}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase">{ruaNome}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-foreground">
                          {selectedImovel.nome_morador || "Morador não informado"}
                        </span>
                        {savingStatus[selectedImovel.id] === "saving" && (
                          <span className="flex items-center gap-1 text-[10px] text-blue-600">
                            <Loader2 className="size-3 animate-spin" /> Salvando...
                          </span>
                        )}
                        {savingStatus[selectedImovel.id] === "saved" && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                            <CheckCircle2 className="size-3" /> Salvo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handlePrevHouse}
                      className="px-3 py-1.5 border border-border hover:bg-muted text-xs font-bold flex items-center gap-1"
                    >
                      <ChevronLeft className="size-3.5" /> Anterior
                    </button>
                    <button
                      onClick={handleNextHouse}
                      className="px-3 py-1.5 border border-border bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold flex items-center gap-1"
                    >
                      Próxima <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Edição do Nome do Morador */}
                <div className="border border-border p-2.5 bg-muted/10 flex items-center gap-2">
                  <User className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold uppercase text-muted-foreground shrink-0">Nome do Morador:</span>
                  <input
                    type="text"
                    defaultValue={selectedImovel.nome_morador || ""}
                    key={selectedImovel.id}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val !== (selectedImovel.nome_morador || "")) {
                        setImoveis((prev) =>
                          prev.map((im) => (im.id === selectedImovel.id ? { ...im, nome_morador: val } : im))
                        );
                        saveRow(selectedImovel.id, { nome_morador: val });
                      }
                    }}
                    placeholder="Digite o nome do eleitor pesquisado..."
                    className="w-full bg-background border border-border px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Seção 1: Situação da Casa (FECH / DESAB / Regular) */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    1. Situação da Casa
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSituacaoClick(selectedImovel.id, "regular")}
                      className={cn(
                        "p-2.5 border text-center transition-all flex items-center justify-center gap-2",
                        selectedImovel.situacao === "regular" || (!selectedImovel.situacao && (selectedImovel.voto_presidente || selectedImovel.voto_governador))
                          ? "border-emerald-600 bg-emerald-500 text-white font-extrabold shadow-sm"
                          : "border-border bg-card hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <Home className="size-4" />
                      <span className="text-xs">Aberta / Visitada</span>
                    </button>

                    <button
                      onClick={() => handleSituacaoClick(selectedImovel.id, "fechada")}
                      className={cn(
                        "p-2.5 border text-center transition-all flex items-center justify-center gap-2",
                        selectedImovel.situacao === "fechada"
                          ? "border-red-600 bg-red-600 text-white font-extrabold shadow-sm"
                          : "border-border bg-card hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <DoorClosed className="size-4" />
                      <span className="text-xs">Fechada (FECH)</span>
                    </button>

                    <button
                      onClick={() => handleSituacaoClick(selectedImovel.id, "desabitada")}
                      className={cn(
                        "p-2.5 border text-center transition-all flex items-center justify-center gap-2",
                        selectedImovel.situacao === "desabitada"
                          ? "border-blue-600 bg-blue-600 text-white font-extrabold shadow-sm"
                          : "border-border bg-card hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <Building className="size-4" />
                      <span className="text-xs">Desabitada (DESAB)</span>
                    </button>
                  </div>
                </div>

                {/* Se a casa estiver fechada ou desabitada, oculta os cargos */}
                {selectedImovel.situacao === "fechada" || selectedImovel.situacao === "desabitada" ? (
                  <div className="p-6 border border-dashed text-center text-muted-foreground bg-muted/10 space-y-1">
                    <p className="font-bold text-sm">
                      {selectedImovel.situacao === "fechada" ? "Casa Marcada como FECHADA" : "Casa Marcada como DESABITADA"}
                    </p>
                    <p className="text-xs">As opções de votos de candidatos ficam desabilitadas para esta casa.</p>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2 border-t">
                    {/* PRESIDENTE */}
                    <CandidateSection
                      title="Presidente"
                      candidates={CANDIDATOS_CONFIG.presidente}
                      selectedValue={selectedImovel.voto_presidente}
                      onSelect={(cand) => handleVoteClick(selectedImovel.id, "voto_presidente", cand)}
                    />

                    {/* GOVERNADOR */}
                    <CandidateSection
                      title="Governador"
                      candidates={CANDIDATOS_CONFIG.governador}
                      selectedValue={selectedImovel.voto_governador}
                      onSelect={(cand) => handleVoteClick(selectedImovel.id, "voto_governador", cand)}
                    />

                    {/* SENADOR */}
                    <CandidateSection
                      title="Senador"
                      candidates={CANDIDATOS_CONFIG.senador}
                      selectedValue={selectedImovel.voto_senador}
                      onSelect={(cand) => handleVoteClick(selectedImovel.id, "voto_senador", cand)}
                    />

                    {/* DEPUTADO FEDERAL */}
                    <CandidateSection
                      title="Deputado Federal"
                      candidates={CANDIDATOS_CONFIG.federal}
                      selectedValue={selectedImovel.voto_federal}
                      onSelect={(cand) => handleVoteClick(selectedImovel.id, "voto_federal", cand)}
                    />

                    {/* DEPUTADO ESTADUAL */}
                    <CandidateSection
                      title="Deputado Estadual"
                      candidates={CANDIDATOS_CONFIG.estadual}
                      selectedValue={selectedImovel.voto_estadual}
                      onSelect={(cand) => handleVoteClick(selectedImovel.id, "voto_estadual", cand)}
                    />
                  </div>
                )}

                {/* Botão de Avanço Rápido */}
                <div className="pt-4 border-t flex justify-end">
                  <button
                    onClick={handleNextHouse}
                    className="px-6 py-3 bg-primary text-primary-foreground font-black text-sm uppercase flex items-center gap-2 hover:opacity-90 active:scale-[0.99] border border-foreground shadow-md"
                  >
                    <span>Salvar e Ir para Próxima Casa</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-muted-foreground space-y-2">
                <FileSpreadsheet className="size-8 mx-auto stroke-1" />
                <p className="font-bold text-sm">Selecione uma casa na lista ao lado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 2: TABELA COMPLETA ESTILO PLANILHA COM X                             */}
      {/* ========================================================================= */}
      {viewMode === "table" && (
        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full border-collapse text-left border-spacing-0 text-[11px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-center font-bold uppercase tracking-wider text-[10px]">
                <th rowSpan={2} className="border-r border-border p-2 min-w-[70px] max-w-[80px] align-middle bg-muted/60 sticky left-0 z-20">
                  Nº DA CASA
                </th>
                <th rowSpan={2} className="border-r border-border p-2 min-w-[160px] max-w-[200px] text-left align-middle bg-muted/60 sticky left-[70px] z-20 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                  NOMES
                </th>
                <th colSpan={2} className="border-r border-border py-1 bg-slate-200/60">
                  CASAS
                </th>
                <th colSpan={5} className="border-r border-border py-1 bg-amber-100/70 text-amber-900">
                  DEPUTADO ESTADUAL
                </th>
                <th colSpan={4} className="border-r border-border py-1 bg-blue-100/70 text-blue-900">
                  DEPUTADO FEDERAL
                </th>
                <th colSpan={5} className="border-r border-border py-1 bg-purple-100/70 text-purple-900">
                  SENADOR
                </th>
                <th colSpan={3} className="border-r border-border py-1 bg-orange-100/70 text-orange-900">
                  GOVERNADOR
                </th>
                <th colSpan={3} className="border-r border-border py-1 bg-red-100/70 text-red-900">
                  PRESIDENTE
                </th>
                <th rowSpan={2} className="py-1 px-2 align-middle text-center w-12">
                  Status
                </th>
              </tr>

              <tr className="border-b border-border bg-muted/20 text-center font-bold text-[9px] uppercase whitespace-nowrap">
                <th className="border-r border-border py-1 px-1.5 min-w-[44px] bg-slate-100/60">FECH</th>
                <th className="border-r border-border py-1 px-1.5 min-w-[44px] bg-slate-100/60">DESAB</th>

                {CANDIDATOS_CONFIG.estadual.map((c) => (
                  <th key={`est-${c.nome}`} className="border-r border-border py-1 px-1 min-w-[62px] bg-amber-50">
                    {c.nome}
                  </th>
                ))}
                {CANDIDATOS_CONFIG.federal.map((c) => (
                  <th key={`fed-${c.nome}`} className="border-r border-border py-1 px-1 min-w-[62px] bg-blue-50">
                    {c.nome}
                  </th>
                ))}
                {CANDIDATOS_CONFIG.senador.map((c) => (
                  <th key={`sen-${c.nome}`} className="border-r border-border py-1 px-1 min-w-[70px] bg-purple-50">
                    {c.nome}
                  </th>
                ))}
                {CANDIDATOS_CONFIG.governador.map((c) => (
                  <th key={`gov-${c.nome}`} className="border-r border-border py-1 px-1 min-w-[62px] bg-orange-50">
                    {c.nome}
                  </th>
                ))}
                {CANDIDATOS_CONFIG.presidente.map((c) => (
                  <th key={`pre-${c.nome}`} className="border-r border-border py-1 px-1 min-w-[62px] bg-red-50">
                    {c.nome}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loadingImoveis ? (
                <tr>
                  <td colSpan={26} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2" />
                    Carregando casas da rua...
                  </td>
                </tr>
              ) : (
                imoveisFiltrados.map((i) => {
                  const isClosed = i.situacao === "fechada";
                  const isDesab = i.situacao === "desabitada";
                  const status = savingStatus[i.id] || "idle";

                  return (
                    <tr key={i.id} className="hover:bg-muted/10 transition-colors h-9">
                      <td className="border-r border-border font-bold text-xs text-center align-middle bg-card sticky left-0 z-10">
                        {i.numero}
                      </td>

                      <td className="border-r border-border p-0 text-left align-middle bg-card sticky left-[70px] z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                        <input
                          type="text"
                          defaultValue={i.nome_morador || ""}
                          disabled={isClosed || isDesab}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== (i.nome_morador || "")) {
                              setImoveis((prev) =>
                                prev.map((im) => (im.id === i.id ? { ...im, nome_morador: val } : im))
                              );
                              saveRow(i.id, { nome_morador: val });
                            }
                          }}
                          className={cn(
                            "w-full bg-transparent border-0 px-2 py-1.5 text-xs font-medium focus:outline-none focus:bg-muted/30 h-full",
                            (isClosed || isDesab) && "opacity-25 cursor-not-allowed italic"
                          )}
                          placeholder={isClosed || isDesab ? "—" : "Digitar nome..."}
                        />
                      </td>

                      <td
                        onClick={() => handleSituacaoClick(i.id, "fechada")}
                        className={cn(
                          "border-r border-border text-center align-middle font-bold text-sm cursor-pointer select-none",
                          isClosed ? "bg-red-500 text-white" : "hover:bg-muted/30"
                        )}
                      >
                        {isClosed ? "X" : ""}
                      </td>

                      <td
                        onClick={() => handleSituacaoClick(i.id, "desabitada")}
                        className={cn(
                          "border-r border-border text-center align-middle font-bold text-sm cursor-pointer select-none",
                          isDesab ? "bg-blue-600 text-white" : "hover:bg-muted/30"
                        )}
                      >
                        {isDesab ? "X" : ""}
                      </td>

                      {/* DEPUTADO ESTADUAL */}
                      {CANDIDATOS_CONFIG.estadual.map((c) => (
                        <td
                          key={`v-est-${c.nome}`}
                          onClick={() => !isClosed && !isDesab && handleVoteClick(i.id, "voto_estadual", c.nome)}
                          className={cn(
                            "border-r border-border text-center align-middle font-extrabold text-sm select-none transition-colors",
                            isClosed || isDesab ? "bg-muted/20 cursor-not-allowed" : "cursor-pointer hover:bg-amber-50/70",
                            i.voto_estadual === c.nome ? "bg-amber-300 text-amber-950 font-black" : ""
                          )}
                        >
                          {i.voto_estadual === c.nome ? "X" : ""}
                        </td>
                      ))}

                      {/* DEPUTADO FEDERAL */}
                      {CANDIDATOS_CONFIG.federal.map((c) => (
                        <td
                          key={`v-fed-${c.nome}`}
                          onClick={() => !isClosed && !isDesab && handleVoteClick(i.id, "voto_federal", c.nome)}
                          className={cn(
                            "border-r border-border text-center align-middle font-extrabold text-sm select-none transition-colors",
                            isClosed || isDesab ? "bg-muted/20 cursor-not-allowed" : "cursor-pointer hover:bg-blue-50/70",
                            i.voto_federal === c.nome ? "bg-blue-300 text-blue-950 font-black" : ""
                          )}
                        >
                          {i.voto_federal === c.nome ? "X" : ""}
                        </td>
                      ))}

                      {/* SENADOR */}
                      {CANDIDATOS_CONFIG.senador.map((c) => (
                        <td
                          key={`v-sen-${c.nome}`}
                          onClick={() => !isClosed && !isDesab && handleVoteClick(i.id, "voto_senador", c.nome)}
                          className={cn(
                            "border-r border-border text-center align-middle font-extrabold text-sm select-none transition-colors",
                            isClosed || isDesab ? "bg-muted/20 cursor-not-allowed" : "cursor-pointer hover:bg-purple-50/70",
                            i.voto_senador === c.nome ? "bg-purple-300 text-purple-950 font-black" : ""
                          )}
                        >
                          {i.voto_senador === c.nome ? "X" : ""}
                        </td>
                      ))}

                      {/* GOVERNADOR */}
                      {CANDIDATOS_CONFIG.governador.map((c) => (
                        <td
                          key={`v-gov-${c.nome}`}
                          onClick={() => !isClosed && !isDesab && handleVoteClick(i.id, "voto_governador", c.nome)}
                          className={cn(
                            "border-r border-border text-center align-middle font-extrabold text-sm select-none transition-colors",
                            isClosed || isDesab ? "bg-muted/20 cursor-not-allowed" : "cursor-pointer hover:bg-orange-50/70",
                            i.voto_governador === c.nome ? "bg-orange-300 text-orange-950 font-black" : ""
                          )}
                        >
                          {i.voto_governador === c.nome ? "X" : ""}
                        </td>
                      ))}

                      {/* PRESIDENTE */}
                      {CANDIDATOS_CONFIG.presidente.map((c) => (
                        <td
                          key={`v-pre-${c.nome}`}
                          onClick={() => !isClosed && !isDesab && handleVoteClick(i.id, "voto_presidente", c.nome)}
                          className={cn(
                            "border-r border-border text-center align-middle font-extrabold text-sm select-none transition-colors",
                            isClosed || isDesab ? "bg-muted/20 cursor-not-allowed" : "cursor-pointer hover:bg-red-50/70",
                            i.voto_presidente === c.nome ? "bg-red-300 text-red-950 font-black" : ""
                          )}
                        >
                          {i.voto_presidente === c.nome ? "X" : ""}
                        </td>
                      ))}

                      {/* STATUS */}
                      <td className="text-center align-middle px-1">
                        {status === "saving" && <Loader2 className="size-3.5 animate-spin text-blue-500 mx-auto" />}
                        {status === "saved" && <CheckCircle2 className="size-3.5 text-emerald-600 mx-auto" />}
                        {status === "error" && <AlertCircle className="size-3.5 text-red-500 mx-auto" />}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Componente para Cada Cargo com Botões Grandes e Avatares
function CandidateSection({
  title,
  candidates,
  selectedValue,
  onSelect,
}: {
  title: string;
  candidates: readonly { nome: string; cargo: string; cor: string; sigla: string; avatar: string }[];
  selectedValue: string | null;
  onSelect: (nome: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{title}</p>
        {selectedValue && (
          <span className="text-[11px] font-bold text-primary">
            Escolhido: <strong>{selectedValue}</strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {candidates.map((c) => {
          const isSelected = selectedValue === c.nome;

          return (
            <button
              key={c.nome}
              type="button"
              onClick={() => onSelect(c.nome)}
              className={cn(
                "relative p-3 border text-left transition-all flex flex-col justify-between min-h-[72px] select-none",
                isSelected
                  ? "border-primary bg-primary/10 ring-2 ring-primary shadow-sm"
                  : "border-border bg-card hover:bg-muted/40 text-foreground"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-lg leading-none">{c.avatar}</span>
                {isSelected ? (
                  <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                    ✓
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{c.sigla}</span>
                )}
              </div>

              <div className="mt-2">
                <p className={cn("text-xs font-black tracking-tight leading-tight", isSelected ? "text-primary" : "")}>
                  {c.nome}
                </p>
                <p className="text-[10px] text-muted-foreground">{c.cargo}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
