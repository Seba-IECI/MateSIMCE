-- Manual approval required. Updates only the selection fragment of the existing RPC.
-- No answer keys, question text, user IDs, tables, policies, grants or historical writes.
-- New attempts prefer questions outside the last completed exam, then least-recently used.
-- Source tracking uses exact snapshots (topic + full statement + options); no new columns.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
DO $patch$
DECLARE
  target regprocedure := to_regprocedure('public.matesimce_exam(text,uuid,uuid,integer)');
  definition text;
  old_fragment text := $before$
      WITH eligible AS (
        SELECT e.id, e.tema_id, t.categoria,
          concat_ws(E'\n\n', e.titulo, e.enunciado, nullif(e.instrucciones, '')) AS statement,
          e.opciones, s.respuesta_correcta, s.desarrollo_paso_a_paso,
          row_number() OVER (PARTITION BY t.categoria ORDER BY random(), e.id) AS position
        FROM public.ejercicios e
        JOIN public.temas t ON t.id = e.tema_id
        JOIN public.soluciones_ejercicios s ON s.ejercicio_id = e.id
$before$;
  new_fragment text := $after$
      WITH latest_exam AS (
        SELECT i.ensayo_id FROM public.intentos_ensayo i
          JOIN public.ensayos_simce exam ON exam.id=i.ensayo_id
        WHERE i.usuario_id=learner AND i.estado='completado'
          AND exam.codigo LIKE 'matesimce-practica-12-v1:%'
        ORDER BY i.fecha_termino DESC, i.fecha_inicio DESC, i.id DESC LIMIT 1
      ), eligible AS (
        SELECT e.id, e.tema_id, t.categoria,
          concat_ws(E'\n\n', e.titulo, e.enunciado, nullif(e.instrucciones, '')) AS statement,
          e.opciones, s.respuesta_correcta, s.desarrollo_paso_a_paso,
          row_number() OVER (PARTITION BY t.categoria ORDER BY
            coalesce(history.in_latest,false), history.last_used NULLS FIRST, random(), e.id) AS position
        FROM public.ejercicios e
        JOIN public.temas t ON t.id = e.tema_id
        JOIN public.soluciones_ejercicios s ON s.ejercicio_id = e.id
        -- Existing snapshots have no source ID. Match the full statement, options and topic,
        -- never a title alone. Historical snapshots and responses remain unchanged.
        LEFT JOIN LATERAL (
          SELECT bool_or(q.ensayo_id=(SELECT ensayo_id FROM latest_exam)) AS in_latest,
            max(coalesce(i.fecha_termino,i.fecha_inicio)) AS last_used
          FROM public.preguntas_ensayo q
            JOIN public.intentos_ensayo i ON i.ensayo_id=q.ensayo_id
            JOIN public.ensayos_simce exam ON exam.id=i.ensayo_id
          WHERE i.usuario_id=learner AND i.estado IN ('completado','en_curso')
            AND exam.codigo LIKE 'matesimce-practica-12-v1:%'
            AND q.tema_id=e.tema_id AND q.opciones=e.opciones
            AND q.enunciado=concat_ws(E'\n\n', e.titulo, e.enunciado, nullif(e.instrucciones, ''))
        ) history ON true
$after$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
  THEN RAISE EXCEPTION 'Ejecutar solo como responsable autorizado en SQL Editor.'; END IF;
  IF target IS NULL THEN RAISE EXCEPTION 'Primero debe estar habilitado matesimce_exam.'; END IF;
  -- VS Code/Windows may copy CRLF into these dollar-quoted fragments.
  -- Normalize BOTH operands before trimming/comparing. Do not normalize SQL
  -- tokens or string literals: any substantive remote difference must still fail.
  old_fragment := ltrim(replace(old_fragment,E'\r\n',E'\n'), E'\n');
  new_fragment := ltrim(replace(new_fragment,E'\r\n',E'\n'), E'\n');
  SELECT replace(pg_get_functiondef(target),E'\r\n',E'\n') INTO definition;
  IF strpos(definition,new_fragment)>0 THEN
    RAISE NOTICE 'Diversificacion ya aplicada; no se modifica nada.';
  ELSIF (length(definition)-length(replace(definition,old_fragment,'')))=length(old_fragment) THEN
    EXECUTE replace(definition,old_fragment,new_fragment);
    RAISE NOTICE 'Selector actualizado. Solo afecta conjuntos de ensayos futuros.';
  ELSE
    RAISE EXCEPTION 'La funcion remota difiere del selector esperado; no se reemplaza. Comparar definicion antes de continuar.';
  END IF;
END;
$patch$ LANGUAGE plpgsql;
COMMIT;
