import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  rua: z.string().min(1),
  numero: z.string().optional().default(""),
  bairro: z.string().optional().default(""),
  cidade: z.string().optional().default(""),
});

/**
 * Geocodificação com dados abertos (OpenStreetMap / Nominatim).
 * Roda no servidor: nenhuma chave ou endpoint externo exposto no frontend.
 */
export const geocodeEndereco = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const query = [
      [data.rua, data.numero].filter(Boolean).join(", "),
      data.bairro,
      data.cidade,
      "Brasil",
    ]
      .filter((p) => p && String(p).trim() !== "")
      .join(", ");

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "PesquisaEleitoralMVP/1.0 (contato@exemplo.com)",
          "Accept-Language": "pt-BR",
        },
      });
      if (!res.ok) return { lat: null, lng: null, error: "Serviço indisponível" };
      const json = (await res.json()) as Array<{ lat: string; lon: string }>;
      const hit = json[0];
      if (!hit) return { lat: null, lng: null, error: "Endereço não encontrado" };
      return { lat: Number(hit.lat), lng: Number(hit.lon), error: null as string | null };
    } catch {
      return { lat: null, lng: null, error: "Falha ao consultar geocodificação" };
    }
  });
