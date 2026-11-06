-- Read-only. No question text, answer keys, student IDs or credentials.
WITH target_function AS (
  SELECT p.oid,p.prosrc,p.prosecdef,p.proconfig
  FROM pg_proc p
  WHERE p.oid=to_regprocedure('public.matesimce_exam(text,uuid,uuid,integer)')
)
SELECT jsonb_build_object(
  'firma',oid::regprocedure::text,
  'security_definer',prosecdef,
  'configuracion',proconfig,
  'separador_hex',encode(convert_to(substring(prosrc FROM 'concat_ws\(([^,]+), e.titulo'),'UTF8'),'hex'),
  'prioriza_ultimo',strpos(prosrc,'coalesce(history.in_latest,false)')>0,
  'prioriza_antiguedad',strpos(prosrc,'history.last_used NULLS FIRST')>0,
  'ultimo_por_finalizacion',strpos(prosrc,'ORDER BY i.fecha_termino DESC, i.fecha_inicio DESC, i.id DESC LIMIT 1')>0,
  'tres_por_eje',prosrc ~ 'FROM eligible WHERE position <= 3',
  'doce_preguntas',strpos(prosrc,'jsonb_array_length(snapshot) <> 12')>0,
  'propiedad_historial',strpos(prosrc,'WHERE i.usuario_id=learner AND i.estado IN')>0,
  'identidad_por_tema_y_alternativas',strpos(prosrc,'q.tema_id=e.tema_id AND q.opciones=e.opciones')>0,
  'desempate_aleatorio',strpos(prosrc,'history.last_used NULLS FIRST, random(), e.id')>0,
  'huella_cuerpo',md5(prosrc)
) AS algoritmo_instalado
FROM target_function;
