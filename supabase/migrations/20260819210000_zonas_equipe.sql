-- Tabela de zonas/áreas por equipe no mapa
CREATE TABLE public.zonas_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  geojson jsonb NOT NULL,
  cor text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.zonas_equipe ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ler todas as zonas
CREATE POLICY "zonas_select" ON public.zonas_equipe
  FOR SELECT TO authenticated USING (true);

-- Política: usuários autenticados podem inserir/atualizar/deletar zonas
CREATE POLICY "zonas_insert" ON public.zonas_equipe
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "zonas_update" ON public.zonas_equipe
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "zonas_delete" ON public.zonas_equipe
  FOR DELETE TO authenticated USING (true);
