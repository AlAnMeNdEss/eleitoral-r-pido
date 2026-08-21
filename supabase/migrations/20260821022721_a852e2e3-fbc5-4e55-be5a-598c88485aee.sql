ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS visitas integer NOT NULL DEFAULT 0;

UPDATE public.imoveis i
SET visitas = sub.c
FROM (SELECT imovel_id, count(*)::int AS c FROM public.pesquisas GROUP BY imovel_id) sub
WHERE sub.imovel_id = i.id;

CREATE OR REPLACE FUNCTION public.sync_imovel_from_pesquisa()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.imoveis i
  SET resultado_atual = COALESCE(NEW.resultado, i.resultado_atual),
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

  IF TG_OP = 'INSERT' THEN
    UPDATE public.imoveis
    SET visitas = (
      SELECT count(DISTINCT data_pesquisa)::int FROM public.pesquisas WHERE imovel_id = NEW.imovel_id
    )
    WHERE id = NEW.imovel_id;
  END IF;

  RETURN NEW;
END; $function$;