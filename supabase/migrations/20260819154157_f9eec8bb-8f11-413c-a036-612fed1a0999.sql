CREATE TYPE public.resultado_pesquisa AS ENUM ('apoia','nao_apoia','indeciso','nao_respondeu','nao_encontrado');

CREATE TABLE public.equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX equipes_nome_key ON public.equipes (lower(nome));

CREATE TABLE public.bairros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bairros_nome_key ON public.bairros (lower(nome));

CREATE TABLE public.localidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bairro_id uuid NOT NULL REFERENCES public.bairros(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX localidades_key ON public.localidades (bairro_id, lower(nome));

CREATE TABLE public.ruas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  localidade_id uuid NOT NULL REFERENCES public.localidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ruas_key ON public.ruas (localidade_id, lower(nome));

CREATE TABLE public.imoveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rua_id uuid NOT NULL REFERENCES public.ruas(id) ON DELETE CASCADE,
  numero text NOT NULL,
  complemento text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  resultado_atual public.resultado_pesquisa,
  data_pesquisa date,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX imoveis_key ON public.imoveis (rua_id, lower(numero), lower(complemento));
CREATE INDEX imoveis_resultado_idx ON public.imoveis (resultado_atual);
CREATE INDEX imoveis_geo_idx ON public.imoveis (latitude, longitude);

CREATE TABLE public.pesquisas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  resultado public.resultado_pesquisa NOT NULL,
  observacao text,
  data_pesquisa date NOT NULL DEFAULT current_date,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pesquisas_imovel_idx ON public.pesquisas (imovel_id, data_pesquisa DESC);

CREATE TABLE public.importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_nome text NOT NULL,
  total_linhas integer NOT NULL DEFAULT 0,
  novos integer NOT NULL DEFAULT 0,
  atualizados integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.importacao_erros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.importacoes(id) ON DELETE CASCADE,
  linha integer NOT NULL,
  mensagem text NOT NULL,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX importacao_erros_idx ON public.importacao_erros (importacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipes, public.bairros, public.localidades, public.ruas, public.imoveis, public.pesquisas, public.importacoes, public.importacao_erros TO authenticated;
GRANT ALL ON public.equipes, public.bairros, public.localidades, public.ruas, public.imoveis, public.pesquisas, public.importacoes, public.importacao_erros TO service_role;

ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ruas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacao_erros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipes_auth_all" ON public.equipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bairros_auth_all" ON public.bairros FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "localidades_auth_all" ON public.localidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ruas_auth_all" ON public.ruas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "imoveis_auth_all" ON public.imoveis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pesquisas_auth_all" ON public.pesquisas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "importacoes_auth_all" ON public.importacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "importacao_erros_auth_all" ON public.importacao_erros FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER imoveis_updated_at BEFORE UPDATE ON public.imoveis
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_imovel_from_pesquisa() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.imoveis i
  SET resultado_atual = NEW.resultado,
      data_pesquisa = NEW.data_pesquisa,
      equipe_id = COALESCE(NEW.equipe_id, i.equipe_id),
      observacao = COALESCE(NEW.observacao, i.observacao)
  WHERE i.id = NEW.imovel_id
    AND (i.data_pesquisa IS NULL OR NEW.data_pesquisa >= i.data_pesquisa);
  RETURN NEW;
END; $$;

CREATE TRIGGER pesquisas_sync AFTER INSERT OR UPDATE ON public.pesquisas
FOR EACH ROW EXECUTE FUNCTION public.sync_imovel_from_pesquisa();

CREATE OR REPLACE FUNCTION public.upsert_imovel(
  p_bairro text,
  p_localidade text DEFAULT '',
  p_rua text DEFAULT '',
  p_numero text DEFAULT 'S/N',
  p_complemento text DEFAULT '',
  p_resultado public.resultado_pesquisa DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_data date DEFAULT NULL,
  p_equipe text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_bairro uuid; v_loc uuid; v_rua uuid; v_imovel uuid; v_equipe uuid;
  v_criado boolean := false; v_atualizado boolean := false;
  v_bairro_n text := btrim(coalesce(p_bairro,''));
  v_loc_n text := btrim(coalesce(p_localidade,''));
  v_rua_n text := btrim(coalesce(p_rua,''));
  v_num_n text := btrim(coalesce(p_numero,''));
  v_comp_n text := btrim(coalesce(p_complemento,''));
BEGIN
  IF v_bairro_n = '' THEN RAISE EXCEPTION 'Bairro obrigatório'; END IF;
  IF v_rua_n = '' THEN RAISE EXCEPTION 'Rua obrigatória'; END IF;
  IF v_num_n = '' THEN v_num_n := 'S/N'; END IF;

  SELECT id INTO v_bairro FROM public.bairros WHERE lower(nome) = lower(v_bairro_n);
  IF v_bairro IS NULL THEN
    INSERT INTO public.bairros(nome) VALUES (v_bairro_n) RETURNING id INTO v_bairro;
  END IF;

  SELECT id INTO v_loc FROM public.localidades WHERE bairro_id = v_bairro AND lower(nome) = lower(v_loc_n);
  IF v_loc IS NULL THEN
    INSERT INTO public.localidades(bairro_id, nome) VALUES (v_bairro, v_loc_n) RETURNING id INTO v_loc;
  END IF;

  SELECT id INTO v_rua FROM public.ruas WHERE localidade_id = v_loc AND lower(nome) = lower(v_rua_n);
  IF v_rua IS NULL THEN
    INSERT INTO public.ruas(localidade_id, nome) VALUES (v_loc, v_rua_n) RETURNING id INTO v_rua;
  END IF;

  IF p_equipe IS NOT NULL AND btrim(p_equipe) <> '' THEN
    SELECT id INTO v_equipe FROM public.equipes WHERE lower(nome) = lower(btrim(p_equipe));
    IF v_equipe IS NULL THEN
      INSERT INTO public.equipes(nome) VALUES (btrim(p_equipe)) RETURNING id INTO v_equipe;
    END IF;
  END IF;

  SELECT id INTO v_imovel FROM public.imoveis
  WHERE rua_id = v_rua AND lower(numero) = lower(v_num_n) AND lower(complemento) = lower(v_comp_n);

  IF v_imovel IS NULL THEN
    INSERT INTO public.imoveis(rua_id, numero, complemento, latitude, longitude)
    VALUES (v_rua, v_num_n, v_comp_n, p_latitude, p_longitude)
    RETURNING id INTO v_imovel;
    v_criado := true;
  ELSE
    UPDATE public.imoveis
    SET latitude = COALESCE(p_latitude, latitude),
        longitude = COALESCE(p_longitude, longitude)
    WHERE id = v_imovel;
  END IF;

  IF p_resultado IS NOT NULL THEN
    INSERT INTO public.pesquisas(imovel_id, resultado, observacao, data_pesquisa, equipe_id, created_by)
    VALUES (v_imovel, p_resultado, NULLIF(btrim(coalesce(p_observacao,'')),''), COALESCE(p_data, current_date), v_equipe, auth.uid());
    IF NOT v_criado THEN v_atualizado := true; END IF;
  END IF;

  RETURN jsonb_build_object('imovel_id', v_imovel, 'criado', v_criado, 'atualizado', v_atualizado);
END; $$;

GRANT EXECUTE ON FUNCTION public.upsert_imovel(text,text,text,text,text,public.resultado_pesquisa,text,date,text,double precision,double precision) TO authenticated;