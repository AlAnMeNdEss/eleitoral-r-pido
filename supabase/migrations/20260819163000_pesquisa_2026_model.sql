-- Add new columns to public.imoveis
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS nome_morador text,
  ADD COLUMN IF NOT EXISTS situacao text,
  ADD COLUMN IF NOT EXISTS voto_estadual text,
  ADD COLUMN IF NOT EXISTS voto_federal text,
  ADD COLUMN IF NOT EXISTS voto_senador text,
  ADD COLUMN IF NOT EXISTS voto_governador text,
  ADD COLUMN IF NOT EXISTS voto_presidente text;

-- Add new columns to public.pesquisas
ALTER TABLE public.pesquisas
  ADD COLUMN IF NOT EXISTS nome_morador text,
  ADD COLUMN IF NOT EXISTS situacao text,
  ADD COLUMN IF NOT EXISTS voto_estadual text,
  ADD COLUMN IF NOT EXISTS voto_federal text,
  ADD COLUMN IF NOT EXISTS voto_senador text,
  ADD COLUMN IF NOT EXISTS voto_governador text,
  ADD COLUMN IF NOT EXISTS voto_presidente text;

-- Make resultado column nullable in public.pesquisas
ALTER TABLE public.pesquisas ALTER COLUMN resultado DROP NOT NULL;

-- Update the sync trigger function
CREATE OR REPLACE FUNCTION public.sync_imovel_from_pesquisa() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.imoveis i
  SET resultado_atual = NEW.resultado,
      data_pesquisa = NEW.data_pesquisa,
      equipe_id = COALESCE(NEW.equipe_id, i.equipe_id),
      observacao = COALESCE(NEW.observacao, i.observacao),
      nome_morador = COALESCE(NEW.nome_morador, i.nome_morador),
      situacao = COALESCE(NEW.situacao, i.situacao),
      voto_estadual = COALESCE(NEW.voto_estadual, i.voto_estadual),
      voto_federal = COALESCE(NEW.voto_federal, i.voto_federal),
      voto_senador = COALESCE(NEW.voto_senador, i.voto_senador),
      voto_governador = COALESCE(NEW.voto_governador, i.voto_governador),
      voto_presidente = COALESCE(NEW.voto_presidente, i.voto_presidente)
  WHERE i.id = NEW.imovel_id
    AND (i.data_pesquisa IS NULL OR NEW.data_pesquisa >= i.data_pesquisa);
  RETURN NEW;
END; $$;

-- Update the upsert_imovel RPC function
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
  p_longitude double precision DEFAULT NULL,
  p_nome_morador text DEFAULT NULL,
  p_voto_estadual text DEFAULT NULL,
  p_voto_federal text DEFAULT NULL,
  p_voto_senador text DEFAULT NULL,
  p_voto_governador text DEFAULT NULL,
  p_voto_presidente text DEFAULT NULL,
  p_situacao text DEFAULT NULL
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
    INSERT INTO public.imoveis(rua_id, numero, complemento, latitude, longitude, nome_morador, voto_estadual, voto_federal, voto_senador, voto_governador, voto_presidente, situacao)
    VALUES (v_rua, v_num_n, v_comp_n, p_latitude, p_longitude, p_nome_morador, p_voto_estadual, p_voto_federal, p_voto_senador, p_voto_governador, p_voto_presidente, p_situacao)
    RETURNING id INTO v_imovel;
    v_criado := true;
  ELSE
    UPDATE public.imoveis
    SET latitude = COALESCE(p_latitude, latitude),
        longitude = COALESCE(p_longitude, longitude),
        nome_morador = COALESCE(p_nome_morador, nome_morador),
        voto_estadual = COALESCE(p_voto_estadual, voto_estadual),
        voto_federal = COALESCE(p_voto_federal, voto_federal),
        voto_senador = COALESCE(p_voto_senador, voto_senador),
        voto_governador = COALESCE(p_voto_governador, voto_governador),
        voto_presidente = COALESCE(p_voto_presidente, voto_presidente),
        situacao = COALESCE(p_situacao, situacao)
    WHERE id = v_imovel;
  END IF;

  IF p_resultado IS NOT NULL OR p_situacao IS NOT NULL OR p_voto_presidente IS NOT NULL OR p_nome_morador IS NOT NULL THEN
    INSERT INTO public.pesquisas(imovel_id, resultado, observacao, data_pesquisa, equipe_id, created_by, nome_morador, voto_estadual, voto_federal, voto_senador, voto_governador, voto_presidente, situacao)
    VALUES (v_imovel, p_resultado, NULLIF(btrim(coalesce(p_observacao,'')),''), COALESCE(p_data, current_date), v_equipe, auth.uid(), p_nome_morador, p_voto_estadual, p_voto_federal, p_voto_senador, p_voto_governador, p_voto_presidente, p_situacao);
    IF NOT v_criado THEN v_atualizado := true; END IF;
  END IF;

  RETURN jsonb_build_object('imovel_id', v_imovel, 'criado', v_criado, 'atualizado', v_atualizado);
END; $$;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.upsert_imovel(text,text,text,text,text,public.resultado_pesquisa,text,date,text,double precision,double precision,text,text,text,text,text,text,text) TO authenticated;
