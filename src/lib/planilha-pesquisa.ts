/**
 * Leitor da "PLANILHA PARA PESQUISA" (modelo de campo em Excel).
 *
 * Estrutura esperada de cada aba:
 *  - Linha de título com "BAIRRO: X   RUA: Y"
 *  - Linha de grupos: Nº DA CASA | NOMES | CASAS | DEPUTADO ESTADUAL | ... | PRESIDENTE
 *  - Linha de candidatos: FECH | DESAB | SÉRGIO | ROMEU | ... | LULA | FLÁVIO | INDECISO
 *  - Linhas de dados, com "X" marcando a coluna escolhida.
 *    O número da casa pode aparecer só na primeira linha de um grupo de moradores.
 */

export type Cargo =
  | "voto_estadual"
  | "voto_federal"
  | "voto_senador"
  | "voto_governador"
  | "voto_presidente";

export type PesquisaRow = {
  aba: string;
  linha: number;
  bairro: string;
  rua: string;
  numero: string;
  nome_morador: string;
  situacao: string | null;
  voto_estadual: string | null;
  voto_federal: string | null;
  voto_senador: string | null;
  voto_governador: string | null;
  voto_presidente: string | null;
};

export function norm(s: unknown): string {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

const CARGO_POR_GRUPO: Array<[RegExp, Cargo]> = [
  [/DEPUTADO ESTADUAL|ESTADUAL/, "voto_estadual"],
  [/DEPUTADO FEDERAL|FEDERAL/, "voto_federal"],
  [/SENADOR/, "voto_senador"],
  [/GOVERNADOR/, "voto_governador"],
  [/PRESIDENTE/, "voto_presidente"],
];

function cargoDoGrupo(grupo: string): Cargo | null {
  for (const [re, cargo] of CARGO_POR_GRUPO) if (re.test(grupo)) return cargo;
  return null;
}

function marcado(v: unknown): boolean {
  const s = norm(v);
  return s !== "" && s !== "0" && s !== "-";
}

function titulo(cell: unknown): { bairro: string; rua: string } {
  const raw = String(cell ?? "").replace(/\u00a0/g, " ");
  const bairro = /BAIRRO\s*:\s*(.*?)(?:RUA\s*:|$)/is.exec(raw)?.[1]?.trim() ?? "";
  const rua = /RUA\s*:\s*(.*)$/is.exec(raw)?.[1]?.trim() ?? "";
  return { bairro: bairro.replace(/\s+/g, " "), rua: rua.replace(/\s+/g, " ") };
}

/** Detecta se a planilha segue o modelo de pesquisa de campo. */
export function isPlanilhaPesquisa(grids: Record<string, unknown[][]>): boolean {
  return Object.values(grids).some((grid) =>
    grid.slice(0, 8).some((row) => row.some((c) => /N[º°O]? DA CASA/.test(norm(c)))),
  );
}

/** Converte todas as abas do arquivo em linhas prontas para gravação. */
export function parsePlanilhaPesquisa(grids: Record<string, unknown[][]>): PesquisaRow[] {
  const out: PesquisaRow[] = [];

  for (const [aba, grid] of Object.entries(grids)) {
    const headerIdx = grid.findIndex((row) =>
      row.some((c) => /N[º°O]? DA CASA/.test(norm(c))),
    );
    if (headerIdx < 0) continue;

    // Bairro / rua vêm do título (célula mesclada nas primeiras linhas) ou do nome da aba.
    let bairro = "";
    let rua = "";
    for (let r = 0; r <= headerIdx; r++) {
      for (const cell of grid[r] ?? []) {
        const t = titulo(cell);
        if (t.bairro && !bairro) bairro = t.bairro;
        if (t.rua && !rua) rua = t.rua;
      }
    }
    if (!rua) rua = aba.trim();

    const grupos = grid[headerIdx] ?? [];
    const cands = grid[headerIdx + 1] ?? [];
    const largura = Math.max(grupos.length, cands.length);

    let colNumero = 0;
    let colNomes = 1;
    let colFech: number | null = null;
    let colDesab: number | null = null;
    const colCands: Array<{ idx: number; cargo: Cargo; candidato: string }> = [];

    let grupoAtual = "";
    for (let c = 0; c < largura; c++) {
      const g = norm(grupos[c]);
      if (g) grupoAtual = g;
      if (/N[º°O]? DA CASA/.test(g)) {
        colNumero = c;
        continue;
      }
      if (/^NOMES?$/.test(g)) {
        colNomes = c;
        continue;
      }
      const cand = String(cands[c] ?? "").replace(/\u00a0/g, " ").trim();
      const candN = norm(cand);
      if (!candN) continue;
      if (candN === "FECH") {
        colFech = c;
        continue;
      }
      if (candN === "DESAB") {
        colDesab = c;
        continue;
      }
      const cargo = cargoDoGrupo(grupoAtual);
      if (cargo) colCands.push({ idx: c, cargo, candidato: cand });
    }

    let numeroAtual = "";
    for (let r = headerIdx + 2; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const numRaw = String(row[colNumero] ?? "").trim();
      if (numRaw) numeroAtual = numRaw;
      const nome = String(row[colNomes] ?? "").replace(/\u00a0/g, " ").trim();

      const fech = colFech !== null && marcado(row[colFech]);
      const desab = colDesab !== null && marcado(row[colDesab]);

      const votos: Partial<Record<Cargo, string>> = {};
      for (const c of colCands) {
        if (marcado(row[c.idx]) && !votos[c.cargo]) votos[c.cargo] = c.candidato;
      }

      const temAlgo = !!nome || fech || desab || Object.keys(votos).length > 0;
      if (!numeroAtual || !temAlgo) continue;

      let situacao: string | null = null;
      if (fech) situacao = "fechada";
      else if (desab) situacao = "desabitada";
      else situacao = "regular";

      out.push({
        aba,
        linha: r + 1,
        bairro,
        rua,
        numero: numeroAtual,
        nome_morador: nome,
        situacao,
        voto_estadual: votos.voto_estadual ?? null,
        voto_federal: votos.voto_federal ?? null,
        voto_senador: votos.voto_senador ?? null,
        voto_governador: votos.voto_governador ?? null,
        voto_presidente: votos.voto_presidente ?? null,
      });
    }
  }

  return out;
}
