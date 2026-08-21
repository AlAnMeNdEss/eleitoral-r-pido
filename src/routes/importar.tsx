import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  X,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { SITUACOES, situacaoLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar planilha | Pesquisa Eleitoral" },
      {
        name: "description",
        content: "Importe imóveis e pesquisas a partir de planilhas XLSX ou CSV.",
      },
      { property: "og:title", content: "Importar planilha | Pesquisa Eleitoral" },
      {
        property: "og:description",
        content: "Importação em lote de imóveis com prévia e validação.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Importar">
      <Importar />
    </AppShell>
  ),
});

// --- Dynamic mapping helper ---

type CandidateCol = {
  index: number;
  cargo: "p_voto_estadual" | "p_voto_federal" | "p_voto_senador" | "p_voto_governador" | "p_voto_presidente";
  candidato: string;
};

type ColMap = {
  bairro: number | null;
  localidade: number | null;
  rua: number | null;
  nom_tipo_seglogr: number | null; // CNEFE street type
  nom_seglogr: number | null;      // CNEFE street name
  numero: number | null;
  num_endereco: number | null;     // CNEFE house number
  complemento: number | null;
  morador: number | null;
  fechada: number | null;
  desabitada: number | null;
  candidates: CandidateCol[];
  observacao: number | null;
  equipe: number | null;
  data: number | null;
  latitude: number | null;
  longitude: number | null;
  cod_especie: number | null;
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return s !== "" && s !== "0" && s !== "false";
}

function detectColumns(headers: string[]): ColMap {
  const map: ColMap = {
    bairro: null,
    localidade: null,
    rua: null,
    nom_tipo_seglogr: null,
    nom_seglogr: null,
    numero: null,
    num_endereco: null,
    complemento: null,
    morador: null,
    fechada: null,
    desabitada: null,
    candidates: [],
    observacao: null,
    equipe: null,
    data: null,
    latitude: null,
    longitude: null,
    cod_especie: null,
  };

  const normed = headers.map(normalize);
  let currentZone: "estadual" | "federal" | "senador" | "governador" | "presidente" | null = null;

  normed.forEach((h, idx) => {
    // CNEFE Columns
    if (/dsc_localidade/i.test(h)) map.bairro = idx;
    else if (/nom_tipo_seglogr/i.test(h)) map.nom_tipo_seglogr = idx;
    else if (/nom_seglogr/i.test(h)) map.nom_seglogr = idx;
    else if (/num_endereco/i.test(h)) map.num_endereco = idx;
    else if (/cod_especie|cod_tipo_especi/i.test(h)) map.cod_especie = idx;
    else if (/latitude/i.test(h)) map.latitude = idx;
    else if (/longitude/i.test(h)) map.longitude = idx;
    
    // Normal Columns
    else if (/bairro/i.test(h)) map.bairro = idx;
    else if (/rua|logradouro|endereco|endereço/i.test(h)) map.rua = idx;
    else if (/numero|num|n[uú]mero|nº/i.test(h)) map.numero = idx;
    else if (/localidade|comunidade/i.test(h)) map.localidade = idx;
    else if (/complemento|compl|apto|apartamento/i.test(h)) map.complemento = idx;
    else if (/nome|morador|nomes/i.test(h)) map.morador = idx;
    else if (/fech|fechada/i.test(h)) map.fechada = idx;
    else if (/desab|desabitada/i.test(h)) map.desabitada = idx;
    else if (/observ|obs/i.test(h)) map.observacao = idx;
    else if (/equipe|time|grupo/i.test(h)) map.equipe = idx;
    else if (/^data$|data.pesq/i.test(h)) map.data = idx;

    // Detect candidate voting columns
    else if (/sergio|romeu|euvaldete/i.test(h)) {
      currentZone = "estadual";
      const candName = h.includes("sergio") ? "Sérgio" : h.includes("romeu") ? "Romeu" : "Euvaldete";
      map.candidates.push({ index: idx, cargo: "p_voto_estadual", candidato: candName });
    }
    else if (/roger|tayna/i.test(h)) {
      currentZone = "federal";
      const candName = h.includes("roger") ? "Roger" : "Tayna";
      map.candidates.push({ index: idx, cargo: "p_voto_federal", candidato: candName });
    }
    else if (/cid|luziane|wagner|alcides/i.test(h)) {
      currentZone = "senador";
      const candName = h.includes("cid") ? "Cid Gomes" : h.includes("luziane") ? "Luziane" : h.includes("wagner") ? "Cap. Wagner" : "Alcides";
      map.candidates.push({ index: idx, cargo: "p_voto_senador", candidato: candName });
    }
    else if (/elmano|ciro/i.test(h)) {
      currentZone = "governador";
      const candName = h.includes("elmano") ? "Elmano" : "Ciro";
      map.candidates.push({ index: idx, cargo: "p_voto_governador", candidato: candName });
    }
    else if (/lula|flavio/i.test(h)) {
      currentZone = "presidente";
      const candName = h.includes("lula") ? "Lula" : "Flávio";
      map.candidates.push({ index: idx, cargo: "p_voto_presidente", candidato: candName });
    }
    else if (/outro/i.test(h)) {
      if (currentZone === "estadual") {
        map.candidates.push({ index: idx, cargo: "p_voto_estadual", candidato: "Outro" });
      } else if (currentZone === "federal") {
        map.candidates.push({ index: idx, cargo: "p_voto_federal", candidato: "Outro" });
      }
    }
  });

  return map;
}

// --- Row types ---

type RowStatus = "novo" | "atualizar" | "manter" | "erro";

type ParsedRow = {
  line: number;
  bairro: string;
  localidade: string;
  rua: string;
  numero: string;
  complemento: string;
  nome_morador: string;
  situacao: string;
  voto_estadual: string | null;
  voto_federal: string | null;
  voto_senador: string | null;
  voto_governador: string | null;
  voto_presidente: string | null;
  observacao: string;
  equipe: string;
  data: string;
  latitude: number | null;
  longitude: number | null;
  cod_especie: number | null;
  status: RowStatus;
  erroMsg: string;
  raw: Record<string, unknown>;
};

// --- Main component ---

type Etapa = "upload" | "previa" | "gravando" | "concluido";

function Importar() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [fileName, setFileName] = useState("");
  const [allRows, setAllRows] = useState<ParsedRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<ParsedRow[]>([]);
  const [progresso, setProgresso] = useState(0);
  const [totais, setTotais] = useState({ novos: 0, atualizados: 0, erros: 0 });
  const [dragging, setDragging] = useState(false);
  const [detectedMap, setDetectedMap] = useState<ColMap | null>(null);
  const [headersList, setHeadersList] = useState<string[]>([]);
  
  // CNEFE filters
  const [isCnefe, setIsCnefe] = useState(false);
  const [localidadesList, setLocalidadesList] = useState<string[]>([]);
  const [localidadeFiltro, setLocalidadeFiltro] = useState("");
  const [apenasResidencial, setApenasResidencial] = useState(true);

  const applyFilters = useCallback((rows: ParsedRow[], isCnefeData: boolean, locFilter: string, resOnly: boolean) => {
    let result = [...rows];
    if (isCnefeData) {
      if (locFilter) {
        result = result.filter(r => r.bairro === locFilter);
      }
      if (resOnly) {
        result = result.filter(r => r.cod_especie === 101);
      }
    }
    setFilteredRows(result);
  }, []);

  const contadores = useCallback(() => {
    const novo = filteredRows.filter((r) => r.status === "novo").length;
    const atualizar = filteredRows.filter((r) => r.status === "atualizar").length;
    const manter = filteredRows.filter((r) => r.status === "manter").length;
    const erro = filteredRows.filter((r) => r.status === "erro").length;
    return { novo, atualizar, manter, erro, total: filteredRows.length };
  }, [filteredRows]);

  async function processarArquivo(file: File) {
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        toast.error("Planilha vazia");
        return;
      }

      // --- Modelo "PLANILHA PARA PESQUISA" (uma aba por rua) ---
      const grids: Record<string, unknown[][]> = {};
      for (const n of wb.SheetNames) {
        grids[n] = XLSX.utils.sheet_to_json(wb.Sheets[n]!, {
          header: 1,
          defval: "",
          blankrows: true,
        }) as unknown[][];
      }
      if (isPlanilhaPesquisa(grids)) {
        await processarPlanilhaPesquisa(grids);
        return;
      }

      const sheet = wb.Sheets[sheetName]!;

      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (jsonData.length === 0) {
        toast.error("Nenhuma linha encontrada na planilha");
        return;
      }

      const headers = Object.keys(jsonData[0]!);
      setHeadersList(headers);
      const colMap = detectColumns(headers);
      setDetectedMap(colMap);

      const hasCnefeCols = colMap.nom_seglogr !== null || colMap.num_endereco !== null;
      setIsCnefe(hasCnefeCols);

      if (colMap.bairro === null && colMap.localidade === null) {
        toast.error("Coluna de Localidade/Bairro não encontrada");
        return;
      }

      // Fetch existing properties for status detection
      const { data: existentes } = await supabase
        .from("imoveis")
        .select("id, numero, complemento, situacao, voto_presidente, ruas!inner(nome, localidades!inner(nome, bairros!inner(nome)))");

      const existMap = new Map<string, { situacao: string | null; voto_pres: string | null }>();
      for (const im of (existentes ?? []) as unknown as Array<{
        numero: string;
        complemento: string;
        situacao: string | null;
        voto_presidente: string | null;
        ruas: { nome: string; localidades: { nome: string; bairros: { nome: string } } };
      }>) {
        const key = [
          normalize(im.ruas.localidades.bairros.nome),
          normalize(im.ruas.localidades.nome),
          normalize(im.ruas.nome),
          normalize(im.numero),
          normalize(im.complemento),
        ].join("|");
        existMap.set(key, { situacao: im.situacao, voto_pres: im.voto_presidente });
      }

      // Collect unique localidade values for filter dropdown
      const uniqueLocs = new Set<string>();

      const parsed: ParsedRow[] = jsonData.map((row, i) => {
        const val = (col: number | null) =>
          col !== null ? String(row[headers[col]!] ?? "").trim() : "";

        const bairro = val(colMap.bairro);
        const localidade = val(colMap.localidade);
        
        if (bairro) uniqueLocs.add(bairro);
        else if (localidade) uniqueLocs.add(localidade);

        let rua = "";
        if (colMap.rua !== null) {
          rua = val(colMap.rua);
        } else if (colMap.nom_seglogr !== null) {
          const tipo = colMap.nom_tipo_seglogr !== null ? val(colMap.nom_tipo_seglogr) : "";
          const nome = val(colMap.nom_seglogr);
          rua = tipo ? `${tipo} ${nome}` : nome;
        }

        let numero = "";
        if (colMap.numero !== null) {
          numero = val(colMap.numero);
        } else if (colMap.num_endereco !== null) {
          numero = val(colMap.num_endereco);
        }
        if (!numero || numero === "0") numero = "S/N";

        const complemento = val(colMap.complemento);
        const nome_morador = val(colMap.morador);
        const observacao = val(colMap.observacao);
        const equipe = val(colMap.equipe);
        const data = val(colMap.data) || new Date().toISOString().slice(0, 10);

        // Coordinates division for CNEFE integers
        let latVal: number | null = null;
        let lngVal: number | null = null;
        if (colMap.latitude !== null) {
          const parsedLat = Number(row[headers[colMap.latitude]!]);
          if (!isNaN(parsedLat)) {
            latVal = Math.abs(parsedLat) > 180 ? parsedLat / 1000000 : parsedLat;
          }
        }
        if (colMap.longitude !== null) {
          const parsedLng = Number(row[headers[colMap.longitude]!]);
          if (!isNaN(parsedLng)) {
            lngVal = Math.abs(parsedLng) > 180 ? parsedLng / 1000000 : parsedLng;
          }
        }

        const cod_especie = colMap.cod_especie !== null ? Number(row[headers[colMap.cod_especie]!]) : null;

        // Detect house situation
        let situacao = "regular";
        if (colMap.fechada !== null && hasValue(row[headers[colMap.fechada]!])) {
          situacao = "fechada";
        } else if (colMap.desabitada !== null && hasValue(row[headers[colMap.desabitada]!])) {
          situacao = "desabitada";
        }

        // Detect candidate votes
        let voto_estadual: string | null = null;
        let voto_federal: string | null = null;
        let voto_senador: string | null = null;
        let voto_governador: string | null = null;
        let voto_presidente: string | null = null;

        if (situacao === "regular") {
          colMap.candidates.forEach((c) => {
            const rawVal = row[headers[c.index]!];
            if (hasValue(rawVal)) {
              if (c.cargo === "p_voto_estadual") voto_estadual = c.candidato;
              else if (c.cargo === "p_voto_federal") voto_federal = c.candidato;
              else if (c.cargo === "p_voto_senador") voto_senador = c.candidato;
              else if (c.cargo === "p_voto_governador") voto_governador = c.candidato;
              else if (c.cargo === "p_voto_presidente") voto_presidente = c.candidato;
            }
          });
        }

        // Validate
        let status: RowStatus = "novo";
        let erroMsg = "";

        const finalBairro = bairro || localidade;
        if (!finalBairro) {
          status = "erro";
          erroMsg = "Bairro obrigatório";
        } else if (!rua) {
          status = "erro";
          erroMsg = "Rua obrigatória";
        } else {
          const key = [
            normalize(finalBairro),
            normalize(localidade),
            normalize(rua),
            normalize(numero),
            normalize(complemento),
          ].join("|");
          const existing = existMap.get(key);
          if (existing) {
            const hasChanges =
              existing.situacao !== situacao ||
              existing.voto_pres !== voto_presidente;
            if (hasChanges) {
              status = "atualizar";
            } else {
              status = "manter";
            }
          }
        }

        return {
          line: i + 2,
          bairro: finalBairro,
          localidade,
          rua,
          numero,
          complemento,
          nome_morador,
          situacao,
          voto_estadual,
          voto_federal,
          voto_senador,
          voto_governador,
          voto_presidente,
          observacao,
          equipe,
          data,
          latitude: latVal,
          longitude: lngVal,
          cod_especie,
          status,
          erroMsg,
          raw: row,
        };
      });

      setAllRows(parsed);
      
      const locList = Array.from(uniqueLocs).sort();
      setLocalidadesList(locList);

      // Pre-select "BOA ESPERANCA" / "BOA ESPERANÇA" if CNEFE
      let initialLocFilter = "";
      if (hasCnefeCols) {
        const matchingLoc = locList.find(l => normalize(l).includes("boa esperanca"));
        if (matchingLoc) initialLocFilter = matchingLoc;
      }
      setLocalidadeFiltro(initialLocFilter);

      applyFilters(parsed, hasCnefeCols, initialLocFilter, apenasResidencial);
      setEtapa("previa");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler arquivo");
    }
  }

  async function gravar() {
    setEtapa("gravando");
    const processaveis = filteredRows.filter((r) => r.status !== "erro" && r.status !== "manter");
    const erros = filteredRows.filter((r) => r.status === "erro");
    let novos = 0;
    let atualizados = 0;
    let errosCount = erros.length;
    const erroDetalhe: Array<{ linha: number; mensagem: string; dados: unknown }> = erros.map(
      (r) => ({
        linha: r.line,
        mensagem: r.erroMsg,
        dados: r.raw,
      }),
    );

    // Create importacao record
    const { data: imp, error: impErr } = await supabase
      .from("importacoes")
      .insert({
        arquivo_nome: fileName,
        total_linhas: filteredRows.length,
      })
      .select("id")
      .single();

    if (impErr || !imp) {
      toast.error("Erro ao criar registro de importação");
      setEtapa("previa");
      return;
    }

    const importacaoId = imp.id;

    for (let i = 0; i < processaveis.length; i++) {
      const r = processaveis[i]!;
      setProgresso(Math.round(((i + 1) / processaveis.length) * 100));

      try {
        const { data, error } = await supabase.rpc("upsert_imovel", {
          p_bairro: r.bairro,
          p_localidade: r.localidade,
          p_rua: r.rua,
          p_numero: r.numero,
          p_complemento: r.complemento,
          p_resultado: null,
          p_observacao: r.observacao || null,
          p_data: r.data || undefined,
          p_equipe: r.equipe || null,
          p_nome_morador: r.nome_morador || null,
          p_situacao: r.situacao,
          p_voto_estadual: r.voto_estadual,
          p_voto_federal: r.voto_federal,
          p_voto_senador: r.voto_senador,
          p_voto_governador: r.voto_governador,
          p_voto_presidente: r.voto_presidente,
          p_latitude: r.latitude,
          p_longitude: r.longitude,
        });
        if (error) throw error;
        const res = data as unknown as { criado: boolean; atualizado: boolean };
        if (res.criado) novos++;
        else atualizados++;
      } catch (err) {
        errosCount++;
        erroDetalhe.push({
          linha: r.line,
          mensagem: err instanceof Error ? err.message : "Erro desconhecido",
          dados: r.raw,
        });
      }
    }

    // Update importacao totals
    await supabase
      .from("importacoes")
      .update({ novos, atualizados, erros: errosCount })
      .eq("id", importacaoId);

    // Insert error details
    if (erroDetalhe.length > 0) {
      const errorRows = erroDetalhe.map((e) => ({
        importacao_id: importacaoId,
        linha: e.linha,
        mensagem: e.mensagem,
        dados: e.dados as Record<string, unknown>,
      }));
      await supabase.from("importacao_erros").insert(errorRows);
    }

    setTotais({ novos, atualizados, erros: errosCount });
    setEtapa("concluido");
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["mapa"] });
    qc.invalidateQueries({ queryKey: ["buscar"] });
    qc.invalidateQueries({ queryKey: ["enderecos"] });
  }

  function resetar() {
    setEtapa("upload");
    setAllRows([]);
    setFilteredRows([]);
    setProgresso(0);
    setTotais({ novos: 0, atualizados: 0, erros: 0 });
    setFileName("");
    setDetectedMap(null);
    setHeadersList([]);
    setIsCnefe(false);
    setLocalidadesList([]);
    setLocalidadeFiltro("");
    setApenasResidencial(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processarArquivo(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processarArquivo(file);
  }

  // --- UPLOAD ---
  if (etapa === "upload") {
    return (
      <div className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className={cn(
            "flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card p-6 text-center transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
          )}
        >
          <Upload className="size-10 text-muted-foreground" />
          <p className="font-semibold">Arraste ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground">
            Arquivos XLSX ou CSV estruturados (aceita planilhas CNEFE / IBGE).
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileInput}
        />

        <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold text-foreground">Como estruturar as colunas da planilha:</p>
          <ul className="space-y-1">
            <li>• Colunas obrigatórias: <strong className="text-foreground">Bairro</strong> e <strong className="text-foreground">Rua</strong>.</li>
            <li>• Identificador de imóvel: <strong className="text-foreground">Número</strong> e <strong className="text-foreground">Complemento</strong>.</li>
            <li>• Suporta planilhas padrão <strong className="text-foreground">IBGE CNEFE</strong>: lê automaticamente os campos <strong className="text-foreground">DSC_LOCALIDADE, NOM_SEGLOGR, LATITUDE, LONGITUDE</strong> e filtra residências pelo código de espécie.</li>
          </ul>
        </div>
      </div>
    );
  }

  // --- PRÉVIA ---
  if (etapa === "previa") {
    const c = contadores();
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <FileSpreadsheet className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{fileName}</p>
            <p className="text-xs text-muted-foreground">Total: {allRows.length} linhas</p>
          </div>
          <Button variant="ghost" size="icon" onClick={resetar} aria-label="Cancelar">
            <X className="size-4" />
          </Button>
        </div>

        {/* CNEFE Specific filters section */}
        {isCnefe && (
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground border-b pb-2">
              <Filter className="size-4" />
              <span>Opções de Filtro (Planilha CNEFE Detectada)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="localidade-select" className="text-xs font-semibold">Localidade / Bairro</Label>
                <select
                  id="localidade-select"
                  value={localidadeFiltro}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalidadeFiltro(val);
                    applyFilters(allRows, isCnefe, val, apenasResidencial);
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Todas as localidades</option>
                  {localidadesList.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc} ({allRows.filter(r => r.bairro === loc).length} linhas)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="residencial-checkbox"
                  checked={apenasResidencial}
                  onCheckedChange={(checked) => {
                    const isChecked = !!checked;
                    setApenasResidencial(isChecked);
                    applyFilters(allRows, isCnefe, localidadeFiltro, isChecked);
                  }}
                />
                <Label htmlFor="residencial-checkbox" className="text-xs font-medium leading-none cursor-pointer">
                  Importar apenas residências (Espécie 101)
                </Label>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Filtrado: {filteredRows.length} de {allRows.length} linhas.
            </p>
          </div>
        )}

        {/* Contadores */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <Contador label="Novos" value={c.novo} cls="text-apoia" />
          <Contador label="Atualizar" value={c.atualizar} cls="text-indeciso" />
          <Contador label="Manter" value={c.manter} cls="text-muted-foreground" />
          <Contador label="Erros" value={c.erro} cls="text-nao-apoia" />
        </div>

        {/* Colunas detectadas */}
        {detectedMap && (
          <details className="rounded-xl border bg-card p-3 text-xs">
            <summary className="cursor-pointer font-semibold">Mapeamento dinâmico de colunas</summary>
            <ul className="mt-2 space-y-1 text-muted-foreground grid grid-cols-2 gap-x-4">
              <li><strong>Bairro / Localidade:</strong> {detectedMap.bairro !== null ? headersList[detectedMap.bairro] : "—"}</li>
              <li><strong>Rua:</strong> {detectedMap.rua !== null ? headersList[detectedMap.rua] : detectedMap.nom_seglogr !== null ? `${headersList[detectedMap.nom_tipo_seglogr ?? -1] || ""} + ${headersList[detectedMap.nom_seglogr]}` : "—"}</li>
              <li><strong>Número:</strong> {detectedMap.numero !== null ? headersList[detectedMap.numero] : detectedMap.num_endereco !== null ? headersList[detectedMap.num_endereco] : "—"}</li>
              <li><strong>Morador:</strong> {detectedMap.morador !== null ? headersList[detectedMap.morador] : "—"}</li>
              <li><strong>Latitude:</strong> {detectedMap.latitude !== null ? headersList[detectedMap.latitude] : "—"}</li>
              <li><strong>Longitude:</strong> {detectedMap.longitude !== null ? headersList[detectedMap.longitude] : "—"}</li>
              {detectedMap.candidates.length > 0 && (
                <div className="col-span-2 max-h-32 overflow-y-auto pl-2 border-l border-muted mt-2">
                  {detectedMap.candidates.map((cand) => (
                    <li key={cand.index}>
                      • Coluna <strong className="text-foreground">"{headersList[cand.index]}"</strong> → {cand.candidato} ({cand.cargo.replace("p_voto_", "")})
                    </li>
                  ))}
                </div>
              )}
            </ul>
          </details>
        )}

        {/* Lista das linhas */}
        <div className="max-h-[45vh] space-y-1.5 overflow-y-auto rounded-xl border bg-card p-3">
          {filteredRows.slice(0, 200).map((r) => (
            <div
              key={r.line}
              className={cn(
                "flex flex-col gap-1 rounded-lg px-2.5 py-2 text-xs",
                r.status === "erro" && "bg-destructive/10",
                r.status === "novo" && "bg-apoia/10",
                r.status === "atualizar" && "bg-indeciso/10",
                r.status === "manter" && "opacity-60 bg-muted/20",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 font-mono text-muted-foreground">#{r.line}</span>
                <StatusBadge status={r.status} />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {r.rua}, {r.numero} — {r.bairro}
                </span>
                {r.erroMsg && (
                  <span className="shrink-0 text-[10px] text-destructive">{r.erroMsg}</span>
                )}
              </div>
              <div className="pl-10 text-[10px] text-muted-foreground flex flex-wrap gap-x-3">
                {r.nome_morador && <span>Morador: <strong className="text-foreground">{r.nome_morador}</strong></span>}
                {r.latitude && <span>Coord: <strong className="text-foreground">{r.latitude.toFixed(5)}, {r.longitude?.toFixed(5)}</strong></span>}
                {r.cod_especie && <span>Espécie: <strong className="text-foreground">{r.cod_especie}</strong></span>}
              </div>
            </div>
          ))}
          {filteredRows.length > 200 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              ...e mais {filteredRows.length - 200} linhas
            </p>
          )}
        </div>

        <Button
          className="h-14 w-full text-base"
          disabled={c.novo + c.atualizar === 0}
          onClick={gravar}
        >
          <ArrowRight className="mr-2 size-4" />
          Importar {c.novo + c.atualizar} registros
        </Button>
      </div>
    );
  }

  // --- GRAVANDO ---
  if (etapa === "gravando") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="font-semibold">Gravando registros no banco...</p>
        <Progress value={progresso} className="w-full max-w-xs" />
        <p className="text-sm text-muted-foreground">{progresso}%</p>
      </div>
    );
  }

  // --- CONCLUÍDO ---
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <CheckCircle2 className="size-12 text-apoia" />
      <h2 className="text-xl font-bold">Importação concluída!</h2>
      <div className="grid grid-cols-3 gap-4">
        <Contador label="Novos" value={totais.novos} cls="text-apoia" />
        <Contador label="Atualizados" value={totais.atualizados} cls="text-indeciso" />
        <Contador label="Erros" value={totais.erros} cls="text-nao-apoia" />
      </div>
      <p className="text-sm text-muted-foreground">{fileName}</p>
      <Button onClick={resetar} className="h-12">
        Importar outra planilha
      </Button>
    </div>
  );
}

// --- Small components ---

function Contador({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 min-w-[90px]">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { label: string; cls: string }> = {
    novo: { label: "Novo", cls: "bg-apoia text-white" },
    atualizar: { label: "Atualizar", cls: "bg-indeciso text-white" },
    manter: { label: "Manter", cls: "bg-muted text-muted-foreground" },
    erro: { label: "Erro", cls: "bg-destructive text-white" },
  };
  const m = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}
