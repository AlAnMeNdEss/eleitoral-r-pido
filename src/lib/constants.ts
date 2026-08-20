export const RESULTADOS = [
  { value: "apoia", label: "Apoia", color: "bg-apoia" },
  { value: "nao_apoia", label: "Não apoia", color: "bg-nao-apoia" },
  { value: "indeciso", label: "Indeciso", color: "bg-indeciso" },
  { value: "nao_respondeu", label: "Não respondeu", color: "bg-nao-respondeu" },
  { value: "nao_encontrado", label: "Não encontrado", color: "bg-nao-encontrado" },
] as const;

export type Resultado = (typeof RESULTADOS)[number]["value"];

export const CANDIDATOS = {
  estadual: ["Sérgio", "Romeu", "Euvaldete", "Outro"],
  federal: ["Roger", "Tayna", "Outro"],
  senador: ["Cid Gomes", "Luziane", "Cap. Wagner", "Alcides"],
  governador: ["Elmano", "Ciro"],
  presidente: ["Lula", "Flávio"],
} as const;

export const SITUACOES = [
  { value: "regular", label: "Pesquisa Respondida" },
  { value: "fechada", label: "Casa Fechada (FECH)" },
  { value: "desabitada", label: "Casa Desabitada (DESAB)" },
] as const;

export function situacaoLabel(value?: string | null) {
  if (!value) return "Pendente";
  return SITUACOES.find((s) => s.value === value)?.label ?? value;
}

export function resultadoLabel(value?: string | null) {
  if (!value) return "Pendente";
  return RESULTADOS.find((r) => r.value === value)?.label ?? value;
}

export function resultadoColor(value?: string | null) {
  if (!value) return "bg-pendente";
  return RESULTADOS.find((r) => r.value === value)?.color ?? "bg-pendente";
}

/** Aceita rótulos livres vindos de planilhas e converte para o enum do banco. */
export function parseResultado(raw: unknown): Resultado | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!s) return null;
  if (s.includes("nao apoia") || s === "nao_apoia" || s === "contra") return "nao_apoia";
  if (s.includes("nao encontrado") || s === "nao_encontrado" || s.includes("fechado"))
    return "nao_encontrado";
  if (s.includes("nao respondeu") || s === "nao_respondeu" || s.includes("recusou"))
    return "nao_respondeu";
  if (s.includes("indeciso") || s.includes("duvida")) return "indeciso";
  if (s.includes("apoia") || s === "sim" || s === "favoravel") return "apoia";
  return null;
}

